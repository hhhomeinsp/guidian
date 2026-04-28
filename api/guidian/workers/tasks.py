from __future__ import annotations

from uuid import UUID

from celery import chord
from celery import group as celery_group
from celery.utils.log import get_task_logger
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from guidian.core.config import settings
from guidian.services.ai.course_generator import (
    CourseGenerationError,
    finalize_large_course,
    generate_module_content,
    run_course_generation,
    run_large_course_generation,
)
from guidian.workers.celery_app import celery_app

logger = get_task_logger(__name__)

_sync_engine = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True, future=True)
SyncSessionLocal = sessionmaker(bind=_sync_engine, expire_on_commit=False, class_=Session)


@celery_app.task(
    name="guidian.workers.tasks.generate_course",
    bind=True,
    autoretry_for=(CourseGenerationError,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
    acks_late=True,
)
def generate_course(self, job_id: str) -> str:
    logger.info("Generating course for job %s (attempt %s)", job_id, self.request.retries + 1)
    with SyncSessionLocal() as db:
        course_id = run_course_generation(UUID(job_id), db)
        synthesize_lesson_slides.delay(str(course_id))
        generate_lesson_images.delay(str(course_id))
        return str(course_id)


@celery_app.task(
    name="guidian.workers.tasks.synthesize_lesson_slides",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=3,
    acks_late=True,
)
def synthesize_lesson_slides(self, course_id: str) -> None:
    """Synthesize per-slide audio for all lessons in a course."""
    from guidian.models.models import Lesson, Module, Course
    from guidian.services.media.tts import synthesize_lesson_slides as tts_synthesize_slides

    logger.info("Per-slide TTS pipeline starting for course %s", course_id)
    with SyncSessionLocal() as db:
        lessons = (
            db.execute(
                select(Lesson)
                .join(Module, Lesson.module_id == Module.id)
                .join(Course, Module.course_id == Course.id)
                .where(Course.id == UUID(course_id))
                .order_by(Module.order_index, Lesson.order_index)
            )
            .scalars()
            .all()
        )
        for lesson in lessons:
            if lesson.slide_audio_keys:
                continue
            try:
                tts_synthesize_slides(
                    lesson.id,
                    lesson.title,
                    list(lesson.objectives or []),
                    lesson.mdx_content,
                    db,
                )
                logger.info("Slide audio generated for lesson %s", lesson.id)
            except Exception as exc:
                logger.warning("Slide TTS failed for lesson %s: %s", lesson.id, exc)


@celery_app.task(
    name="guidian.workers.tasks.synthesize_lesson_audio",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=3,
    acks_late=True,
)
def synthesize_lesson_audio(self, course_id: str) -> None:
    """Deprecated: use synthesize_lesson_slides. Kept for backwards compatibility."""
    from guidian.models.models import Lesson, Module, Course
    from guidian.services.media.tts import synthesize_and_upload

    logger.info("ElevenLabs TTS pipeline starting for course %s", course_id)
    with SyncSessionLocal() as db:
        lessons = (
            db.execute(
                select(Lesson)
                .join(Module, Lesson.module_id == Module.id)
                .join(Course, Module.course_id == Course.id)
                .where(Course.id == UUID(course_id))
                .order_by(Module.order_index, Lesson.order_index)
            )
            .scalars()
            .all()
        )
        for lesson in lessons:
            try:
                key, script = synthesize_and_upload(lesson.id, lesson.title, lesson.mdx_content)
                lesson.audio_url = key
                lesson.transcript = script
                db.commit()
                logger.info("Audio generated for lesson %s → %s", lesson.id, key)
            except Exception as exc:
                logger.warning("TTS failed for lesson %s: %s", lesson.id, exc)


@celery_app.task(
    name="guidian.workers.tasks.generate_lesson_images",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=3,
    acks_late=True,
)
def generate_lesson_images(self, course_id: str) -> None:
    from guidian.models.models import Lesson, Module, Course
    from guidian.services.media.image_gen import generate_and_upload

    logger.info("GPT Image pipeline starting for course %s", course_id)
    with SyncSessionLocal() as db:
        lessons = (
            db.execute(
                select(Lesson)
                .join(Module, Lesson.module_id == Module.id)
                .join(Course, Module.course_id == Course.id)
                .where(Course.id == UUID(course_id))
                .order_by(Module.order_index, Lesson.order_index)
            )
            .scalars()
            .all()
        )
        for lesson in lessons:
            try:
                from guidian.services.media.diagram_references import find_reference_url
                ref_url = find_reference_url(lesson.title, list(lesson.objectives or []))
                key = generate_and_upload(
                    lesson.id,
                    lesson.title,
                    list(lesson.objectives or []),
                    reference_url=ref_url,
                )
                lesson.image_url = key
                db.commit()
                logger.info("Image generated for lesson %s → %s (ref: %s)", lesson.id, key, ref_url or "none")
            except Exception as exc:
                logger.warning("Image gen failed for lesson %s: %s", lesson.id, exc)


@celery_app.task(
    name="guidian.workers.tasks.generate_large_course",
    bind=True,
    autoretry_for=(CourseGenerationError,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=2,
    acks_late=True,
)
def generate_large_course(self, job_id: str) -> None:
    """
    Phase 1: generate outline + module shells, then fan-out one task per module.
    All module tasks run in parallel; assemble_large_course fires when all complete.
    """
    logger.info("Large-course pipeline starting for job %s", job_id)
    with SyncSessionLocal() as db:
        course_id, module_specs = run_large_course_generation(UUID(job_id), db)

    module_tasks = celery_group([
        generate_and_validate_module.s(
            job_id,
            str(module_id),
            module_outline,
            course_context,
        )
        for module_id, module_outline, course_context in module_specs
    ])
    chord(module_tasks)(assemble_large_course.s(job_id, str(course_id)))
    logger.info(
        "Dispatched %d parallel module tasks for course %s",
        len(module_specs),
        course_id,
    )


@celery_app.task(
    name="guidian.workers.tasks.generate_and_validate_module",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=180,
    max_retries=2,
    acks_late=True,
)
def generate_and_validate_module(
    self,
    job_id: str,
    module_id: str,
    module_outline: dict,
    course_context: dict,
) -> str:
    """Phase 2+3: write full lesson content for one module, validate, retry once on failure."""
    logger.info(
        "Writing module %s (%s) for job %s",
        module_outline.get("module_index", "?"),
        module_outline.get("module_title", "?"),
        job_id,
    )
    with SyncSessionLocal() as db:
        generate_module_content(UUID(module_id), module_outline, course_context, db)
    logger.info("Module %s complete", module_id)
    return module_id


@celery_app.task(
    name="guidian.workers.tasks.assemble_large_course",
    bind=True,
    acks_late=True,
)
def assemble_large_course(self, module_results: list, job_id: str, course_id: str) -> str:
    """Chord callback: all modules done — mark course published, kick off media generation."""
    logger.info(
        "All %d modules complete for course %s, finalizing",
        len(module_results),
        course_id,
    )
    with SyncSessionLocal() as db:
        finalize_large_course(UUID(course_id), UUID(job_id), db)

    synthesize_lesson_slides.delay(course_id)
    generate_lesson_images.delay(course_id)
    logger.info("Large course %s published, media generation dispatched", course_id)
    return course_id


@celery_app.task(
    name="guidian.workers.tasks.generate_certificate",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=3,
    acks_late=True,
)
def generate_certificate(self, certificate_id: str) -> str:
    """Render the certificate PDF via headless Chromium and upload to S3."""
    from guidian.services.certificates.issuer import render_and_persist_certificate

    logger.info("Rendering certificate %s (attempt %s)", certificate_id, self.request.retries + 1)
    with SyncSessionLocal() as db:
        cert = render_and_persist_certificate(db, UUID(certificate_id))
        return str(cert.id)
