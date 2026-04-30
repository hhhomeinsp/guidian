from uuid import UUID
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


# Answer shapes mirror the three question types
ExamAnswer = int | list[int] | bool


class ExamQuestionPublic(BaseModel):
    """Question shape served to learners — `correct` field is intentionally omitted."""
    id: str
    type: Literal["single_choice", "multiple_choice", "true_false"]
    prompt: str
    choices: list[str] = Field(default_factory=list)
    explanation: str | None = None


class ExamQuestionsRead(BaseModel):
    course_id: UUID
    questions: list[ExamQuestionPublic]
    passing_score: float = 0.75
    time_limit_seconds: int = 90 * 60


class ExamSubmitRequest(BaseModel):
    answers: dict[str, ExamAnswer] = Field(default_factory=dict)
    time_spent_ms: int = 0


class ExamAttemptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    course_id: UUID
    score_pct: float
    passed: bool
    attempt_number: int
    time_spent_ms: int
    started_at: datetime
    completed_at: datetime | None
    correct_count: int = 0
    total_count: int = 0
    certificate_url: str | None = None
    certificate_id: UUID | None = None


class ExamStatusRead(BaseModel):
    course_id: UUID
    unlocked: bool
    lessons_total: int
    lessons_completed: int
    attempt_count: int
    best_score: float
    passed: bool
    passing_score: float
    last_attempt: ExamAttemptRead | None = None
