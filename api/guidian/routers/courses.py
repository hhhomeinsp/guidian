from uuid import UUID
import boto3
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from guidian.core.config import settings
from guidian.db.session import get_db
from guidian.models.models import Course, Lesson, Module, User, UserRole
from guidian.routers.deps import get_current_user, require_roles
from guidian.schemas.course import (
    CourseCreate,
    CourseDetail,
    CourseRead,
    LessonCreate,
    LessonRead,
    ModuleCreate,
    ModuleRead,
)

router = APIRouter(prefix="/courses", tags=["courses"])


def _author_roles():
    return require_roles(UserRole.admin, UserRole.org_admin, UserRole.instructor)


@router.post("", response_model=CourseRead, status_code=201)
async def create_course(
    body: CourseCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(_author_roles()),
):
    course = Course(
        organization_id=actor.organization_id,
        title=body.title,
        slug=body.slug,
        description=body.description,
        ceu_hours=body.ceu_hours,
        ceu_rules=body.ceu_rules,
        accrediting_body=body.accrediting_body,
        state_approvals=body.state_approvals,
    )
    db.add(course)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Slug already exists for this org")
    await db.refresh(course)
    return course


@router.get("", response_model=list[CourseRead])
async def list_courses(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
):
    rows = (
        await db.execute(select(Course).order_by(Course.created_at.desc()).limit(limit).offset(offset))
    ).scalars().all()
    return rows


@router.get("/{course_id}", response_model=CourseDetail)
async def get_course(course_id: UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    stmt = (
        select(Course)
        .where(Course.id == course_id)
        .options(selectinload(Course.modules).selectinload(Module.lessons))
    )
    course = (await db.execute(stmt)).scalar_one_or_none()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return course


@router.delete("/{course_id}", status_code=204)
async def delete_course(course_id: UUID, db: AsyncSession = Depends(get_db), _: User = Depends(_author_roles())):
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    await db.delete(course)
    await db.commit()


# --- Modules ---

@router.post("/{course_id}/modules", response_model=ModuleRead, status_code=201)
async def add_module(
    course_id: UUID,
    body: ModuleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_author_roles()),
):
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    module = Module(
        course_id=course.id,
        title=body.title,
        description=body.description,
        order_index=body.order_index,
    )
    db.add(module)
    await db.flush()
    for idx, l in enumerate(body.lessons):
        db.add(
            Lesson(
                module_id=module.id,
                title=l.title,
                order_index=l.order_index or idx,
                objectives=l.objectives,
                mdx_content=l.mdx_content,
                diagrams=[d.model_dump() for d in l.diagrams],
                quiz=l.quiz.model_dump(),
                style_tags=list(l.style_tags),
                clock_minutes=l.clock_minutes,
                requires_completion=l.requires_completion,
            )
        )
    await db.commit()
    result = (
        await db.execute(
            select(Module).where(Module.id == module.id).options(selectinload(Module.lessons))
        )
    ).scalar_one()
    return result


@router.delete("/modules/{module_id}", status_code=204)
async def delete_module(
    module_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_author_roles()),
):
    module = (
        await db.execute(
            select(Module).where(Module.id == module_id).options(selectinload(Module.lessons))
        )
    ).scalar_one_or_none()
    if not module:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found")
    await db.delete(module)
    await db.commit()


# --- Lessons ---

@router.post("/modules/{module_id}/lessons", response_model=LessonRead, status_code=201)
async def add_lesson(
    module_id: UUID,
    body: LessonCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_author_roles()),
):
    module = (await db.execute(select(Module).where(Module.id == module_id))).scalar_one_or_none()
    if not module:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found")
    lesson = Lesson(
        module_id=module.id,
        title=body.title,
        order_index=body.order_index,
        objectives=body.objectives,
        mdx_content=body.mdx_content,
        diagrams=[d.model_dump() for d in body.diagrams],
        quiz=body.quiz.model_dump(),
        style_tags=list(body.style_tags),
        clock_minutes=body.clock_minutes,
        requires_completion=body.requires_completion,
    )
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return lesson


@router.delete("/lessons/{lesson_id}", status_code=204)
async def delete_lesson(
    lesson_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_author_roles()),
):
    lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")
    await db.delete(lesson)
    await db.commit()


@router.get("/lessons/{lesson_id}", response_model=LessonRead)
async def get_lesson(lesson_id: UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return lesson


@router.get("/lessons/{lesson_id}/audio")
async def get_lesson_audio(
    lesson_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if not lesson.audio_url:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No audio for this lesson")
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_AUDIO, "Key": lesson.audio_url},
        ExpiresIn=3600,
    )
    return RedirectResponse(url, status_code=302)


@router.get("/lessons/{lesson_id}/audio-url")
async def get_lesson_audio_url(
    lesson_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return presigned audio URL as JSON — avoids CORS issues with browser <audio> elements."""
    lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if not lesson.audio_url:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No audio for this lesson")
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_AUDIO, "Key": lesson.audio_url},
        ExpiresIn=3600,
    )
    return {"url": url}


@router.get("/lessons/{lesson_id}/slides/audio")
async def get_lesson_slide_audio_urls(
    lesson_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Return presigned R2 URLs for each slide's audio, in order.
    Index 0 = title slide, 1..n = content slides.
    Slides with no audio key return null in that position.
    Presigned URLs valid for 2 hours. No auth required.
    """
    lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")

    keys: list[str] = lesson.slide_audio_keys or []
    if not keys:
        return {"slide_audio_urls": []}

    s3 = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )

    slide_audio_urls: list[str | None] = []
    for key in keys:
        if key:
            url = s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.S3_BUCKET_AUDIO, "Key": key},
                ExpiresIn=7200,
            )
            slide_audio_urls.append(url)
        else:
            slide_audio_urls.append(None)

    return {"slide_audio_urls": slide_audio_urls}
