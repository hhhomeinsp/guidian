from __future__ import annotations

import base64
import io
import logging
import uuid

import boto3
import httpx

from guidian.core.config import settings

logger = logging.getLogger(__name__)

# Consistent visual style applied to all generated and reference-based images
_STYLE_SUFFIX = (
    "Clean, professional educational illustration for a home inspection certification course. "
    "Flat design. Muted color palette: navy blue (#2C3E50) for structure, slate gray (#7F8C8D) "
    "for secondary elements, warm white background, soft orange (#E67E22) accent for key components. "
    "No decorative elements. Suitable for licensed professional training material."
)

# Style prompt specifically for reference-based recreation
_REFERENCE_STYLE_PROMPT = (
    "Recreate this technical diagram as a clean, professional educational illustration "
    "for a home inspection certification course. Preserve all structural relationships, "
    "component positions, and labels from the reference. Apply flat design with a muted palette: "
    "navy blue for primary structural elements, slate gray for secondary components, "
    "soft orange accent for highlighted or critical details, white background. "
    "Crisp vector-style lines. No photorealism. Suitable for a professional licensing course."
)


def _build_prompt(title: str, objectives: list[str]) -> str:
    obj_summary = "; ".join(objectives[:3]) if objectives else ""
    parts = [f"Technical educational illustration for a lesson titled: '{title}'."]
    if obj_summary:
        parts.append(f"Key concepts to visualize: {obj_summary}.")
    parts.append(_STYLE_SUFFIX)
    return " ".join(parts)


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )


def _fetch_reference_bytes(url: str) -> bytes:
    """Download a reference image. Raises httpx.HTTPError on failure."""
    resp = httpx.get(url, timeout=30, follow_redirects=True)
    resp.raise_for_status()
    return resp.content


def _generate_text_only(prompt: str) -> bytes:
    """Call the GPT Image 1 generations endpoint with a text prompt."""
    resp = httpx.post(
        "https://api.openai.com/v1/images/generations",
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": settings.OPENAI_IMAGE_MODEL,
            "prompt": prompt,
            "n": 1,
            "size": settings.OPENAI_IMAGE_SIZE,
            "quality": settings.OPENAI_IMAGE_QUALITY,
            "output_format": "png",
        },
        timeout=90,
    )
    resp.raise_for_status()
    return base64.b64decode(resp.json()["data"][0]["b64_json"])


def _generate_from_reference(reference_bytes: bytes, style_prompt: str) -> bytes:
    """
    Call the GPT Image 1 edits endpoint, using a reference image as structural input
    and applying a consistent course style. Falls back to text-only on failure.
    """
    resp = httpx.post(
        "https://api.openai.com/v1/images/edits",
        headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
        data={
            "model": settings.OPENAI_IMAGE_MODEL,
            "prompt": style_prompt,
            "n": "1",
            "size": settings.OPENAI_IMAGE_SIZE,
            "quality": settings.OPENAI_IMAGE_QUALITY,
        },
        files={"image": ("reference.png", reference_bytes, "image/png")},
        timeout=120,
    )
    resp.raise_for_status()
    return base64.b64decode(resp.json()["data"][0]["b64_json"])


def generate_and_upload(
    lesson_id: uuid.UUID,
    title: str,
    objectives: list[str],
    reference_url: str | None = None,
) -> str:
    """
    Generate a lesson hero image and upload to R2. Returns the S3 object key.

    If reference_url is provided, downloads that diagram and uses GPT Image 1's
    edit endpoint to recreate it in the course's consistent visual style.
    Falls back to text-only generation if the reference fetch or edit fails.
    """
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    image_bytes: bytes | None = None

    if reference_url:
        try:
            logger.info("Fetching reference diagram for lesson %s: %s", lesson_id, reference_url)
            ref_bytes = _fetch_reference_bytes(reference_url)
            image_bytes = _generate_from_reference(ref_bytes, _REFERENCE_STYLE_PROMPT)
            logger.info("Reference-based image generated for lesson %s", lesson_id)
        except Exception as exc:
            logger.warning(
                "Reference-based generation failed for lesson %s (%s), falling back to text-only: %s",
                lesson_id,
                reference_url,
                exc,
            )

    if image_bytes is None:
        prompt = _build_prompt(title, objectives)
        image_bytes = _generate_text_only(prompt)

    key = f"lessons/{lesson_id}/hero.png"
    _s3_client().upload_fileobj(
        io.BytesIO(image_bytes),
        settings.S3_BUCKET_COURSES,
        key,
        ExtraArgs={"ContentType": "image/png"},
    )
    return key
