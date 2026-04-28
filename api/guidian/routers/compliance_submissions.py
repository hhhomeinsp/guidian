from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import ComplianceSubmission, Course, StateRequirement, UserRole
from guidian.routers.deps import require_roles
from guidian.schemas.compliance_submissions import (
    StateRequirementRead,
    SubmissionCreate,
    SubmissionRead,
    SubmissionUpdate,
)
from guidian.services.compliance.pack_generator import generate_compliance_pack

router = APIRouter(prefix="/compliance", tags=["compliance-submissions"])


def _admin_dep():
    return require_roles(UserRole.admin, UserRole.org_admin)


@router.get("/states", response_model=list[StateRequirementRead])
async def list_state_requirements(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(StateRequirement))).scalars().all()
    return rows


@router.get("/states/{state_code}/{profession}", response_model=StateRequirementRead)
async def get_state_requirement(state_code: str, profession: str, db: AsyncSession = Depends(get_db)):
    req = (
        await db.execute(
            select(StateRequirement).where(
                StateRequirement.state_code == state_code.upper(),
                StateRequirement.profession == profession,
            )
        )
    ).scalar_one_or_none()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "State requirement not found")
    return req


@router.get("/courses/{course_id}/pack/{state_code}", dependencies=[Depends(_admin_dep())])
async def download_compliance_pack(course_id: UUID, state_code: str, db: AsyncSession = Depends(get_db)):
    try:
        zip_bytes = await generate_compliance_pack(course_id, state_code.upper(), db)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))

    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    safe_title = (course.title if course else str(course_id)).replace(" ", "_")[:40]
    filename = f"compliance_pack_{safe_title}_{state_code.upper()}.zip"

    return StreamingResponse(
        iter([zip_bytes]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/submissions", response_model=list[SubmissionRead], dependencies=[Depends(_admin_dep())])
async def list_submissions(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(ComplianceSubmission))).scalars().all()
    result = []
    for row in rows:
        data = SubmissionRead.model_validate(row)
        if row.course_id:
            course = (await db.execute(select(Course).where(Course.id == row.course_id))).scalar_one_or_none()
            if course:
                data.course_title = course.title
        result.append(data)
    return result


@router.post("/submissions", response_model=SubmissionRead, status_code=201, dependencies=[Depends(_admin_dep())])
async def create_submission(body: SubmissionCreate, db: AsyncSession = Depends(get_db)):
    course = (await db.execute(select(Course).where(Course.id == body.course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    sub = ComplianceSubmission(**body.model_dump())
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    data = SubmissionRead.model_validate(sub)
    data.course_title = course.title
    return data


@router.patch("/submissions/{submission_id}", response_model=SubmissionRead, dependencies=[Depends(_admin_dep())])
async def update_submission(submission_id: UUID, body: SubmissionUpdate, db: AsyncSession = Depends(get_db)):
    sub = (await db.execute(select(ComplianceSubmission).where(ComplianceSubmission.id == submission_id))).scalar_one_or_none()
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(sub, field, value)
    await db.commit()
    await db.refresh(sub)
    data = SubmissionRead.model_validate(sub)
    course = (await db.execute(select(Course).where(Course.id == sub.course_id))).scalar_one_or_none()
    if course:
        data.course_title = course.title
    return data
