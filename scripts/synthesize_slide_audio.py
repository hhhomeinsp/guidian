#!/usr/bin/env python3
"""
Generate per-slide audio for all existing lessons in the live home inspector course.

Usage:
    python scripts/synthesize_slide_audio.py

Reads R2 credentials from /home/claudeuser/.openclaw/workspace/.secrets.
DO NOT run until after deploying the 0004_slide_audio_keys migration.
"""
import os
import sys
import uuid
from pathlib import Path

# Load secrets from .secrets file
secrets_path = Path("/home/claudeuser/.openclaw/workspace/.secrets")
if secrets_path.exists():
    for line in secrets_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())

# Map R2 credentials to what guidian settings expects
os.environ.setdefault("S3_ENDPOINT_URL", os.environ.get("GUIDIAN_R2_ENDPOINT", ""))
os.environ.setdefault("S3_ACCESS_KEY", os.environ.get("GUIDIAN_R2_ACCESS_KEY", ""))
os.environ.setdefault("S3_SECRET_KEY", os.environ.get("GUIDIAN_R2_SECRET_KEY", ""))

sys.path.insert(0, str(Path(__file__).parent.parent / "api"))

COURSE_ID = "2c903510-fceb-4937-8517-3380c59c185a"


def main() -> None:
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import sessionmaker, Session

    from guidian.core.config import settings
    from guidian.models.models import Lesson, Module, Course
    from guidian.services.media.tts import synthesize_lesson_slides

    engine = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)

    with SessionLocal() as db:
        lessons = (
            db.execute(
                select(Lesson)
                .join(Module, Lesson.module_id == Module.id)
                .join(Course, Module.course_id == Course.id)
                .where(Course.id == uuid.UUID(COURSE_ID))
                .order_by(Module.order_index, Lesson.order_index)
            )
            .scalars()
            .all()
        )

        total = len(lessons)
        print(f"Found {total} lessons in course {COURSE_ID}")

        for i, lesson in enumerate(lessons, 1):
            if lesson.slide_audio_keys:
                print(f"[{i}/{total}] SKIP  {lesson.title} ({len(lesson.slide_audio_keys)} slides already)")
                continue
            print(f"[{i}/{total}] SYNTH {lesson.title} ...", end="", flush=True)
            try:
                keys = synthesize_lesson_slides(
                    lesson.id,
                    lesson.title,
                    list(lesson.objectives or []),
                    lesson.mdx_content,
                    db,
                )
                print(f" done ({len(keys)} slides)")
            except Exception as exc:
                print(f" FAILED: {exc}")


if __name__ == "__main__":
    main()
