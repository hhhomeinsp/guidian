"""
Certificate issuance orchestration.

All writes on the issuance path must land in a single DB transaction:
  - update Certificate.pdf_url + metadata.status
  - append compliance_audit_log entry `certificate.issued`

The append-only trigger from migration 0001 still protects the audit log.
"""
from __future__ import annotations

import secrets
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from guidian.models.models import Certificate, ComplianceAuditLog, Course, User
from guidian.services.certificates.pdf import render_html_to_pdf
from guidian.services.certificates.storage import upload_certificate_pdf
from guidian.services.certificates.template import build_certificate_html
from guidian.services.xapi import statements as xapi_stmt
from guidian.services.xapi.emitter import emit_sync as emit_xapi_sync


# Intentionally excludes 0/O/1/I/L to reduce verification-code confusion.
_VC_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_verification_code() -> str:
    left = "".join(secrets.choice(_VC_ALPHABET) for _ in range(4))
    right = "".join(secrets.choice(_VC_ALPHABET) for _ in range(4))
    return f"GD-{left}-{right}"


def _s3_key(cert: Certificate) -> str:
    return f"{cert.user_id}/{cert.id}.pdf"


def render_and_persist_certificate(db: Session, certificate_id: UUID) -> Certificate:
    """
    Synchronous worker-side entry point. Loads the pending Certificate row,
    renders the PDF, uploads to S3, updates the row, and appends an audit
    event — all in a single DB transaction.
    """
    cert = db.execute(select(Certificate).where(Certificate.id == certificate_id)).scalar_one()
    course = db.execute(select(Course).where(Course.id == cert.course_id)).scalar_one()
    user = db.execute(select(User).where(User.id == cert.user_id)).scalar_one()

    html = build_certificate_html(
        learner_name=user.full_name or user.email,
        course_title=course.title,
        ceu_hours=cert.ceu_hours,
        issued_at=cert.issued_at,
        verification_code=cert.verification_code,
        accrediting_body=course.accrediting_body,
    )

    try:
        pdf_bytes = render_html_to_pdf(html)
        key = _s3_key(cert)
        uri = upload_certificate_pdf(pdf_bytes, key)
        cert.pdf_url = uri
        metadata = dict(cert.metadata_ or {})
        metadata["s3_key"] = key
        metadata["status"] = "issued"
        metadata["byte_length"] = len(pdf_bytes)
        cert.metadata_ = metadata

        db.add(
            ComplianceAuditLog(
                actor_user_id=cert.user_id,
                subject_user_id=cert.user_id,
                course_id=cert.course_id,
                event_type="certificate.issued",
                payload={
                    "certificate_id": str(cert.id),
                    "verification_code": cert.verification_code,
                    "ceu_hours": cert.ceu_hours,
                    "s3_key": key,
                },
            )
        )
        # xAPI: earned(certificate)
        emit_xapi_sync(db, xapi_stmt.certificate_earned(user, cert, course))
        db.commit()
        return cert
    except Exception as e:
        db.rollback()
        # Re-fetch after rollback
        cert = db.execute(
            select(Certificate).where(Certificate.id == certificate_id)
        ).scalar_one()
        metadata = dict(cert.metadata_ or {})
        metadata["status"] = "failed"
        metadata["error"] = str(e)[:2000]
        cert.metadata_ = metadata
        db.add(
            ComplianceAuditLog(
                actor_user_id=cert.user_id,
                subject_user_id=cert.user_id,
                course_id=cert.course_id,
                event_type="certificate.failed",
                payload={"certificate_id": str(cert.id), "error": str(e)[:500]},
            )
        )
        db.commit()
        raise
