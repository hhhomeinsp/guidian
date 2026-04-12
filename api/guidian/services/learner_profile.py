"""
Learner profile + adaptive style-vector service.

Vector layout (16 dims) for `LearnerProfile.style_vector`:

    dims  0..3   base_preference  per [visual, auditory, read, kinesthetic]
                  (normalized probabilities from the VARK assessment)
    dims  4..7   engagement       per [visual, auditory, read, kinesthetic]
                  (exponential moving average of in-session dwell + switches)
    dims  8..11  quiz_perf        per [visual, auditory, read, kinesthetic]
                  (reserved for step 10 — quiz engine)
    dims 12..15  completion_rate  per [visual, auditory, read, kinesthetic]
                  (reserved for step 11 — compliance rules)

The effective preferred style is computed as the argmax of a weighted mix of
base_preference and engagement. The renderer queries this via
`derive_preferred_style`.
"""
from __future__ import annotations

from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.models.models import LearnerProfile

LearningStyle = Literal["visual", "auditory", "read", "kinesthetic"]
STYLE_ORDER: list[LearningStyle] = ["visual", "auditory", "read", "kinesthetic"]
STYLE_TO_INDEX = {s: i for i, s in enumerate(STYLE_ORDER)}

VECTOR_DIM = 16
BASE_SLICE = slice(0, 4)
ENGAGEMENT_SLICE = slice(4, 8)
QUIZ_SLICE = slice(8, 12)
COMPLETION_SLICE = slice(12, 16)


def empty_vector() -> list[float]:
    return [0.0] * VECTOR_DIM


def compute_vark_scores(answers: list[tuple[str, LearningStyle]]) -> dict[str, float]:
    """Tally VARK answers → normalized scores per style."""
    counts = {s: 0 for s in STYLE_ORDER}
    for _qid, style in answers:
        counts[style] += 1
    total = sum(counts.values()) or 1
    return {s: counts[s] / total for s in STYLE_ORDER}


def vector_from_vark(scores: dict[str, float]) -> list[float]:
    v = empty_vector()
    for style in STYLE_ORDER:
        v[STYLE_TO_INDEX[style]] = float(scores.get(style, 0.0))
    return v


def apply_signal(
    vector: list[float] | None,
    *,
    variant: LearningStyle,
    event: Literal["dwell", "switch", "replay"],
    seconds: int,
) -> list[float]:
    """
    Update engagement dims via exponential moving average.

    - dwell: weight = min(1, seconds / 300) capped at 0.35 to dampen single-session skew
    - switch: +0.05 bump (learner actively chose this variant)
    - replay: +0.15 bump (strong signal of preference for this variant)
    """
    v = list(vector) if vector else empty_vector()
    # Ensure length
    if len(v) != VECTOR_DIM:
        v = (v + empty_vector())[:VECTOR_DIM]

    idx = STYLE_TO_INDEX[variant]
    eng_idx = 4 + idx

    if event == "dwell":
        weight = min(0.35, max(0.0, seconds / 300))
    elif event == "switch":
        weight = 0.05
    else:  # replay
        weight = 0.15

    current = v[eng_idx]
    # EMA toward 1.0 for this variant, decay slightly for the others
    v[eng_idx] = current + weight * (1.0 - current)
    for other in STYLE_ORDER:
        if other == variant:
            continue
        j = 4 + STYLE_TO_INDEX[other]
        v[j] = v[j] * (1.0 - weight * 0.25)
    return v


def apply_quiz_result(
    vector: list[float] | None,
    *,
    variant: LearningStyle,
    score: float,
) -> list[float]:
    """
    Update quiz_perf dims (8..11) for the variant the learner was viewing
    when the quiz was taken. EMA with weight 0.3 — a single attempt should
    move the dim but not dominate it.
    """
    v = list(vector) if vector else empty_vector()
    if len(v) != VECTOR_DIM:
        v = (v + empty_vector())[:VECTOR_DIM]
    idx = STYLE_TO_INDEX[variant]
    qp_idx = 8 + idx
    weight = 0.3
    v[qp_idx] = v[qp_idx] + weight * (max(0.0, min(1.0, score)) - v[qp_idx])
    return v


def apply_completion(
    vector: list[float] | None,
    *,
    variant: LearningStyle,
) -> list[float]:
    """
    Bump the completion_rate dim (12..15) for the variant the learner completed
    a lesson in. EMA weight 0.2 — completions are meaningful but we don't want
    a single heavy session to dominate the rate.
    """
    v = list(vector) if vector else empty_vector()
    if len(v) != VECTOR_DIM:
        v = (v + empty_vector())[:VECTOR_DIM]
    idx = STYLE_TO_INDEX[variant]
    cr_idx = 12 + idx
    weight = 0.2
    v[cr_idx] = v[cr_idx] + weight * (1.0 - v[cr_idx])
    return v


def derive_preferred_style(vector: list[float] | None) -> LearningStyle:
    if not vector or len(vector) < 8:
        return "read"
    base = vector[BASE_SLICE]
    eng = vector[ENGAGEMENT_SLICE]
    qp = vector[QUIZ_SLICE] if len(vector) >= 12 else [0.0, 0.0, 0.0, 0.0]
    cr = vector[COMPLETION_SLICE] if len(vector) >= 16 else [0.0, 0.0, 0.0, 0.0]

    eng_active = any(abs(x) > 1e-9 for x in eng)
    qp_active = any(abs(x) > 1e-9 for x in qp)
    cr_active = any(abs(x) > 1e-9 for x in cr)

    if not any([eng_active, qp_active, cr_active]):
        mixed = base
    elif not qp_active and not cr_active:
        mixed = [0.4 * base[i] + 0.6 * eng[i] for i in range(4)]
    elif not cr_active:
        mixed = [0.3 * base[i] + 0.5 * eng[i] + 0.2 * qp[i] for i in range(4)]
    else:
        mixed = [
            0.25 * base[i] + 0.40 * eng[i] + 0.20 * qp[i] + 0.15 * cr[i] for i in range(4)
        ]

    best_i = max(range(4), key=lambda i: mixed[i])
    return STYLE_ORDER[best_i]


async def get_or_create_profile(db: AsyncSession, user_id: UUID) -> LearnerProfile:
    profile = (
        await db.execute(select(LearnerProfile).where(LearnerProfile.user_id == user_id))
    ).scalar_one_or_none()
    if profile is None:
        profile = LearnerProfile(user_id=user_id, vark_scores={}, style_vector=empty_vector(), preferences={})
        db.add(profile)
        await db.flush()
    return profile
