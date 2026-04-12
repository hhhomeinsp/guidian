from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Literal


class EnrollmentCreate(BaseModel):
    course_id: UUID


class EnrollmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    course_id: UUID
    status: str
    started_at: datetime
    completed_at: datetime | None
    progress_pct: float


class LessonProgressUpdate(BaseModel):
    seconds_spent: int | None = Field(default=None, ge=0)
    variant_served: Literal["visual", "auditory", "read", "kinesthetic"] | None = None
    completed: bool | None = None
    behavioral_signals: dict | None = None


class LessonProgressRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    lesson_id: UUID
    seconds_spent: int
    variant_served: str | None
    completed: bool
    completed_at: datetime | None
    behavioral_signals: dict
