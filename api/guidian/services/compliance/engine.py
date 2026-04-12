"""
Compliance rules engine.

Loads the effective CEU rule for a course (preferring a row in `ceu_rules`,
falling back to the `courses.ceu_rules` JSONB blob), then validates a learner's
completion record against it. Produces a `ComplianceDecision` with a structured
check list so the frontend can render per-requirement status without having to
re-derive anything.

This engine is the authoritative gate for certificate issuance (step 12).
"""
from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from guidian.models.models import (
    CEURule,
    Course,
    Enrollment,
    Lesson,
    LessonProgress,
    Module,
    QuizAttempt,
)
from guidian.schemas.compliance import ComplianceCheck, ComplianceDecision


DEFAULT_MIN_PASSING_SCORE = 0.7


@dataclass
class EffectiveRule:
    total_ceu_hours: float
    min_passing_score: float
    requires_proctoring: bool
    requires_identity_verification: bool
    state_approvals: list[dict]
    accrediting_body: str | None
    min_clock_minutes: int
    certificate_valid_days: int | None


async def _load_effective_rule(db: AsyncSession, course: Course) -> EffectiveRule:
    row = (
        await db.execute(select(CEURule).where(CEURule.course_id == course.id).limit(1))
    ).scalar_one_or_none()
    if row is not None:
        return EffectiveRule(
            total_ceu_hours=row.total_ceu_hours,
            min_passing_score=row.min_passing_score,
            requires_proctoring=row.requires_proctoring,
            requires_identity_verification=row.requires_identity_verification,
            state_approvals=list(row.state_approvals or []),
            accrediting_body=row.accrediting_body,
            min_clock_minutes=row.min_clock_minutes,
            certificate_valid_days=row.certificate_valid_days,
        )

    # Fallback: pull from the course JSONB blob + course columns
    blob = course.ceu_rules or {}
    return EffectiveRule(
        total_ceu_hours=float(blob.get("total_ceu_hours", course.ceu_hours or 0.0)),
        min_passing_score=float(blob.get("min_passing_score", DEFAULT_MIN_PASSING_SCORE)),
        requires_proctoring=bool(blob.get("requires_proctoring", False)),
        requires_identity_verification=bool(blob.get("requires_identity_verification", False)),
        state_approvals=list(blob.get("state_approvals", course.state_approvals or [])),
        accrediting_body=blob.get("accrediting_body", course.accrediting_body),
        min_clock_minutes=int(blob.get("min_clock_minutes", 0)),
        certificate_valid_days=blob.get("certificate_valid_days"),
    )


async def _load_course_lessons(db: AsyncSession, course_id: UUID) -> list[Lesson]:
    stmt = (
        select(Lesson)
        .join(Module, Module.id == Lesson.module_id)
        .where(Module.course_id == course_id)
        .options(selectinload(Lesson.module))
    )
    return list((await db.execute(stmt)).scalars().all())


