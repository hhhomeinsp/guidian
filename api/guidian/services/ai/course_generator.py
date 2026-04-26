from __future__ import annotations

import logging
from uuid import UUID
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from guidian.models.models import AIGenerationJob, Course, Lesson, Module
from guidian.schemas.course import (
    AICourseOutlineSpec,
    AICourseSpec,
    AILessonSpec,
    AIModuleValidationResult,
)
from guidian.services.ai.claude_client import ClaudeClient
from guidian.services.ai.prompts import (
    COURSE_GENERATION_SYSTEM_PROMPT,
    MODULE_VALIDATOR_SYSTEM_PROMPT,
    MODULE_WRITER_SYSTEM_PROMPT,
    OUTLINE_SYSTEM_PROMPT,
    build_module_validator_user_prompt,
    build_module_writer_user_prompt,
    build_outline_user_prompt,
    build_user_prompt,
)

logger = logging.getLogger(__name__)


class CourseGenerationError(Exception):
    pass


def run_course_generation(job_id: UUID, db: Session) -> UUID:
    """
    Synchronous course-generation pipeline invoked from a Celery worker.

    1. Load the job
    2. Call Claude with the structured system prompt
    3. Validate JSON against AICourseSpec (Pydantic)
    4. Persist Course + Modules + Lessons
    5. Update job with course_id + succeeded status
    """
    job = db.execute(select(AIGenerationJob).where(AIGenerationJob.id == job_id)).scalar_one()
    job.status = "running"
    job.attempts += 1
    db.commit()

    try:
        params = job.params or {}
        user_prompt = build_user_prompt(
            prompt=job.prompt,
            target_audience=params.get("target_audience"),
            compliance_requirement=params.get("compliance_requirement"),
            ceu_hours=float(params.get("ceu_hours", 1.0)),
            num_modules=int(params.get("num_modules", 3)),
            lessons_per_module=int(params.get("lessons_per_module", 3)),
            accrediting_body=params.get("accrediting_body"),
        )
        raw = ClaudeClient().generate_json(COURSE_GENERATION_SYSTEM_PROMPT, user_prompt)

        try:
            spec = AICourseSpec.model_validate(raw)
        except ValidationError as ve:
            raise CourseGenerationError(f"AI output failed schema validation: {ve}") from ve

        course = Course(
            organization_id=params.get("organization_id"),
            title=spec.title,
            slug=spec.slug,
            description=spec.description,
            topic_prompt=job.prompt,
            status="published",
            ceu_hours=spec.ceu_hours,
            accrediting_body=spec.accrediting_body,
            state_approvals=params.get("state_approvals", []),
            ceu_rules={"total_ceu_hours": spec.ceu_hours, "min_passing_score": 0.7},
        )
        db.add(course)
        db.flush()

        for m_idx, m in enumerate(spec.modules):
            module = Module(
                course_id=course.id,
                title=m.title,
                description=m.description,
                order_index=m_idx,
            )
            db.add(module)
            db.flush()
            for l_idx, l in enumerate(m.lessons):
                db.add(
                    Lesson(
                        module_id=module.id,
                        title=l.title,
                        order_index=l_idx,
                        objectives=list(l.objectives),
                        mdx_content=l.mdx_content,
                        diagrams=[d.model_dump() for d in l.diagrams],
                        quiz=l.quiz.model_dump(),
                        style_tags=list(l.style_tags),
                        clock_minutes=l.clock_minutes,
                    )
                )

        job.course_id = course.id
        job.status = "succeeded"
        job.result = {"course_id": str(course.id), "modules": len(spec.modules)}
        db.commit()
        return course.id

    except Exception as e:  # noqa: BLE001
        db.rollback()
        # Re-fetch the job since rollback expired state
        job = db.execute(select(AIGenerationJob).where(AIGenerationJob.id == job_id)).scalar_one()
        job.status = "failed"
        job.error = str(e)[:4000]
        db.commit()
        raise


# ── Large-course multi-agent pipeline ────────────────────────────────────────


