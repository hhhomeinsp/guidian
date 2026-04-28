from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from uuid import UUID

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.core.config import settings
from guidian.models.models import Course, LearnerMemory, TeacherSession

TEACHER_SYSTEM_PROMPT = """You are a knowledgeable, encouraging AI instructor for Guidian — a professional continuing education platform. You know this learner personally and adapt to their style and background.

You have access to this learner's memory:
{memory_context}

Current course context (if any):
{course_context}

Your role:
- Answer questions about course content accurately and clearly
- Adapt explanations to their learning style ({vark_style})
- Reference their specific profession and license type when relevant
- Celebrate progress, gently address struggle areas
- Keep responses focused and practical — these are busy professionals
- If they ask something outside your knowledge, say so honestly
- Be warm but professional. Not sycophantic.

If this is the first message of a session, greet them by name and reference something relevant from their recent activity or goals."""

MEMORY_UPDATE_PROMPT = """Review this conversation transcript and the existing learner memory summary. Produce a JSON object updating the learner's profile.

Existing summary:
{existing_summary}

Session transcript:
{transcript}

Output ONLY valid JSON with these fields (omit any you have no new data for):
{{
  "long_term_summary": "updated cumulative summary of key facts about this learner",
  "new_strengths": ["topics they demonstrated clear understanding of"],
  "new_struggles": ["topics they struggled with or asked repeated questions about"],
  "personality_notes": "updated notes on their learning style or communication preferences"
}}"""


async def get_teacher_response(
    user_id: UUID,
    messages: list[dict],
    db: AsyncSession,
    course_id: UUID | None = None,
) -> AsyncIterator[str]:
    memory = await _get_or_create_memory(user_id, db)
    course_context = await _get_course_context(course_id, db) if course_id else "None"
    memory_context = _format_memory_context(memory)
    vark = memory.vark_style or "general"

    system = TEACHER_SYSTEM_PROMPT.format(
        memory_context=memory_context,
        course_context=course_context,
        vark_style=vark,
    )

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    full_response = []

    async with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=system,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            full_response.append(text)
            yield text

    response_text = "".join(full_response)
    usage = (await stream.get_final_message()).usage
    tokens = usage.input_tokens + usage.output_tokens

    session = await _save_session(
        user_id=user_id,
        messages=messages,
        response_text=response_text,
        tokens_used=tokens,
        course_id=course_id,
        db=db,
    )

    if len(messages) >= 10:
        await update_memory_after_session(user_id, messages + [{"role": "assistant", "content": response_text}], db)

    memory.total_sessions = (memory.total_sessions or 0) + 1
    memory.last_session_at = datetime.now(timezone.utc)
    await db.commit()

    # Signal completion with session ID (can't return value from async generator)
    yield f"__SESSION_ID__{session.id}"


async def update_memory_after_session(
    user_id: UUID,
    session_messages: list[dict],
    db: AsyncSession,
) -> None:
    memory = await _get_or_create_memory(user_id, db)
    transcript = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in session_messages)

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": MEMORY_UPDATE_PROMPT.format(
                existing_summary=memory.long_term_summary or "None yet.",
                transcript=transcript,
            ),
        }],
    )

    raw = message.content[0].text.strip()
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        data = json.loads(raw[start:end])
    except (ValueError, AttributeError):
        return

    if summary := data.get("long_term_summary"):
        memory.long_term_summary = summary
    if new_strengths := data.get("new_strengths"):
        existing = set(memory.strengths or [])
        memory.strengths = list(existing | set(new_strengths))
    if new_struggles := data.get("new_struggles"):
        existing = set(memory.struggle_areas or [])
        memory.struggle_areas = list(existing | set(new_struggles))
    if notes := data.get("personality_notes"):
        memory.personality_notes = notes

    await db.commit()


async def _get_or_create_memory(user_id: UUID, db: AsyncSession) -> LearnerMemory:
    result = await db.execute(select(LearnerMemory).where(LearnerMemory.user_id == user_id))
    memory = result.scalar_one_or_none()
    if not memory:
        memory = LearnerMemory(user_id=user_id, strengths=[], struggle_areas=[])
        db.add(memory)
        await db.flush()
    return memory


async def _get_course_context(course_id: UUID, db: AsyncSession) -> str:
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        return "None"
    return f"Course: {course.title} ({course.ceu_hours} CEU hours). {course.description or ''}"


def _format_memory_context(memory: LearnerMemory) -> str:
    parts = []
    if memory.profession:
        parts.append(f"Profession: {memory.profession}")
    if memory.license_state and memory.license_type:
        parts.append(f"License: {memory.license_type} in {memory.license_state}")
    if memory.renewal_deadline:
        parts.append(f"Renewal deadline: {memory.renewal_deadline.date()}")
    if memory.learning_goals:
        parts.append(f"Goals: {memory.learning_goals}")
    if memory.long_term_summary:
        parts.append(f"Summary: {memory.long_term_summary}")
    if memory.strengths:
        parts.append(f"Strengths: {', '.join(memory.strengths)}")
    if memory.struggle_areas:
        parts.append(f"Struggles: {', '.join(memory.struggle_areas)}")
    if memory.personality_notes:
        parts.append(f"Notes: {memory.personality_notes}")
    return "\n".join(parts) if parts else "New learner — no history yet."


async def _save_session(
    user_id: UUID,
    messages: list[dict],
    response_text: str,
    tokens_used: int,
    course_id: UUID | None,
    db: AsyncSession,
) -> TeacherSession:
    all_messages = list(messages) + [{
        "role": "assistant",
        "content": response_text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }]
    session = TeacherSession(
        user_id=user_id,
        messages=all_messages,
        session_type="chat",
        course_id=course_id,
        tokens_used=tokens_used,
    )
    db.add(session)
    await db.flush()
    return session
