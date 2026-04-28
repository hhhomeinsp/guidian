from uuid import UUID
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class QuizQuestion(BaseModel):
    id: str
    type: Literal["single_choice", "multiple_choice", "true_false"]
    prompt: str
    choices: list[str] = Field(default_factory=list)
    correct: list[int] | int | bool
    explanation: str | None = None


class QuizPayload(BaseModel):
    questions: list[QuizQuestion] = Field(default_factory=list)


class Diagram(BaseModel):
    id: str
    mermaid: str
    url: str | None = None


class LessonCreate(BaseModel):
    title: str
    order_index: int
    objectives: list[str] = Field(default_factory=list)
    mdx_content: str = ""
    diagrams: list[Diagram] = Field(default_factory=list)
    quiz: QuizPayload = Field(default_factory=QuizPayload)
    style_tags: list[Literal["visual", "auditory", "read", "kinesthetic"]] = Field(default_factory=list)
    clock_minutes: int = 0
    requires_completion: bool = True


class LessonRead(LessonCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    module_id: UUID
    audio_url: str | None = None
    image_url: str | None = None
    transcript: str | None = None
    version: int


class ModuleCreate(BaseModel):
    title: str
    description: str | None = None
    order_index: int
    lessons: list[LessonCreate] = Field(default_factory=list)


class ModuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    course_id: UUID
    title: str
    description: str | None
    order_index: int
    lessons: list[LessonRead] = Field(default_factory=list)


class CourseCreate(BaseModel):
    title: str
    slug: str = Field(pattern=r"^[a-z0-9-]+$")
    description: str | None = None
    ceu_hours: float = 0.0
    accrediting_body: str | None = None
    state_approvals: list[dict] = Field(default_factory=list)
    ceu_rules: dict = Field(default_factory=dict)


class CourseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID | None
    title: str
    slug: str
    description: str | None
    status: str
    ceu_hours: float
    ceu_rules: dict
    accrediting_body: str | None
    state_approvals: list
    version: int
    created_at: datetime


class CourseDetail(CourseRead):
    modules: list[ModuleRead] = Field(default_factory=list)


# --- AI generation ---
class CourseGenerationRequest(BaseModel):
    prompt: str = Field(min_length=10, description="Topic/regulation/objective")
    target_audience: str | None = None
    compliance_requirement: str | None = None
    ceu_hours: float = Field(ge=0.25, le=200.0, default=1.0)
    num_modules: int = Field(ge=1, le=60, default=3)
    lessons_per_module: int = Field(ge=1, le=20, default=3)
    accrediting_body: str | None = None
    use_large_pipeline: bool = Field(
        default=False,
        description="Use multi-agent parallel pipeline for courses > 10 CEU hours",
    )


class GenerationJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: str
    course_id: UUID | None
    error: str | None
    attempts: int
    created_at: datetime


# --- AI raw course JSON schema (what Claude must return) ---

# Large-course outline specs (Phase 1 — no lesson content, titles + objectives only)
class AIOutlineLessonSpec(BaseModel):
    title: str
    objectives: list[str]
    clock_minutes: int = 30


class AIOutlineModuleSpec(BaseModel):
    title: str
    description: str | None = None
    lessons: list[AIOutlineLessonSpec]


class AICourseOutlineSpec(BaseModel):
    title: str
    slug: str = Field(pattern=r"^[a-z0-9-]+$")
    description: str
    ceu_hours: float
    accrediting_body: str | None = None
    modules: list[AIOutlineModuleSpec]


class AIModuleValidationResult(BaseModel):
    passed: bool
    issues: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class AILessonSpec(BaseModel):
    title: str
    objectives: list[str]
    mdx_content: str
    style_tags: list[Literal["visual", "auditory", "read", "kinesthetic"]] = Field(default_factory=list)
    diagrams: list[Diagram] = Field(default_factory=list)
    quiz: QuizPayload = Field(default_factory=QuizPayload)
    clock_minutes: int = 10


class AIModuleSpec(BaseModel):
    title: str
    description: str | None = None
    lessons: list[AILessonSpec]


class AICourseSpec(BaseModel):
    title: str
    slug: str = Field(pattern=r"^[a-z0-9-]+$")
    description: str
    ceu_hours: float
    accrediting_body: str | None = None
    modules: list[AIModuleSpec]
