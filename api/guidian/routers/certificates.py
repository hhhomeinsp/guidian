from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import Certificate, ComplianceAuditLog, Course, User
from guidian.routers.deps import get_current_user
from guidian.schemas.certificate import CertificateRead
from guidian.services.certificates.issuer import generate_verification_code
from guidian.services.certificates.storage import presigned_download_url
from guidian.services.compliance.engine import evaluate_course_completion

router = APIRouter(tags=["certificates"])


def _to_read(cert: Certificate) -> CertificateRead:
    metadata = cert.metadata_ or {}
    status_str = metadata.get("status") or ("issued" if cert.pdf_url else "pending")
    download = None
    s3_key = metadata.get("s3_key")
    if status_str == "issued" and s3_key:
        try:
            download = presigned_download_url(s3_key)
        except Exception:
            download = None
    return CertificateRead(
        id=cert.id,
        user_id=cert.user_id,
        course_id=cert.course_id,
        ceu_hours=cert.ceu_hours,
        issued_at=cert.issued_at,
        expires_at=cert.expires_at,
        verification_code=cert.verification_code,
        pdf_url=cert.pdf_url,
        status=status_str,  # type: ignore[arg-type]
        download_url=download,
    )


@router.post(
    "/courses/{course_id}/certificates/issue",
    response_model=CertificateRead,
    status_code=status.HTTP_202_ACCEPTED,
)
async def issue_certificate(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    # Idempotent: return the existing cert if the learner already has one for this course
    existing = (
        await db.execute(
            select(Certificate).where(
                Certificate.user_id == user.id, Certificate.course_id == course.id
            )
        )
    ).scalar_one_or_none()
    if existing:
        return _to_read(existing)

    # Gate on the compliance engine — authoritative green light
    decision = await evaluate_course_completion(db, user.id, course)
    if not decision.eligible:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "message": "Course requirements not met",
                "blockers": decision.blockers,
                "checks": [c.model_dump() for c in decision.checks],
            },
        )

    cert = Certificate(
        user_id=user.id,
        course_id=course.id,
        ceu_hours=decision.ceu_hours_awarded,
        verification_code=generate_verification_code(),
        metadata_={"status": "pending"},
    )
    if decision.certificate_valid_days:
        from datetime import datetime, timedelta, timezone

        cert.expires_at = datetime.now(timezone.utc) + timedelta(days=decision.certificate_valid_days)
    db.add(cert)

    db.add(
        ComplianceAuditLog(
            actor_user_id=user.id,
            subject_user_id=user.id,
            course_id=course.id,
            event_type="certificate.requested",
            payload={"ceu_hours": decision.ceu_hours_awarded},
        )
    )
    await db.commit()
    await db.refresh(cert)

    # Enqueue the PDF render on the Celery worker (lazy import to avoid pulling
    # the worker module into every API request's dependency graph).
    from guidian.workers.tasks import generate_certificate as generate_certificate_task

    async_result = generate_certificate_task.delay(str(cert.id))
    metadata = dict(cert.metadata_ or {})
    metadata["celery_task_id"] = async_result.id
    cert.metadata_ = metadata
    await db.commit()
    await db.refresh(cert)
    return _to_read(cert)


class VerifyResponse(BaseModel):
    valid: bool
    learner_name: str
    course_title: str
    ceu_hours: float
    completion_date: str
    accrediting_body: str | None


@router.get("/certificates/verify/{verification_code}", response_model=VerifyResponse)
async def verify_certificate(
    verification_code: str,
    db: AsyncSession = Depends(get_db),
):
    cert = (
        await db.execute(
            select(Certificate).where(Certificate.verification_code == verification_code)
        )
    ).scalar_one_or_none()
    if not cert:
        return VerifyResponse(
            valid=False,
            learner_name="",
            course_title="",
            ceu_hours=0.0,
            completion_date="",
            accrediting_body=None,
        )
    user = (await db.execute(select(User).where(User.id == cert.user_id))).scalar_one_or_none()
    course = (await db.execute(select(Course).where(Course.id == cert.course_id))).scalar_one_or_none()
    meta = cert.metadata_ or {}
    return VerifyResponse(
        valid=meta.get("status") == "issued",
        learner_name=(user.full_name or user.email) if user else "",
        course_title=course.title if course else "",
        ceu_hours=cert.ceu_hours,
        completion_date=meta.get("completion_date") or cert.issued_at.date().isoformat(),
        accrediting_body=course.accrediting_body if course else None,
    )


@router.get("/certificates/me", response_model=list[CertificateRead])
async def my_certificates(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        await db.execute(
            select(Certificate)
            .where(Certificate.user_id == user.id)
            .order_by(Certificate.issued_at.desc())
        )
    ).scalars().all()
    return [_to_read(c) for c in rows]


@router.get("/certificates/{certificate_id}", response_model=CertificateRead)
async def get_certificate(
    certificate_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cert = (
        await db.execute(select(Certificate).where(Certificate.id == certificate_id))
    ).scalar_one_or_none()
    if not cert or cert.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate not found")
    return _to_read(cert)
