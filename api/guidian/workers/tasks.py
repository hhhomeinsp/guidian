from __future__ import annotations

from uuid import UUID

from celery.utils.log import get_task_logger
from sqlalchemy import create_engine
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
        # Enqueue downstream media jobs
        synthesize_lesson_audio.delay(str(course_id))
        render_lesson_diagrams.delay(str(course_id))
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
    # TODO: integrate OpenAI TTS; upload to S3 bucket settings.S3_BUCKET_AUDIO;
    #       persist audio_url on each Lesson.
    logger.info("TTS pipeline placeholder for course %s", course_id)


@celery_app.task(
    name="guidian.workers.tasks.render_lesson_diagrams",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=3,
    acks_late=True,
)
def render_lesson_diagrams(self, course_id: str) -> None:
    # TODO: render Mermaid → SVG/PNG via Puppeteer or mermaid-cli; upload to S3.
    logger.info("Diagram render placeholder for course %s", course_id)


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
    from uuid import UUID
    from guidian.services.certificates.issuer import render_and_persist_certificate

    logger.info("Rendering certificate %s (attempt %s)", certificate_id, self.request.retries + 1)
    with SyncSessionLocal() as db:
        cert = render_and_persist_certificate(db, UUID(certificate_id))
        return str(cert.id)
