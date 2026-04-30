from __future__ import annotations

import enum
import math
from datetime import datetime
from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from guidian.db.base import Base, TimestampMixin, UUIDMixin


class UserRole(str, enum.Enum):
    learner = "learner"
    instructor = "instructor"
    admin = "admin"
    org_admin = "org_admin"


class Organization(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="organization")
    courses: Mapped[list["Course"]] = relationship(back_populates="organization")


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), default=UserRole.learner, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    organization_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"))

    organization: Mapped[Organization | None] = relationship(back_populates="users")
    profile: Mapped["LearnerProfile | None"] = relationship(back_populates="user", uselist=False)
    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="user")


class LearnerProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "learner_profiles"

    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    vark_scores: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    style_vector: Mapped[list[float] | None] = mapped_column(Vector(16))
    preferences: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    user: Mapped[User] = relationship(back_populates="profile")


class Course(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "courses"

    organization_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    topic_prompt: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)  # draft|generating|published|archived
    ceu_hours: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    ceu_rules: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    accrediting_body: Mapped[str | None] = mapped_column(String(255))
    state_approvals: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    organization: Mapped[Organization | None] = relationship(back_populates="courses")
    modules: Mapped[list["Module"]] = relationship(
        back_populates="course", order_by="Module.order_index", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("organization_id", "slug", name="uq_course_org_slug"),)


class Module(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "modules"

    course_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)

    course: Mapped[Course] = relationship(back_populates="modules")
    lessons: Mapped[list["Lesson"]] = relationship(
        back_populates="module", order_by="Lesson.order_index", cascade="all, delete-orphan"
    )


class Lesson(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "lessons"

    module_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    objectives: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    mdx_content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    audio_url: Mapped[str | None] = mapped_column(String(1024))
    image_url: Mapped[str | None] = mapped_column(String(1024))
    diagrams: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)  # [{id, mermaid, url}]
    quiz: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)  # {questions:[...]}
    style_tags: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)  # ["visual","auditory",...]
    clock_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    requires_completion: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    slide_audio_keys: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=True, default=list)

    module: Mapped[Module] = relationship(back_populates="lessons")


class Enrollment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "enrollments"

    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)  # active|completed|expired
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    progress_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    user: Mapped[User] = relationship(back_populates="enrollments")

    __table_args__ = (UniqueConstraint("user_id", "course_id", name="uq_enrollment_user_course"),)


class LessonProgress(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "lesson_progress"

    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lesson_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    seconds_spent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    variant_served: Mapped[str | None] = mapped_column(String(32))  # visual|auditory|read|kinesthetic
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    behavioral_signals: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    slides_visited: Mapped[list] = mapped_column(JSONB, default=list, nullable=False, server_default="[]")
    time_spent_ms: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False, server_default="0")

    __table_args__ = (UniqueConstraint("user_id", "lesson_id", name="uq_lesson_progress_user_lesson"),)


class QuizAttempt(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "quiz_attempts"

    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lesson_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)  # 0..1, equivalent to score_pct
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    answers: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False, server_default="1")


class ExamAttempt(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "exam_attempts"

    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    score_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    answers: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    questions: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)  # snapshot of served questions
    passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    time_spent_ms: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ComplianceAuditLog(Base, UUIDMixin):
    """Append-only. No UPDATE or DELETE. Enforced at DB level via trigger."""
    __tablename__ = "compliance_audit_log"

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actor_user_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True))
    subject_user_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True))
    course_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True))
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    prev_hash: Mapped[str | None] = mapped_column(String(128))
    entry_hash: Mapped[str | None] = mapped_column(String(128))


class Certificate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "certificates"

    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    pdf_url: Mapped[str | None] = mapped_column(String(1024))
    ceu_hours: Mapped[float] = mapped_column(Float, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)


