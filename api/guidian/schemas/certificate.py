from uuid import UUID
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict

CertificateStatus = Literal["pending", "issued", "failed"]


class CertificateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    course_id: UUID
    ceu_hours: float
    issued_at: datetime
    expires_at: datetime | None
    verification_code: str
    pdf_url: str | None
    status: CertificateStatus
    download_url: str | None = None


class CertificateIssueResponse(BaseModel):
    certificate: CertificateRead
