from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class OpportunityCreate(BaseModel):
    title: str
    profession: str
    target_states: list[str]
    ceu_hours: float
    estimated_license_holders: int
    renewal_frequency_years: float
    avg_price_per_hour: float
    competition_level: str
    content_reuse_score: int
    status: str = "pipeline"
    course_id: Optional[UUID] = None
    notes: Optional[str] = None


class OpportunityUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    course_id: Optional[UUID] = None
    competition_level: Optional[str] = None
    content_reuse_score: Optional[int] = None


class OpportunityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    profession: str
    target_states: list[str]
    ceu_hours: float
    estimated_license_holders: int
    renewal_frequency_years: float
    avg_price_per_hour: float
    competition_level: str
    content_reuse_score: int
    status: str
    course_id: Optional[UUID]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    annual_addressable_market: float
    roi_score: float
