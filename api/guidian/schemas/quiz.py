from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

# Answer shapes mirror the three question types:
#   single_choice    -> int
#   multiple_choice  -> list[int]
#   true_false       -> bool
Answer = int | list[int] | bool


class QuizAttemptRequest(BaseModel):
    # question_id -> answer
    answers: dict[str, Answer] = Field(default_factory=dict)


class QuestionResult(BaseModel):
    question_id: str
    correct: bool
    explanation: str | None = None
    correct_answer: Answer | None = None


class QuizAttemptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    lesson_id: UUID
    score: float
    passed: bool
    created_at: datetime
    # Per-question feedback is computed at submission time and not persisted
    # beyond the raw answers JSON — client receives it once on the response.
    per_question: list[QuestionResult] = Field(default_factory=list)


class QuizAttemptsSummary(BaseModel):
    best_score: float
    passed: bool
    attempt_count: int
    min_passing_score: float
