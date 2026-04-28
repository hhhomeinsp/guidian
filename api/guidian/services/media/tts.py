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


def _strip_markdown(text: str) -> str:
    """Strip markdown formatting to produce clean TTS text."""
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[`*_~]", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


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


def _parse_mdx_sections(mdx_content: str) -> list[dict]:
    """
    Split mdx_content into ## sections, matching the frontend parseSections logic.
    Returns list of {heading, body} dicts.
    """
    raw = re.split(r"\n(?=## )", mdx_content)
    sections = []
    for chunk in raw:
        lines = chunk.split("\n")
        first_line = lines[0].strip()
        if first_line.startswith("## "):
            sections.append({
                "heading": first_line[3:].strip(),
                "body": "\n".join(lines[1:]).strip(),
            })
        elif first_line:
            sections.append({"heading": "", "body": chunk.strip()})
    return sections


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


# Deprecated: use synthesize_lesson_slides for new lessons
def synthesize_and_upload(lesson_id: uuid.UUID, title: str, mdx_content: str) -> tuple[str, str]:
    """
    Call ElevenLabs TTS (chunked for long content), upload the combined MP3 to R2.
    Returns (s3_key, script) so the caller can persist the transcript.

    Deprecated: per-lesson audio replaced by per-slide audio via synthesize_lesson_slides.
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


def synthesize_slide(text: str, lesson_id: uuid.UUID, slide_index: int) -> str:
    """
    Synthesize TTS for a single slide and upload to R2.
    Each slide is short (150-300 words), so no chunking needed.
    Returns the R2 object key: lessons/{lesson_id}/slides/{slide_index}/audio.mp3
    """
    if not settings.ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")

    mp3 = _tts_request(text, settings.ELEVENLABS_API_KEY, settings.ELEVENLABS_VOICE_ID)
    key = f"lessons/{lesson_id}/slides/{slide_index}/audio.mp3"
    _s3_client().upload_fileobj(
        io.BytesIO(mp3),
        settings.S3_BUCKET_AUDIO,
        key,
        ExtraArgs={"ContentType": "audio/mpeg"},
    )
    return key


def synthesize_lesson_slides(
    lesson_id: uuid.UUID,
    title: str,
    objectives: list[str],
    mdx_content: str,
    db_session,
) -> list[str]:
    """
    Synthesize per-slide audio for a lesson.

    Slide index mapping (matches frontend SlideViewer):
        0       → title slide: "{title}. {objectives joined}"
        1..n    → content slides: one per ## section in mdx_content
        summary → skipped (no audio generated)

    Returns list of R2 keys in order. Updates lesson.slide_audio_keys in the DB.
    """
    from guidian.models.models import Lesson

    if not settings.ELEVENLABS_API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")

    # Build title slide text
    title_text = title
    if objectives:
        title_text += ". " + ". ".join(objectives)
    title_text = _strip_markdown(title_text)

    sections = _parse_mdx_sections(mdx_content)

    keys: list[str] = []

    # Index 0: title slide
    key = synthesize_slide(title_text, lesson_id, 0)
    keys.append(key)

    # Indices 1..n: one per ## section
    for i, section in enumerate(sections, start=1):
        heading = section["heading"]
        body = section["body"]
        text = f"{heading}.\n\n{body}" if heading else body
        text = _strip_markdown(text)
        if not text.strip():
            keys.append("")
            continue
        key = synthesize_slide(text, lesson_id, i)
        keys.append(key)

    # Persist to DB
    lesson = db_session.get(Lesson, lesson_id)
    if lesson:
        lesson.slide_audio_keys = keys
        db_session.commit()

    return keys
