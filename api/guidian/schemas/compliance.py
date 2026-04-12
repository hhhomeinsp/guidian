from uuid import UUID
from pydantic import BaseModel, Field
from typing import Literal


CheckStatus = Literal["passed", "failed", "pending", "not_applicable"]


class ComplianceCheck(BaseModel):
    id: str
    label: str
    status: CheckStatus
    detail: str | None = None


class ComplianceDecision(BaseModel):
    user_id: UUID
    course_id: UUID
    eligible: bool
    ceu_hours_awarded: float
    certificate_valid_days: int | None = None
    min_passing_score: float
    min_clock_minutes: int
    requires_proctoring: bool
    requires_identity_verification: bool
    state_approvals: list[dict] = Field(default_factory=list)
    accrediting_body: str | None = None
    checks: list[ComplianceCheck]
    blockers: list[str] = Field(default_factory=list)