def run_large_course_generation(
    job_id: UUID, db: Session
) -> tuple[UUID, list[tuple[UUID, dict, dict]]]:
    """
    Phase 1 of the large-course pipeline.

    1. Generate a full course outline (skeleton only — no lesson content).
    2. Persist the Course record and empty Module shells.
    3. Return (course_id, [(module_id, module_outline_dict, course_context_dict), ...])
       for the caller to fan-out into parallel module-writer tasks.
    """
    job = db.execute(select(AIGenerationJob).where(AIGenerationJob.id == job_id)).scalar_one()
    job.status = "running"
    job.attempts += 1
    db.commit()

    try:
        params = job.params or {}
        user_prompt = build_outline_user_prompt(
            prompt=job.prompt,
            target_audience=params.get("target_audience"),
            compliance_requirement=params.get("compliance_requirement"),
            ceu_hours=float(params.get("ceu_hours", 10.0)),
            num_modules=int(params.get("num_modules", 10)),
            lessons_per_module=int(params.get("lessons_per_module", 5)),
            accrediting_body=params.get("accrediting_body"),
        )
        raw = ClaudeClient().generate_json(OUTLINE_SYSTEM_PROMPT, user_prompt, max_tokens=8000)

        try:
            outline = AICourseOutlineSpec.model_validate(raw)
        except ValidationError as ve:
            raise CourseGenerationError(f"Outline failed schema validation: {ve}") from ve

        course = Course(
            organization_id=params.get("organization_id"),
            title=outline.title,
            slug=outline.slug,
            description=outline.description,
            topic_prompt=job.prompt,
            status="generating",
            ceu_hours=outline.ceu_hours,
            accrediting_body=outline.accrediting_body,
            state_approvals=params.get("state_approvals", []),
            ceu_rules={"total_ceu_hours": outline.ceu_hours, "min_passing_score": 0.7},
        )
        db.add(course)
        db.flush()

        course_context = {
            "course_title": outline.title,
            "course_description": outline.description,
            "target_audience": params.get("target_audience") or "licensed professionals in the field",
            "total_modules": len(outline.modules),
        }

        module_specs: list[tuple[UUID, dict, dict]] = []
        for idx, m in enumerate(outline.modules):
            module = Module(
                course_id=course.id,
                title=m.title,
                description=m.description,
                order_index=idx,
            )
            db.add(module)
            db.flush()
            prior_titles = [outline.modules[i].title for i in range(idx)]
            module_specs.append((
                module.id,
                {
                    "module_index": idx,
                    "module_title": m.title,
                    "module_description": m.description,
                    "lessons": [l.model_dump() for l in m.lessons],
                    "prior_module_titles": prior_titles,
                },
                course_context,
            ))

        job.result = {"course_id": str(course.id), "total_modules": len(outline.modules)}
        db.commit()
        logger.info("Outline complete for job %s — %d modules", job_id, len(outline.modules))
        return course.id, module_specs

    except Exception as e:  # noqa: BLE001
        db.rollback()
        job = db.execute(select(AIGenerationJob).where(AIGenerationJob.id == job_id)).scalar_one()
        job.status = "failed"
        job.error = str(e)[:4000]
        db.commit()
        raise


def generate_module_content(
    module_id: UUID,
    module_outline: dict,
    course_context: dict,
    db: Session,
) -> None:
    """
    Phase 2+3 per-module worker: write full lesson content, validate, retry once on failure.
    Persists lessons directly to the DB module.
    """
    client = ClaudeClient()
    validation_feedback: list[str] | None = None

    for attempt in range(2):
        user_prompt = build_module_writer_user_prompt(
            course_title=course_context["course_title"],
            course_description=course_context["course_description"],
            target_audience=course_context["target_audience"],
            module_index=module_outline["module_index"],
            total_modules=course_context["total_modules"],
            module_title=module_outline["module_title"],
            module_description=module_outline.get("module_description"),
            lessons=module_outline["lessons"],
            prior_module_titles=module_outline.get("prior_module_titles", []),
            validation_feedback=validation_feedback,
        )
        raw_module = client.generate_json(
            MODULE_WRITER_SYSTEM_PROMPT, user_prompt, max_tokens=16000
        )

        # Validate the generated module
        validator_prompt = build_module_validator_user_prompt(
            course_title=course_context["course_title"],
            target_audience=course_context["target_audience"],
            module_title=module_outline["module_title"],
            module_content=raw_module,
        )
        raw_validation = client.generate_json(
            MODULE_VALIDATOR_SYSTEM_PROMPT, validator_prompt, max_tokens=2000
        )

        try:
            validation = AIModuleValidationResult.model_validate(raw_validation)
        except ValidationError:
            validation = AIModuleValidationResult(passed=True)

        if validation.passed or attempt == 1:
            if not validation.passed:
                logger.warning(
                    "Module %s still has issues after retry — publishing anyway: %s",
                    module_id,
                    validation.issues,
                )
            _persist_module_lessons(module_id, raw_module, db)
            return

        logger.info(
            "Module %s failed validation (attempt %d), retrying with feedback: %s",
            module_id,
            attempt + 1,
            validation.issues,
        )
        validation_feedback = validation.issues

    # Should not reach here, but safety net
    _persist_module_lessons(module_id, raw_module, db)  # type: ignore[possibly-undefined]


def _persist_module_lessons(module_id: UUID, raw_module: dict, db: Session) -> None:
    raw_lessons: list[dict] = raw_module.get("lessons", [])
    for idx, raw_lesson in enumerate(raw_lessons):
        try:
            lesson_spec = AILessonSpec.model_validate(raw_lesson)
        except ValidationError as e:
            logger.warning("Lesson %d in module %s failed validation: %s", idx, module_id, e)
            continue
        db.add(
            Lesson(
                module_id=module_id,
                title=lesson_spec.title,
                order_index=idx,
                objectives=list(lesson_spec.objectives),
                mdx_content=lesson_spec.mdx_content,
                diagrams=[d.model_dump() for d in lesson_spec.diagrams],
                quiz=lesson_spec.quiz.model_dump(),
                style_tags=list(lesson_spec.style_tags),
                clock_minutes=lesson_spec.clock_minutes,
            )
        )
    db.commit()


def finalize_large_course(course_id: UUID, job_id: UUID, db: Session) -> None:
    """Mark the course as published and the generation job as succeeded."""
    from guidian.models.models import Course as CourseModel

    course = db.get(CourseModel, course_id)
    if course:
        course.status = "published"

    job = db.execute(select(AIGenerationJob).where(AIGenerationJob.id == job_id)).scalar_one_or_none()
    if job:
        job.status = "succeeded"
        existing = job.result or {}
        job.result = {**existing, "course_id": str(course_id)}

    db.commit()
