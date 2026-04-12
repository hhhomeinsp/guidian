from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import ComplianceAuditLog, Course, User, UserRole
from guidian.routers.deps import get_current_user
from guidian.schemas.compliance import ComplianceDecision
from guidian.services.compliance.engine import evaluate_course_completion

router = APIRouter(prefix="/courses", tags=["compliance"])


@router.get("/{course_id}/compliance", response_model=ComplianceDecision)
async def get_my_compliance(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    decision = await evaluate_course_completion(db, user.id, course)

    # Audit every evaluation (append-only log)
    db.add(
        ComplianceAuditLog(
            actor_user_id=user.id,
            subject_user_id=user.id,
            course_id=course.id,
            event_type="compliance.evaluated",
            payload={
                "eligible": decision.eligible,
                "blockers": decision.blockers,
                "ceu_hours_awarded": decision.ceu_hours_awarded,
            },
        )
    )
    if decision.eligible:
        db.add(
            ComplianceAuditLog(
                actor_user_id=user.id,
                subject_user_id=user.id,
                course_id=course.id,
                event_type="compliance.met",
                payload={"ceu_hours_awarded": decision.ceu_hours_awarded},
            )
        )
    await db.commit()
    return decision


@router.get("/{course_id}/compliance/{user_id}", response_model=ComplianceDecision)
async def get_user_compliance(
    course_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if actor.id != user_id and actor.role not in (UserRole.admin, UserRole.org_admin, UserRole.instructor):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted")
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    decision = await evaluate_course_completion(db, user_id, course)
    db.add(
        ComplianceAuditLog(
            actor_user_id=actor.id,
            subject_user_id=user_id,
            course_id=course.id,
            event_type="compliance.evaluated",
            payload={"eligible": decision.eligible, "blockers": decision.blockers},
        )
    )
    await db.commit()
    return decision
