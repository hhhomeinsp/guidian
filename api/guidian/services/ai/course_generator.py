from __future__ import annotations

from uuid import UUID
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from guidian.models.models import AIGenerationJob, Course, Lesson, Module
from guidian.schemas.course import AICourseSpec
from guidian.services.ai.claude_client import ClaudeClient
from guidian.services.ai.prompts import COURSE_GENERATION_SYSTEM_PROMPT, build_user_prompt


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
