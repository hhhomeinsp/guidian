from celery import Celery

from guidian.core.config import settings

celery_app = Celery(
    "guidian",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["guidian.workers.tasks"],
)

celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_retry_delay=10,
    worker_prefetch_multiplier=1,
    task_routes={
        "guidian.workers.tasks.generate_course": {"queue": "ai"},
        "guidian.workers.tasks.synthesize_lesson_audio": {"queue": "media"},
        "guidian.workers.tasks.render_lesson_diagrams": {"queue": "media"},
    },
    task_default_queue="default",
)
