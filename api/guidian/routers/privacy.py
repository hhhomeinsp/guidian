"""GDPR / FERPA data export and account deletion endpoints."""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import (
    Certificate,
    ComplianceAuditLog,
    Enrollment,
    LessonProgress,
    QuizAttempt,
    User,
    XAPIStatement,
)
from guidian.routers.deps import get_current_user

router = APIRouter(prefix="/users", tags=["privacy"])


@router.get("/me/data-export")
async def export_my_data(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Return all personal data for the authenticated user as JSON (GDPR Art. 20)."""
    uid = user.id

    enrollments = (
        await db.execute(select(Enrollment).where(Enrollment.user_id == uid))
    ).scalars().all()

    progress = (
        await db.execute(select(LessonProgress).where(LessonProgress.user_id == uid))
    ).scalars().all()

    attempts = (
        await db.execute(select(QuizAttempt).where(QuizAttempt.user_id == uid))
    ).scalars().all()

    certs = (
        await db.execute(select(Certificate).where(Certificate.user_id == uid))
    ).scalars().all()

    audit = (
        await db.execute(
            select(ComplianceAuditLog).where(ComplianceAuditLog.subject_user_id == uid)
        )
    ).scalars().all()

    xapi = (
        await db.execute(
            select(XAPIStatement).where(
                XAPIStatement.actor["mbox"].astext == f"mailto:{user.email}"
            )
        )
    ).scalars().all()

    def _uuid(v: UUID | None) -> str | None:
        return str(v) if v else None

    def _dt(v: datetime | None) -> str | None:
        return v.isoformat() if v else None

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": _dt(getattr(user, "created_at", None)),
        },
        "enrollments": [
            {
                "id": str(e.id),
                "course_id": _uuid(e.course_id),
                "status": e.status,
                "started_at": _dt(e.started_at),
                "completed_at": _dt(e.completed_at),
                "progress_pct": e.progress_pct,
            }
            for e in enrollments
        ],
        "lesson_progress": [
            {
                "id": str(p.id),
                "lesson_id": _uuid(p.lesson_id),
                "seconds_spent": p.seconds_spent,
                "completed": p.completed,
                "completed_at": _dt(p.completed_at),
            }
            for p in progress
        ],
        "quiz_attempts": [
            {
                "id": str(a.id),
                "lesson_id": _uuid(a.lesson_id),
                "score": a.score,
                "passed": a.passed,
                "created_at": _dt(getattr(a, "created_at", None)),
            }
            for a in attempts
        ],
        "certificates": [
            {
                "id": str(c.id),
                "course_id": _uuid(c.course_id),
                "ceu_hours": c.ceu_hours,
                "issued_at": _dt(c.issued_at),
                "expires_at": _dt(c.expires_at),
                "verification_code": c.verification_code,
            }
            for c in certs
        ],
        "xapi_statements": [
            {
                "id": str(x.id),
                "stored_at": _dt(x.stored_at),
                "verb": x.verb,
                "object": x.object_,
            }
            for x in xapi
        ],
        "compliance_audit_log": [
            {
                "id": str(a.id),
                "created_at": _dt(a.created_at),
                "event_type": a.event_type,
                "course_id": _uuid(a.course_id),
                "payload": a.payload,
            }
            for a in audit
        ],
    }


@router.delete("/me/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Anonymize and soft-delete the authenticated user's account (GDPR Art. 17)."""
    anon_email = f"deleted_{user.id}@anonymized.guidian"
    user.email = anon_email
    user.full_name = None
    user.hashed_password = ""
    user.is_active = False

    audit = ComplianceAuditLog(
        actor_user_id=user.id,
        subject_user_id=user.id,
        event_type="account.deletion_requested",
        payload={"anonymized_at": datetime.now(timezone.utc).isoformat()},
    )
    db.add(audit)
    await db.commit()
