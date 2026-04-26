from __future__ import annotations

import io
import re
import uuid

import boto3
import httpx

from guidian.core.config import settings


def _lesson_to_script(title: str, mdx_content: str) -> str:
    """Strip MDX/markdown syntax to produce clean narration text."""
    text = re.sub(r"^#{1,6}\s+", "", mdx_content, flags=re.MULTILINE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[`*_~]", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    script = f"{title}.\n\n{text}"
    return script[:4500]


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )


def synthesize_and_upload(lesson_id: uuid.UUID, title: str, mdx_content: str) -> str:
    """
    Call ElevenLabs TTS, upload the MP3 to R2, return the S3 object key.
    Falls back silently if ELEVENLABS_API_KEY is not configured.
    """
    if not settings.ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")

    script = _lesson_to_script(title, mdx_content)

    resp = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{settings.ELEVENLABS_VOICE_ID}",
        headers={
            "xi-api-key": settings.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        json={
            "text": script,
            "model_id": "eleven_turbo_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            "output_format": "mp3_44100_128",
        },
        timeout=60,
    )
    resp.raise_for_status()

    key = f"lessons/{lesson_id}/audio.mp3"
    _s3_client().upload_fileobj(
        io.BytesIO(resp.content),
        settings.S3_BUCKET_AUDIO,
        key,
        ExtraArgs={"ContentType": "audio/mpeg"},
    )
    return key
