"""Final exam endpoints — aggregate per-lesson quiz questions, score against
the stored set, and trigger certificate issuance on a passing attempt."""
from __future__ import annotations

import random
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import (
    Certificate,
    ComplianceAuditLog,
    Course,
    Enrollment,
    ExamAttempt,
    Lesson,
    LessonProgress,
    Module,
    User,
)
from guidian.routers.deps import get_current_user
from guidian.schemas.exam import (
    ExamAttemptRead,
    ExamQuestionPublic,
    ExamQuestionsRead,
    ExamStatusRead,
    ExamSubmitRequest,
)

router = APIRouter(prefix="/courses", tags=["exam"])


EXAM_PASSING_SCORE = 0.75
EXAM_TIME_LIMIT_SECONDS = 90 * 60  # 90 minutes
MAX_EXAM_QUESTIONS = 50


async def _course_or_404(db: AsyncSession, course_id: UUID) -> Course:
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    return course


async def _course_lessons(db: AsyncSession, course_id: UUID) -> list[Lesson]:
    stmt = (
        select(Lesson)
        .join(Module, Module.id == Lesson.module_id)
        .where(Module.course_id == course_id)
    )
    return list((await db.execute(stmt)).scalars().all())


async def _exam_unlocked(db: AsyncSession, user_id: UUID, lessons: list[Lesson]) -> tuple[bool, int, int]:
    """Returns (unlocked, completed_count, total_count). Unlocked = every
    lesson with `requires_completion` has lesson_progress.completed_at set."""
    required = [l for l in lessons if l.requires_completion]
    if not required:
        return True, 0, 0
    lesson_ids = [l.id for l in required]
    progress_rows = (
        await db.execute(
            select(LessonProgress).where(
                LessonProgress.user_id == user_id,
                LessonProgress.lesson_id.in_(lesson_ids),
            )
        )
    ).scalars().all()
    completed = sum(1 for p in progress_rows if p.completed_at is not None)
    return completed >= len(required), completed, len(required)


def _aggregate_questions(lessons: list[Lesson]) -> list[dict]:
    """Flatten all quiz questions across all lessons. Each question retains
    its full payload (correct field included) — this is the *server* view."""
    out: list[dict] = []
    for l in lessons:
        quiz = l.quiz or {}
        for q in quiz.get("questions", []) or []:
            if not isinstance(q, dict) or not q.get("id"):
                continue
            out.append(dict(q))
    return out


def _shuffle_question(q: dict, rng: random.Random) -> dict:
    """Return a copy of `q` with its choice order shuffled and the `correct`
    indices remapped accordingly. Leaves true_false questions unchanged."""
    new_q = dict(q)
    if q.get("type") == "true_false":
        return new_q
    choices = list(q.get("choices") or [])
    if len(choices) <= 1:
        return new_q
    order = list(range(len(choices)))
    rng.shuffle(order)
    new_choices = [choices[i] for i in order]
    new_q["choices"] = new_choices
    # Remap `correct` from old indices to new indices
    correct = q.get("correct")
    if isinstance(correct, list):
        index_map = {old: new for new, old in enumerate(order)}
        new_q["correct"] = sorted(index_map[c] for c in correct if c in index_map)
    elif isinstance(correct, int):
        index_map = {old: new for new, old in enumerate(order)}
        new_q["correct"] = index_map.get(correct, correct)
    return new_q


def _strip_correct(q: dict) -> ExamQuestionPublic:
    return ExamQuestionPublic(
        id=str(q.get("id")),
        type=q.get("type", "single_choice"),
        prompt=q.get("prompt", ""),
        choices=list(q.get("choices") or []),
        explanation=q.get("explanation"),
    )


