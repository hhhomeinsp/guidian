from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator
from datetime import date
from uuid import UUID

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.core.config import settings
from guidian.models.models import LearnerMemory, LearnerProfile

ONBOARDING_SYSTEM_PROMPT = """You are Guidian's friendly onboarding guide. Your job is to have a short, warm conversation with a new learner to understand:
1. Their profession and license type (e.g. home inspector, real estate agent, nurse)
2. Their state/location
3. Their learning goals (renew license, prep for exam, build skills)
4. How they prefer to learn (visual diagrams, listening/audio, reading, hands-on practice)
5. Their renewal deadline if applicable

Ask 1-2 questions at a time. Be conversational, not form-like. 3-4 exchanges maximum.

When you have enough information, output EXACTLY this JSON on its own line (nothing before or after on that line):
ONBOARDING_COMPLETE:{"profession":"...","license_state":"...","license_type":"...","vark_style":"visual|auditory|read|kinesthetic","learning_goals":"...","renewal_deadline":"YYYY-MM-DD or null","personality_notes":"..."}

Then say a warm closing message welcoming them and suggesting their first course."""

_COMPLETE_RE = re.compile(r"ONBOARDING_COMPLETE:(\{.+\})", re.DOTALL)


async def run_onboarding_stream(
    user_id: UUID,
    messages: list[dict],
    db: AsyncSession,
) -> AsyncIterator[str]:
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    full_response: list[str] = []

    async with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=ONBOARDING_SYSTEM_PROMPT,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            full_response.append(text)
            yield text

    response_text = "".join(full_response)
    match = _COMPLETE_RE.search(response_text)
    if match:
        try:
            profile_data = json.loads(match.group(1))
            await _save_onboarding_data(user_id, profile_data, db)
        except (json.JSONDecodeError, Exception):
            pass


async def _save_onboarding_data(user_id: UUID, data: dict, db: AsyncSession) -> None:
    result = await db.execute(select(LearnerMemory).where(LearnerMemory.user_id == user_id))
    memory = result.scalar_one_or_none()
    if not memory:
        memory = LearnerMemory(user_id=user_id, strengths=[], struggle_areas=[])
        db.add(memory)

    memory.profession = data.get("profession")
    memory.license_state = data.get("license_state")
    memory.license_type = data.get("license_type")
    memory.vark_style = data.get("vark_style")
    memory.learning_goals = data.get("learning_goals")
    memory.personality_notes = data.get("personality_notes")
    memory.onboarding_complete = True

    raw_deadline = data.get("renewal_deadline")
    if raw_deadline and raw_deadline != "null":
        try:
            parsed = date.fromisoformat(raw_deadline)
            from datetime import datetime, timezone
            memory.renewal_deadline = datetime(parsed.year, parsed.month, parsed.day, tzinfo=timezone.utc)
        except ValueError:
            pass

    result2 = await db.execute(select(LearnerProfile).where(LearnerProfile.user_id == user_id))
    profile = result2.scalar_one_or_none()
    if not profile:
        profile = LearnerProfile(user_id=user_id, vark_scores={}, preferences={})
        db.add(profile)

    vark = data.get("vark_style", "")
    profile.preferences = {**profile.preferences, "vark_style": vark}

    await db.commit()


def extract_onboarding_complete(response_text: str) -> dict | None:
    match = _COMPLETE_RE.search(response_text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            return None
    return None
