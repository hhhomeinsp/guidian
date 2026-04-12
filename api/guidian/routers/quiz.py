from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import (
    ComplianceAuditLog,
    Course,
    Enrollment,
    Lesson,
    LessonProgress,
    Module,
    QuizAttempt,
    User,
)
from guidian.routers.deps import get_current_user
from guidian.schemas.quiz import (
    QuizAttemptRead,
    QuizAttemptRequest,
    QuizAttemptsSummary,
)
from guidian.services.learner_profile import apply_quiz_result, get_or_create_profile
from guidian.services.quiz_scoring import score_quiz
from guidian.services.xapi import statements as xapi_stmt
from guidian.services.xapi.emitter import emit_async as emit_xapi

router = APIRouter(prefix="/lessons", tags=["quiz"])

DEFAULT_MIN_PASSING_SCORE = 0.7


async def _get_lesson_and_course(db: AsyncSession, lesson_id: UUID):
    lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")
    module = (await db.execute(select(Module).where(Module.id == lesson.module_id))).scalar_one()
    course = (await db.execute(select(Course).where(Course.id == module.course_id))).scalar_one()
    return lesson, module, course


def _min_passing_score(course: Course) -> float:
    rules = course.ceu_rules or {}
    try:
        return float(rules.get("min_passing_score", DEFAULT_MIN_PASSING_SCORE))
    except (TypeError, ValueError):
        return DEFAULT_MIN_PASSING_SCORE


@router.post("/{lesson_id}/quiz/attempts", response_model=QuizAttemptRead, status_code=201)
async def submit_quiz_attempt(
    lesson_id: UUID,
    body: QuizAttemptRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lesson, module, course = await _get_lesson_and_course(db, lesson_id)

    # Must be enrolled
    enrollment = (
        await db.execute(
            select(Enrollment).where(
                Enrollment.user_id == user.id, Enrollment.course_id == course.id
            )
        )
    ).scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not enrolled in this course")

    quiz_payload = lesson.quiz or {}
    if not quiz_payload.get("questions"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lesson has no quiz")

    score, per_question = score_quiz(quiz_payload, body.answers)
    min_passing = _min_passing_score(course)
    passed = score >= min_passing

    attempt = QuizAttempt(
        user_id=user.id,
        lesson_id=lesson.id,
        score=score,
        passed=passed,
        answers=body.answers,
    )
    db.add(attempt)

    # Audit every attempt; flag passing attempts separately.
    db.add(
        ComplianceAuditLog(
            actor_user_id=user.id,
            subject_user_id=user.id,
            course_id=course.id,
            event_type="quiz.attempted",
            payload={
                "lesson_id": str(lesson.id),
                "score": score,
                "passed": passed,
                "min_passing_score": min_passing,
            },
        )
    )
    if passed:
        db.add(
            ComplianceAuditLog(
                actor_user_id=user.id,
                subject_user_id=user.id,
                course_id=course.id,
                event_type="quiz.passed",
                payload={"lesson_id": str(lesson.id), "score": score},
            )
        )

    # xAPI: attempted + (passed|failed) on the lesson activity
    await emit_xapi(db, xapi_stmt.quiz_attempted(user, lesson, course, score, passed))
    await emit_xapi(db, xapi_stmt.quiz_outcome(user, lesson, course, score, passed))

    # Feed quiz performance into the learner style vector, keyed on the
    # variant the learner was viewing when the quiz was served.
    progress = (
        await db.execute(
            select(LessonProgress).where(
                LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson.id
            )
        )
    ).scalar_one_or_none()
    variant_served = progress.variant_served if progress and progress.variant_served else None
    if variant_served:
        profile = await get_or_create_profile(db, user.id)
        profile.style_vector = apply_quiz_result(
            list(profile.style_vector) if profile.style_vector is not None else None,
            variant=variant_served,  # type: ignore[arg-type]
            score=score,
        )

    await db.commit()
    await db.refresh(attempt)

    return QuizAttemptRead(
        id=attempt.id,
        user_id=attempt.user_id,
        lesson_id=attempt.lesson_id,
        score=attempt.score,
        passed=attempt.passed,
        created_at=attempt.created_at,
        per_question=per_question,
    )


@router.get("/{lesson_id}/quiz/summary", response_model=QuizAttemptsSummary)
async def quiz_summary(
    lesson_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _, _, course = await _get_lesson_and_course(db, lesson_id)
    rows = (
        await db.execute(
            select(
                func.coalesce(func.max(QuizAttempt.score), 0.0),
                func.coalesce(func.bool_or(QuizAttempt.passed), False),
                func.count(QuizAttempt.id),
            ).where(
                QuizAttempt.user_id == user.id,
                QuizAttempt.lesson_id == lesson_id,
            )
        )
    ).one()
    best_score, passed, attempt_count = rows
    return QuizAttemptsSummary(
        best_score=float(best_score),
        passed=bool(passed),
        attempt_count=int(attempt_count),
        min_passing_score=_min_passing_score(course),
    )
