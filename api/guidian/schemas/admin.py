from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    actor_user_id: UUID | None
    subject_user_id: UUID | None
    course_id: UUID | None
    event_type: str
    payload: dict


class CEURuleCreate(BaseModel):
    course_id: UUID
    total_ceu_hours: float = Field(ge=0.0)
    min_passing_score: float = Field(default=0.7, ge=0.0, le=1.0)
    requires_proctoring: bool = False
    requires_identity_verification: bool = False
    state_approvals: list[dict] = Field(default_factory=list)
    accrediting_body: str | None = None
    min_clock_minutes: int = Field(default=0, ge=0)
    certificate_valid_days: int | None = None


class CEURuleUpdate(BaseModel):
    total_ceu_hours: float | None = None
    min_passing_score: float | None = None
    requires_proctoring: bool | None = None
    requires_identity_verification: bool | None = None
    state_approvals: list[dict] | None = None
    accrediting_body: str | None = None
    min_clock_minutes: int | None = None
    certificate_valid_days: int | None = None


class CEURuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    course_id: UUID
    total_ceu_hours: float
    min_passing_score: float
    requires_proctoring: bool
    requires_identity_verification: bool
    state_approvals: list
    accrediting_body: str | None
    min_clock_minutes: int
    certificate_valid_days: int | None
    created_at: datetime


class AdminMetrics(BaseModel):
    users_total: int
    learners_total: int
    courses_total: int
    courses_published: int
    enrollments_total: int
    certificates_issued: int
    ai_jobs_pending: int
    ai_jobs_failed: int
    audit_events_24h: int


class AIJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: str
    course_id: UUID | None
    requested_by: UUID | None
    prompt: str
    error: str | None
    attempts: int
    created_at: datetime
    updated_at: datetime
