from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import AIGenerationJob, User, UserRole
from guidian.routers.deps import require_roles
from guidian.schemas.course import CourseGenerationRequest, GenerationJobRead

router = APIRouter(prefix="/ai/courses", tags=["ai"])


def _author_roles():
    return require_roles(UserRole.admin, UserRole.org_admin, UserRole.instructor)


@router.post("/generate", response_model=GenerationJobRead, status_code=202)
async def generate_course(
    body: CourseGenerationRequest,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(_author_roles()),
):
    # Lazy import so Celery/broker isn't required to import the router at app startup
    from guidian.workers.tasks import generate_course as generate_course_task

    job = AIGenerationJob(
        requested_by=actor.id,
        prompt=body.prompt,
        params={
            "target_audience": body.target_audience,
            "compliance_requirement": body.compliance_requirement,
            "ceu_hours": body.ceu_hours,
            "num_modules": body.num_modules,
            "lessons_per_module": body.lessons_per_module,
            "accrediting_body": body.accrediting_body,
            "organization_id": str(actor.organization_id) if actor.organization_id else None,
        },
        status="pending",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    async_result = generate_course_task.delay(str(job.id))
    job.celery_task_id = async_result.id
    await db.commit()
    await db.refresh(job)
    return job


@router.get("/jobs/{job_id}", response_model=GenerationJobRead)
async def get_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_author_roles()),
):
    job = (await db.execute(select(AIGenerationJob).where(AIGenerationJob.id == job_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return job
