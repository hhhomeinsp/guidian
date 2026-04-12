from uuid import UUID
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

LearningStyle = Literal["visual", "auditory", "read", "kinesthetic"]


class LearnerProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    vark_scores: dict
    style_vector: list[float] | None
    preferences: dict
    preferred_style: LearningStyle
    created_at: datetime
    updated_at: datetime


class LearnerProfileUpdate(BaseModel):
    preferences: dict | None = None


class VARKAnswer(BaseModel):
    question_id: str
    style: LearningStyle


class VARKSubmission(BaseModel):
    answers: list[VARKAnswer] = Field(min_length=1)


class BehavioralSignal(BaseModel):
    lesson_id: UUID | None = None
    variant: LearningStyle
    event: Literal["dwell", "switch", "replay"]
    seconds: int = Field(default=0, ge=0)


class BehavioralSignalBatch(BaseModel):
    signals: list[BehavioralSignal] = Field(min_length=1, max_length=50)