def _answer_matches(question_type: str, correct, answer) -> bool:
    if answer is None:
        return False
    if question_type == "true_false":
        return bool(answer) == bool(correct)
    if question_type == "single_choice":
        expected = correct[0] if isinstance(correct, list) else correct
        try:
            return int(answer) == int(expected)
        except (TypeError, ValueError):
            return False
    if question_type == "multiple_choice":
        if not isinstance(answer, list):
            return False
        expected_list = correct if isinstance(correct, list) else [correct]
        return sorted(int(x) for x in answer) == sorted(int(x) for x in expected_list)
    return False


@router.get("/{course_id}/exam/questions", response_model=ExamQuestionsRead)
async def get_exam_questions(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = await _course_or_404(db, course_id)
    lessons = await _course_lessons(db, course_id)
    unlocked, _, _ = await _exam_unlocked(db, user.id, lessons)
    if not unlocked:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Complete all lessons before starting the final exam",
        )

    pool = _aggregate_questions(lessons)
    if not pool:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Course has no quiz questions")

    rng = random.Random()
    rng.shuffle(pool)
    sampled = pool[:MAX_EXAM_QUESTIONS]
    shuffled = [_shuffle_question(q, rng) for q in sampled]
    public = [_strip_correct(q) for q in shuffled]

    # Stash the served question set on a fresh draft attempt so we score against
    # the same shuffled order on submit.
    draft = ExamAttempt(
        user_id=user.id,
        course_id=course.id,
        score_pct=0.0,
        passed=False,
        questions=shuffled,
        answers={},
        attempt_number=0,  # placeholder; finalized on submit
        time_spent_ms=0,
        started_at=datetime.now(timezone.utc),
    )
    db.add(draft)
    await db.commit()

    return ExamQuestionsRead(
        course_id=course.id,
        questions=public,
        passing_score=EXAM_PASSING_SCORE,
        time_limit_seconds=EXAM_TIME_LIMIT_SECONDS,
    )


def _grade_against(stored_questions: list[dict], answers: dict) -> tuple[float, int, int]:
    if not stored_questions:
        return 0.0, 0, 0
    correct_count = 0
    for q in stored_questions:
        qid = str(q.get("id"))
        qtype = q.get("type", "single_choice")
        if _answer_matches(qtype, q.get("correct"), answers.get(qid)):
            correct_count += 1
    total = len(stored_questions)
    return (correct_count / total if total else 0.0), correct_count, total