class CEURule(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ceu_rules"

    course_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    total_ceu_hours: Mapped[float] = mapped_column(Float, nullable=False)
    min_passing_score: Mapped[float] = mapped_column(Float, default=0.7, nullable=False)
    requires_proctoring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_identity_verification: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    state_approvals: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    accrediting_body: Mapped[str | None] = mapped_column(String(255))
    min_clock_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    certificate_valid_days: Mapped[int | None] = mapped_column(Integer)


class XAPIStatement(Base, UUIDMixin):
    __tablename__ = "xapi_statements"

    stored_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    actor: Mapped[dict] = mapped_column(JSONB, nullable=False)
    verb: Mapped[dict] = mapped_column(JSONB, nullable=False)
    object_: Mapped[dict] = mapped_column("object", JSONB, nullable=False)
    result: Mapped[dict | None] = mapped_column(JSONB)
    context: Mapped[dict | None] = mapped_column(JSONB)
    raw: Mapped[dict] = mapped_column(JSONB, nullable=False)


class AIGenerationJob(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ai_generation_jobs"

    requested_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    course_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False, index=True)
    # pending|running|succeeded|failed|cancelled
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    params: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    result: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    celery_task_id: Mapped[str | None] = mapped_column(String(128))

    __table_args__ = (CheckConstraint("attempts >= 0", name="ck_ai_job_attempts"),)


class CourseOpportunity(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "course_opportunities"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    profession: Mapped[str] = mapped_column(String(128), nullable=False)
    target_states: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    ceu_hours: Mapped[float] = mapped_column(Float, nullable=False)
    estimated_license_holders: Mapped[int] = mapped_column(Integer, nullable=False)
    renewal_frequency_years: Mapped[float] = mapped_column(Float, nullable=False)
    avg_price_per_hour: Mapped[float] = mapped_column(Float, nullable=False)
    competition_level: Mapped[str] = mapped_column(String(16), nullable=False)  # low|medium|high
    content_reuse_score: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-10
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pipeline")  # pipeline|in_progress|published|skipped
    course_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    @property
    def annual_addressable_market(self) -> float:
        return self.estimated_license_holders * (1 / self.renewal_frequency_years) * self.ceu_hours * self.avg_price_per_hour

    @property
    def roi_score(self) -> float:
        aam = self.annual_addressable_market
        if aam <= 0:
            market_score = 0.0
        else:
            market_score = math.log10(aam) / 7.0
        competition_map = {"low": 1.0, "medium": 0.6, "high": 0.3}
        competition_score = competition_map.get(self.competition_level, 0.5)
        raw = (0.4 * market_score) + (0.3 * competition_score) + (0.3 * self.content_reuse_score / 10.0)
        return round(min(raw, 1.0) * 100, 1)


class StateRequirement(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "state_requirements"

    state_code: Mapped[str] = mapped_column(String(2), nullable=False)
    profession: Mapped[str] = mapped_column(String(128), nullable=False)
    regulatory_body: Mapped[str] = mapped_column(String(255), nullable=False)
    regulatory_url: Mapped[str] = mapped_column(String(512), nullable=False)
    provider_app_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    course_app_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    application_fee: Mapped[float | None] = mapped_column(Float, nullable=True)
    renewal_period_years: Mapped[float] = mapped_column(Float, nullable=False)
    online_allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    proctoring_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    min_passing_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.70)
    min_seat_time_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    submission_format: Mapped[str] = mapped_column(String(32), nullable=False)  # pdf_email|online_portal|mail
    processing_days: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("state_code", "profession", name="uq_state_req_state_profession"),)


class LearnerMemory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "learner_memories"

    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    profession: Mapped[str | None] = mapped_column(String(128))
    license_state: Mapped[str | None] = mapped_column(String(4))
    license_type: Mapped[str | None] = mapped_column(String(64))
    renewal_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    long_term_summary: Mapped[str | None] = mapped_column(Text)
    session_notes: Mapped[str | None] = mapped_column(Text)
    strengths: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, server_default="{}")
    struggle_areas: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, server_default="{}")
    learning_goals: Mapped[str | None] = mapped_column(Text)
    personality_notes: Mapped[str | None] = mapped_column(Text)
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    vark_style: Mapped[str | None] = mapped_column(String(16))
    total_sessions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_session_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship()


class TeacherSession(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "teacher_sessions"

    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    messages: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    session_summary: Mapped[str | None] = mapped_column(Text)
    session_type: Mapped[str] = mapped_column(String(32), default="chat", nullable=False)
    course_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("courses.id", ondelete="SET NULL"))
    tokens_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    user: Mapped["User"] = relationship()


class Subscription(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "subscriptions"

    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(128))
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(128))
    plan: Mapped[str] = mapped_column(String(32), default="free", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    org_seat_count: Mapped[int | None] = mapped_column(Integer)
    nova_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")

    user: Mapped["User"] = relationship()


class CoursePurchase(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "course_purchases"

    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(Text)
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(Text)
    amount_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(Text, default="pending", nullable=False)  # pending|completed|refunded

    __table_args__ = (UniqueConstraint("user_id", "course_id", name="uq_course_purchase_user_course"),)


class ComplianceSubmission(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "compliance_submissions"

    course_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    state_code: Mapped[str] = mapped_column(String(2), nullable=False)
    profession: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")  # draft|submitted|under_review|approved|rejected|expired
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approval_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    course: Mapped["Course"] = relationship(lazy="select")
