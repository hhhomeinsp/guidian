from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import WaitlistEntry

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


class WaitlistCreate(BaseModel):
    email: EmailStr
    state: str = Field(min_length=2, max_length=2)
    course_slug: str = Field(min_length=1, max_length=128)


@router.post("", status_code=status.HTTP_201_CREATED)
async def join_waitlist(
    body: WaitlistCreate,
    db: AsyncSession = Depends(get_db),
):
    entry = WaitlistEntry(
        email=str(body.email).lower(),
        state_code=body.state.upper(),
        course_slug=body.course_slug,
    )
    db.add(entry)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already on this waitlist",
        )
    return {"message": "Added to waitlist"}
