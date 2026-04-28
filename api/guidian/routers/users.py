from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from guidian.db.session import get_db
from guidian.models.models import LearnerProfile, User, UserRole
from guidian.routers.deps import get_current_user, require_roles
from guidian.schemas.user import IdentityVerifyRequest, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def read_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get("", response_model=list[UserRead], dependencies=[Depends(require_roles(UserRole.admin, UserRole.org_admin))])
async def list_users(db: AsyncSession = Depends(get_db), limit: int = 50, offset: int = 0):
    rows = (await db.execute(select(User).limit(limit).offset(offset))).scalars().all()
    return rows


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return user


@router.patch("/me/identity", response_model=UserRead)
async def update_identity(
    body: IdentityVerifyRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = (
        await db.execute(select(LearnerProfile).where(LearnerProfile.user_id == user.id))
    ).scalar_one_or_none()
    if profile is None:
        profile = LearnerProfile(user_id=user.id, vark_scores={}, preferences={})
        db.add(profile)
    prefs = dict(profile.preferences or {})
    prefs["identity_verified_at"] = datetime.now(timezone.utc).isoformat()
    prefs["identity_data"] = {
        "full_name": body.full_name,
        "license_number": body.license_number,
        "last_four_ssn": body.last_four_ssn,
    }
    profile.preferences = prefs
    if body.full_name and not user.full_name:
        user.full_name = body.full_name
    await db.commit()
    # Re-fetch with profile eagerly loaded so UserRead can access it
    user = (
        await db.execute(
            select(User).options(selectinload(User.profile)).where(User.id == user.id)
        )
    ).scalar_one()
    return user


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(require_roles(UserRole.admin, UserRole.org_admin)),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user
