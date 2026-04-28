from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class StateRequirementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    state_code: str
    profession: str
    regulatory_body: str
    regulatory_url: str
    provider_app_url: Optional[str]
    course_app_url: Optional[str]
    application_fee: Optional[float]
    renewal_period_years: float
    online_allowed: bool
    proctoring_required: bool
    min_passing_score: float
    min_seat_time_minutes: Optional[int]
    submission_format: str
    processing_days: int
    notes: Optional[str]


class SubmissionCreate(BaseModel):
    course_id: UUID
    state_code: str
    profession: str
    notes: Optional[str] = None


class SubmissionUpdate(BaseModel):
    status: Optional[str] = None
    approval_number: Optional[str] = None
    notes: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class SubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    course_id: UUID
    state_code: str
    profession: str
    status: str
    submitted_at: Optional[datetime]
    approved_at: Optional[datetime]
    expires_at: Optional[datetime]
    approval_number: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    course_title: Optional[str] = None
