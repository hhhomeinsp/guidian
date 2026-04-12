from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import User
from guidian.routers.deps import get_current_user
from guidian.schemas.learner import (
    BehavioralSignalBatch,
    LearnerProfileRead,
    LearnerProfileUpdate,
    VARKSubmission,
)
from guidian.services.learner_profile import (
    apply_signal,
    compute_vark_scores,
    derive_preferred_style,
    get_or_create_profile,
    vector_from_vark,
)

router = APIRouter(prefix="/learner", tags=["learner"])


def _serialize(profile) -> dict:
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "vark_scores": profile.vark_scores or {},
        "style_vector": list(profile.style_vector) if profile.style_vector is not None else None,
        "preferences": profile.preferences or {},
        "preferred_style": derive_preferred_style(
            list(profile.style_vector) if profile.style_vector is not None else None
        ),
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
    }


@router.get("/profile", response_model=LearnerProfileRead)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = await get_or_create_profile(db, user.id)
    await db.commit()
    await db.refresh(profile)
    return _serialize(profile)


@router.patch("/profile", response_model=LearnerProfileRead)
async def update_profile(
    body: LearnerProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = await get_or_create_profile(db, user.id)
    if body.preferences is not None:
        profile.preferences = {**(profile.preferences or {}), **body.preferences}
    await db.commit()
    await db.refresh(profile)
    return _serialize(profile)


@router.post("/profile/vark", response_model=LearnerProfileRead)
async def submit_vark(
    body: VARKSubmission,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = await get_or_create_profile(db, user.id)
    scores = compute_vark_scores([(a.question_id, a.style) for a in body.answers])
    profile.vark_scores = scores

    # Seed base_preference dims of the style vector; preserve any existing engagement dims.
    base = vector_from_vark(scores)
    existing = list(profile.style_vector) if profile.style_vector is not None else [0.0] * 16
    merged = base[:4] + existing[4:]  # dims 0..3 reset, 4..15 preserved
    profile.style_vector = merged
    await db.commit()
    await db.refresh(profile)
    return _serialize(profile)


@router.post("/signals", response_model=LearnerProfileRead)
async def record_signals(
    body: BehavioralSignalBatch,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = await get_or_create_profile(db, user.id)
    vector = list(profile.style_vector) if profile.style_vector is not None else None
    for s in body.signals:
        vector = apply_signal(vector, variant=s.variant, event=s.event, seconds=s.seconds)
    profile.style_vector = vector
    await db.commit()
    await db.refresh(profile)
    return _serialize(profile)