async def evaluate_course_completion(
    db: AsyncSession, user_id: UUID, course: Course
) -> ComplianceDecision:
    rule = await _load_effective_rule(db, course)
    lessons = await _load_course_lessons(db, course.id)
    lesson_ids = [l.id for l in lessons]
    required_lessons = [l for l in lessons if l.requires_completion]

    progress_rows = (
        await db.execute(
            select(LessonProgress).where(
                LessonProgress.user_id == user_id,
                LessonProgress.lesson_id.in_(lesson_ids) if lesson_ids else False,
            )
        )
    ).scalars().all() if lesson_ids else []
    progress_by_lesson = {p.lesson_id: p for p in progress_rows}

    quiz_rows = (
        await db.execute(
            select(QuizAttempt).where(
                QuizAttempt.user_id == user_id,
                QuizAttempt.lesson_id.in_(lesson_ids) if lesson_ids else False,
            )
        )
    ).scalars().all() if lesson_ids else []
    attempts_by_lesson: dict[UUID, list[QuizAttempt]] = {}
    for a in quiz_rows:
        attempts_by_lesson.setdefault(a.lesson_id, []).append(a)

    checks: list[ComplianceCheck] = []
    blockers: list[str] = []

    # 1. Enrollment
    enrollment = (
        await db.execute(
            select(Enrollment).where(
                Enrollment.user_id == user_id, Enrollment.course_id == course.id
            )
        )
    ).scalar_one_or_none()
    checks.append(
        ComplianceCheck(
            id="enrollment",
            label="Enrolled in course",
            status="passed" if enrollment else "failed",
            detail=None if enrollment else "Learner must be enrolled before receiving credit.",
        )
    )
    if not enrollment:
        blockers.append("Not enrolled")

    # 2. All required lessons complete
    incomplete = [l for l in required_lessons if not (progress_by_lesson.get(l.id) and progress_by_lesson[l.id].completed)]
    checks.append(
        ComplianceCheck(
            id="lessons_completed",
            label=f"All required lessons completed ({len(required_lessons) - len(incomplete)}/{len(required_lessons)})",
            status="passed" if not incomplete else "failed",
            detail=None if not incomplete else f"{len(incomplete)} lesson(s) incomplete.",
        )
    )
    if incomplete:
        blockers.append(f"{len(incomplete)} lesson(s) incomplete")

    # 3. Seat time
    total_seconds = sum((p.seconds_spent or 0) for p in progress_rows)
    seat_required = rule.min_clock_minutes * 60
    if seat_required > 0:
        checks.append(
            ComplianceCheck(
                id="min_clock_time",
                label=f"Minimum seat time ({rule.min_clock_minutes} min)",
                status="passed" if total_seconds >= seat_required else "failed",
                detail=f"{total_seconds // 60} min recorded.",
            )
        )
        if total_seconds < seat_required:
            blockers.append(
                f"Seat time {total_seconds // 60} min < required {rule.min_clock_minutes} min"
            )
    else:
        checks.append(
            ComplianceCheck(
                id="min_clock_time",
                label="Minimum seat time",
                status="not_applicable",
                detail="No seat time minimum configured.",
            )
        )

    # 4. Every lesson with a quiz has a passing attempt + aggregate score >= min_passing_score
    quiz_lessons = [l for l in lessons if (l.quiz or {}).get("questions")]
    lessons_missing_pass: list[Lesson] = []
    best_scores: list[float] = []
    for l in quiz_lessons:
        attempts = attempts_by_lesson.get(l.id, [])
        if not attempts:
            lessons_missing_pass.append(l)
            continue
        best = max(a.score for a in attempts)
        best_scores.append(best)
        if not any(a.passed for a in attempts):
            lessons_missing_pass.append(l)

    if quiz_lessons:
        checks.append(
            ComplianceCheck(
                id="quizzes_passed",
                label=f"All quizzes passed ({len(quiz_lessons) - len(lessons_missing_pass)}/{len(quiz_lessons)})",
                status="passed" if not lessons_missing_pass else "failed",
                detail=None if not lessons_missing_pass else f"{len(lessons_missing_pass)} lesson(s) without a passing attempt.",
            )
        )
        if lessons_missing_pass:
            blockers.append(f"{len(lessons_missing_pass)} quiz(zes) without a passing attempt")

        avg_best = sum(best_scores) / len(best_scores) if best_scores else 0.0
        checks.append(
            ComplianceCheck(
                id="avg_score_threshold",
                label=f"Average best score ≥ {int(rule.min_passing_score * 100)}%",
                status="passed" if avg_best >= rule.min_passing_score else "failed",
                detail=f"Current average: {int(avg_best * 100)}%.",
            )
        )
        if avg_best < rule.min_passing_score:
            blockers.append(
                f"Average best score {int(avg_best * 100)}% < {int(rule.min_passing_score * 100)}%"
            )
    else:
        checks.append(
            ComplianceCheck(
                id="quizzes_passed",
                label="Quiz requirements",
                status="not_applicable",
                detail="No quiz questions in this course.",
            )
        )

    # 5. Proctoring / identity verification — external, learner self-service not supported
    if rule.requires_proctoring:
        checks.append(
            ComplianceCheck(
                id="proctoring",
                label="Proctored session verified",
                status="pending",
                detail="This course requires a proctored session. Contact your administrator.",
            )
        )
        blockers.append("Proctored session not verified")
    if rule.requires_identity_verification:
        checks.append(
            ComplianceCheck(
                id="identity_verification",
                label="Identity verified",
                status="pending",
                detail="This course requires identity verification. Contact your administrator.",
            )
        )
        blockers.append("Identity verification pending")

    eligible = not blockers
    return ComplianceDecision(
        user_id=user_id,
        course_id=course.id,
        eligible=eligible,
        ceu_hours_awarded=rule.total_ceu_hours if eligible else 0.0,
        certificate_valid_days=rule.certificate_valid_days,
        min_passing_score=rule.min_passing_score,
        min_clock_minutes=rule.min_clock_minutes,
        requires_proctoring=rule.requires_proctoring,
        requires_identity_verification=rule.requires_identity_verification,
        state_approvals=rule.state_approvals,
        accrediting_body=rule.accrediting_body,
        checks=checks,
        blockers=blockers,
    )