@router.post("/{course_id}/exam/submit", response_model=ExamAttemptRead, status_code=201)
async def submit_exam(
    course_id: UUID,
    body: ExamSubmitRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = await _course_or_404(db, course_id)

    enrollment = (
        await db.execute(
            select(Enrollment).where(
                Enrollment.user_id == user.id, Enrollment.course_id == course.id
            )
        )
    ).scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not enrolled in this course")

    # Pull the most recent draft (questions stashed at /questions time)
    draft = (
        await db.execute(
            select(ExamAttempt)
            .where(
                ExamAttempt.user_id == user.id,
                ExamAttempt.course_id == course.id,
                ExamAttempt.completed_at.is_(None),
            )
            .order_by(ExamAttempt.started_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if draft is None or not (draft.questions or []):
        # Fallback: regenerate from current lesson set (less accurate but functional)
        lessons = await _course_lessons(db, course_id)
        stored = _aggregate_questions(lessons)
        if not stored:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No questions to grade")
    else:
        stored = list(draft.questions)

    score, correct_count, total_count = _grade_against(stored, body.answers)
    passed = score >= EXAM_PASSING_SCORE

    prior_count = (
        await db.execute(
            select(func.count(ExamAttempt.id)).where(
                ExamAttempt.user_id == user.id,
                ExamAttempt.course_id == course.id,
                ExamAttempt.completed_at.is_not(None),
            )
        )
    ).scalar_one()
    attempt_number = int(prior_count) + 1

    now = datetime.now(timezone.utc)
    if draft is not None:
        draft.score_pct = score
        draft.passed = passed
        draft.answers = body.answers
        draft.time_spent_ms = int(body.time_spent_ms or 0)
        draft.attempt_number = attempt_number
        draft.completed_at = now
        attempt = draft
    else:
        attempt = ExamAttempt(
            user_id=user.id,
            course_id=course.id,
            score_pct=score,
            passed=passed,
            answers=body.answers,
            questions=stored,
            attempt_number=attempt_number,
            time_spent_ms=int(body.time_spent_ms or 0),
            started_at=now,
            completed_at=now,
        )
        db.add(attempt)

    db.add(
        ComplianceAuditLog(
            actor_user_id=user.id,
            subject_user_id=user.id,
            course_id=course.id,
            event_type="exam.attempted",
            payload={
                "score_pct": score,
                "passed": passed,
                "attempt_number": attempt_number,
                "time_spent_ms": int(body.time_spent_ms or 0),
            },
        )
    )
    if passed:
        db.add(
            ComplianceAuditLog(
                actor_user_id=user.id,
                subject_user_id=user.id,
                course_id=course.id,
                event_type="exam.passed",
                payload={"score_pct": score, "attempt_number": attempt_number},
            )
        )

    await db.commit()
    await db.refresh(attempt)

    certificate_url: str | None = None
    certificate_id: UUID | None = None
    if passed:
        existing_cert = (
            await db.execute(
                select(Certificate).where(
                    Certificate.user_id == user.id, Certificate.course_id == course.id
                )
            )
        ).scalar_one_or_none()
        if existing_cert:
            certificate_id = existing_cert.id
            certificate_url = existing_cert.pdf_url

    return ExamAttemptRead(
        id=attempt.id,
        user_id=attempt.user_id,
        course_id=attempt.course_id,
        score_pct=attempt.score_pct,
        passed=attempt.passed,
        attempt_number=attempt.attempt_number,
        time_spent_ms=attempt.time_spent_ms,
        started_at=attempt.started_at,
        completed_at=attempt.completed_at,
        correct_count=correct_count,
        total_count=total_count,
        certificate_url=certificate_url,
        certificate_id=certificate_id,
    )


@router.get("/{course_id}/exam/status", response_model=ExamStatusRead)
async def exam_status(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = await _course_or_404(db, course_id)
    lessons = await _course_lessons(db, course_id)
    unlocked, completed, total = await _exam_unlocked(db, user.id, lessons)

    rows = (
        await db.execute(
            select(
                func.coalesce(func.max(ExamAttempt.score_pct), 0.0),
                func.coalesce(func.bool_or(ExamAttempt.passed), False),
                func.count(ExamAttempt.id),
            ).where(
                ExamAttempt.user_id == user.id,
                ExamAttempt.course_id == course.id,
                ExamAttempt.completed_at.is_not(None),
            )
        )
    ).one()
    best_score, passed, attempt_count = rows

    last = (
        await db.execute(
            select(ExamAttempt)
            .where(
                ExamAttempt.user_id == user.id,
                ExamAttempt.course_id == course.id,
                ExamAttempt.completed_at.is_not(None),
            )
            .order_by(ExamAttempt.completed_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    last_read: ExamAttemptRead | None = None
    if last is not None:
        last_read = ExamAttemptRead(
            id=last.id,
            user_id=last.user_id,
            course_id=last.course_id,
            score_pct=last.score_pct,
            passed=last.passed,
            attempt_number=last.attempt_number,
            time_spent_ms=last.time_spent_ms,
            started_at=last.started_at,
            completed_at=last.completed_at,
            correct_count=0,
            total_count=len(last.questions or []),
        )

    return ExamStatusRead(
        course_id=course.id,
        unlocked=unlocked,
        lessons_total=total,
        lessons_completed=completed,
        attempt_count=int(attempt_count),
        best_score=float(best_score),
        passed=bool(passed),
        passing_score=EXAM_PASSING_SCORE,
        last_attempt=last_read,
    )
