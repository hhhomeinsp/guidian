from __future__ import annotations

import io
import re
import uuid

import boto3
import httpx

from guidian.core.config import settings

_CHUNK_LIMIT = 4800  # ElevenLabs max is ~5000; stay safely under


def _lesson_to_script(title: str, mdx_content: str) -> str:
    """Strip MDX/markdown syntax to produce clean narration text."""
    text = re.sub(r"^#{1,6}\s+", "", mdx_content, flags=re.MULTILINE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[`*_~]", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return f"{title}.\n\n{text}"


def _split_into_chunks(script: str, max_chars: int = _CHUNK_LIMIT) -> list[str]:
    """Split script at sentence/paragraph boundaries so each chunk ≤ max_chars."""
    if len(script) <= max_chars:
        return [script]

    chunks: list[str] = []
    remaining = script
    while len(remaining) > max_chars:
        # Search backwards from max_chars for a good break point
        boundary = remaining.rfind("\n\n", 0, max_chars)
        if boundary == -1:
            boundary = remaining.rfind(". ", 0, max_chars)
        if boundary == -1:
            boundary = remaining.rfind(" ", 0, max_chars)
        if boundary == -1:
            boundary = max_chars  # hard split as last resort
        else:
            boundary += 1  # include the delimiter in the completed chunk
        chunks.append(remaining[:boundary].strip())
        remaining = remaining[boundary:].strip()
    if remaining:
        chunks.append(remaining)
    return chunks


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )


def _tts_request(text: str, api_key: str, voice_id: str) -> bytes:
    resp = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        json={
            "text": text,
            "model_id": "eleven_turbo_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            "output_format": "mp3_44100_128",
        },
        timeout=120,
    )
    resp.raise_for_status()
    return resp.content


def synthesize_and_upload(lesson_id: uuid.UUID, title: str, mdx_content: str) -> tuple[str, str]:
    """
    Call ElevenLabs TTS (chunked for long content), upload the combined MP3 to R2.
    Returns (s3_key, script) so the caller can persist the transcript.
    """
    if not settings.ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")

    script = _lesson_to_script(title, mdx_content)
    chunks = _split_into_chunks(script)

    mp3_parts: list[bytes] = []
    for chunk in chunks:
        mp3_parts.append(_tts_request(chunk, settings.ELEVENLABS_API_KEY, settings.ELEVENLABS_VOICE_ID))

    combined_mp3 = b"".join(mp3_parts)

    key = f"lessons/{lesson_id}/audio.mp3"
    _s3_client().upload_fileobj(
        io.BytesIO(combined_mp3),
        settings.S3_BUCKET_AUDIO,
        key,
        ExtraArgs={"ContentType": "audio/mpeg"},
    )
    return key, script
