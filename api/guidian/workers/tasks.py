from __future__ import annotations

from uuid import UUID

from celery.utils.log import get_task_logger
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from guidian.core.config import settings
from guidian.services.ai.course_generator import CourseGenerationError, run_course_generation
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
        synthesize_lesson_audio.delay(str(course_id))
        generate_lesson_images.delay(str(course_id))
        return str(course_id)


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
                key = synthesize_and_upload(lesson.id, lesson.title, lesson.mdx_content)
                lesson.audio_url = key
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

    logger.info("DALL-E image pipeline starting for course %s", course_id)
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
                key = generate_and_upload(lesson.id, lesson.title, list(lesson.objectives or []))
                lesson.image_url = key
                db.commit()
                logger.info("Image generated for lesson %s → %s", lesson.id, key)
            except Exception as exc:
                logger.warning("Image gen failed for lesson %s: %s", lesson.id, exc)


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
