from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import (
    ComplianceAuditLog,
    Course,
    CoursePurchase,
    Enrollment,
    Lesson,
    LessonProgress,
    Module,
    QuizAttempt,
    User,
    UserRole,
)  # noqa: F401 — Course imported for xAPI statement context
from guidian.routers.deps import get_current_user
from guidian.schemas.enrollment import (
    EnrollmentCreate,
    EnrollmentRead,
    LessonProgressRead,
    LessonProgressUpdate,
)
from guidian.services.learner_profile import (
    apply_completion,
    apply_signal,
    get_or_create_profile,
)
from guidian.services.xapi import statements as xapi_stmt
from guidian.services.xapi.emitter import emit_async as emit_xapi

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


@router.post("", response_model=EnrollmentRead, status_code=201)
async def enroll(
    body: EnrollmentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = (await db.execute(select(Course).where(Course.id == body.course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    # Gate enrollment on a completed course purchase. Admins bypass — they
    # need access for QA and content review without paying for every course.
    if user.role != UserRole.admin:
        purchase = (
            await db.execute(
                select(CoursePurchase).where(
                    CoursePurchase.user_id == user.id,
                    CoursePurchase.course_id == course.id,
                    CoursePurchase.status == "completed",
                )
            )
        ).scalar_one_or_none()
        if purchase is None:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "code": "purchase_required",
                    "checkout_url": "/billing/course/checkout",
                    "course_id": str(course.id),
                },
            )

    enrollment = Enrollment(user_id=user.id, course_id=course.id)
    db.add(enrollment)
    # Append audit log in the same transaction (non-negotiable)
    db.add(
        ComplianceAuditLog(
            actor_user_id=user.id,
            subject_user_id=user.id,
            course_id=course.id,
            event_type="enrollment.created",
            payload={"course_slug": course.slug, "course_title": course.title},
        )
    )
    await emit_xapi(db, xapi_stmt.registered(user, course))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Already enrolled")
    await db.refresh(enrollment)
    return enrollment


@router.get("/me", response_model=list[EnrollmentRead])
async def my_enrollments(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        await db.execute(
            select(Enrollment)
            .where(Enrollment.user_id == user.id)
            .order_by(Enrollment.started_at.desc())
        )
    ).scalars().all()
    return rows


# --- Lesson progress ---

progress_router = APIRouter(prefix="/lessons", tags=["progress"])


@progress_router.put("/{lesson_id}/progress", response_model=LessonProgressRead)
async def upsert_progress(
    lesson_id: UUID,
    body: LessonProgressUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")

    # Ensure enrollment exists for this lesson's course
    module = (await db.execute(select(Module).where(Module.id == lesson.module_id))).scalar_one()
    enrollment = (
        await db.execute(
            select(Enrollment).where(
                Enrollment.user_id == user.id, Enrollment.course_id == module.course_id
            )
        )
    ).scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not enrolled in this course")

    progress = (
        await db.execute(
            select(LessonProgress).where(
                LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson.id
            )
        )
    ).scalar_one_or_none()

    if progress is None:
        progress = LessonProgress(user_id=user.id, lesson_id=lesson.id)
        db.add(progress)

    seconds_delta = 0
    if body.seconds_spent is not None and body.seconds_spent > progress.seconds_spent:
        seconds_delta = body.seconds_spent - progress.seconds_spent
        progress.seconds_spent = body.seconds_spent
    if body.variant_served is not None:
        progress.variant_served = body.variant_served
    if body.behavioral_signals is not None:
        merged = {**progress.behavioral_signals, **body.behavioral_signals}
        progress.behavioral_signals = merged

    # Feed a dwell-time signal into the learner style vector when we have both
    # the active variant and meaningful time delta. Cheap enough to run inline.
    if seconds_delta > 0 and progress.variant_served:
        profile = await get_or_create_profile(db, user.id)
        vector = list(profile.style_vector) if profile.style_vector is not None else None
        profile.style_vector = apply_signal(
            vector,
            variant=progress.variant_served,  # type: ignore[arg-type]
            event="dwell",
            seconds=seconds_delta,
        )

    audit_events: list[ComplianceAuditLog] = []
    if body.completed and not progress.completed:
        # Gate completion: if the lesson has a quiz, require at least one passing attempt.
        has_quiz = bool((lesson.quiz or {}).get("questions"))
        if has_quiz:
            passing = (
                await db.execute(
                    select(QuizAttempt).where(
                        QuizAttempt.user_id == user.id,
                        QuizAttempt.lesson_id == lesson.id,
                        QuizAttempt.passed.is_(True),
                    ).limit(1)
                )
            ).scalar_one_or_none()
            if not passing:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    "Lesson completion requires a passing quiz attempt",
                )
        progress.completed = True
        progress.completed_at = datetime.now(timezone.utc)
        # Feed completion_rate dim 12..15 when we know the variant served
        if progress.variant_served:
            profile_for_completion = await get_or_create_profile(db, user.id)
            profile_for_completion.style_vector = apply_completion(
                list(profile_for_completion.style_vector) if profile_for_completion.style_vector is not None else None,
                variant=progress.variant_served,  # type: ignore[arg-type]
            )
        audit_events.append(
            ComplianceAuditLog(
                actor_user_id=user.id,
                subject_user_id=user.id,
                course_id=module.course_id,
                event_type="lesson.completed",
                payload={
                    "lesson_id": str(lesson.id),
                    "seconds_spent": progress.seconds_spent,
                    "variant_served": progress.variant_served,
                },
            )
        )
        # xAPI: completed(lesson)
        course_for_stmt = (
            await db.execute(select(Course).where(Course.id == module.course_id))
        ).scalar_one()
        await emit_xapi(
            db,
            xapi_stmt.lesson_completed(
                user, lesson, course_for_stmt, progress.seconds_spent or 0
            ),
        )

    for ev in audit_events:
        db.add(ev)
    await db.commit()
    await db.refresh(progress)
    return progress


@progress_router.get("/{lesson_id}/progress", response_model=LessonProgressRead | None)
async def get_progress(
    lesson_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    progress = (
        await db.execute(
            select(LessonProgress).where(
                LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson_id
            )
        )
    ).scalar_one_or_none()
    return progress
