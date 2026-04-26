from __future__ import annotations

import io
import uuid

import boto3
import httpx

from guidian.core.config import settings

_SYSTEM_STYLE = (
    "Clean, professional educational illustration. "
    "Flat design, muted tones, no text overlays, suitable for compliance training."
)


def _build_prompt(title: str, objectives: list[str]) -> str:
    obj_summary = "; ".join(objectives[:3]) if objectives else ""
    parts = [f"Educational hero image for a lesson titled: '{title}'."]
    if obj_summary:
        parts.append(f"Key concepts: {obj_summary}.")
    parts.append(_SYSTEM_STYLE)
    return " ".join(parts)


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )


def generate_and_upload(lesson_id: uuid.UUID, title: str, objectives: list[str]) -> str:
    """
    Call DALL-E 3, download the image, upload to R2, return the S3 object key.
    """
    if not settings.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    prompt = _build_prompt(title, objectives)

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
            "response_format": "url",
        },
        timeout=60,
    )
    resp.raise_for_status()
    image_url = resp.json()["data"][0]["url"]

    image_bytes = httpx.get(image_url, timeout=60).content

    key = f"lessons/{lesson_id}/hero.png"
    _s3_client().upload_fileobj(
        io.BytesIO(image_bytes),
        settings.S3_BUCKET_COURSES,
        key,
        ExtraArgs={"ContentType": "image/png"},
    )
    return key
