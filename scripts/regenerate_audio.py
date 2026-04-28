#!/usr/bin/env python3
"""
Regenerate TTS audio for all lessons that have an existing audio_url.

Requires env vars (same as the worker):
  DATABASE_URL / SYNC_DATABASE_URL  — Postgres connection string
  ELEVENLABS_API_KEY
  ELEVENLABS_VOICE_ID
  S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_AUDIO

Run from the repo root:
  cd /path/to/guidian
  DATABASE_URL=postgres://... ELEVENLABS_API_KEY=... python3 scripts/regenerate_audio.py

Optional: pass --dry-run to print what would be regenerated without calling ElevenLabs.
"""
from __future__ import annotations

import argparse
import os
import sys

# Make the guidian package importable when running from repo root or scripts/
_repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_repo_root, "api"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Regenerate lesson audio using chunked TTS")
    parser.add_argument("--dry-run", action="store_true", help="List lessons without calling ElevenLabs")
    parser.add_argument("--lesson-id", help="Regenerate a single lesson by ID (UUID)")
    parser.add_argument("--course-id", default="2c903510-fceb-4937-8517-3380c59c185a",
                        help="Course UUID (default: home inspector course)")
    args = parser.parse_args()

    from uuid import UUID
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session, sessionmaker

    from guidian.core.config import settings
    from guidian.models.models import Course, Lesson, Module
    from guidian.services.media.tts import synthesize_and_upload

    sync_url = settings.SYNC_DATABASE_URL
    engine = create_engine(sync_url, pool_pre_ping=True, future=True)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, class_=Session)

    with SessionLocal() as db:
        query = (
            select(Lesson)
            .join(Module, Lesson.module_id == Module.id)
            .join(Course, Module.course_id == Course.id)
            .where(Course.id == UUID(args.course_id))
            .where(Lesson.audio_url.isnot(None))
            .order_by(Module.order_index, Lesson.order_index)
        )
        if args.lesson_id:
            query = query.where(Lesson.id == UUID(args.lesson_id))

        lessons = db.execute(query).scalars().all()

    print(f"Found {len(lessons)} lesson(s) with existing audio to regenerate.")
    if args.dry_run:
        for lesson in lessons:
            word_count = len((lesson.mdx_content or "").split())
            script_len = len(lesson.title or "") + len(lesson.mdx_content or "")
            chunks_needed = max(1, -(-script_len // 4800))  # ceil division
            print(f"  [{lesson.id}] {lesson.title[:60]} — {word_count} words, ~{chunks_needed} chunk(s)")
        print("Dry run complete — no audio was generated.")
        return

    ok = 0
    failed = 0
    with SessionLocal() as db:
        lessons = db.execute(
            select(Lesson)
            .join(Module, Lesson.module_id == Module.id)
            .join(Course, Module.course_id == Course.id)
            .where(Course.id == UUID(args.course_id))
            .where(Lesson.audio_url.isnot(None))
            .order_by(Module.order_index, Lesson.order_index)
        ).scalars().all()
        if args.lesson_id:
            lessons = [l for l in lessons if str(l.id) == args.lesson_id]

        for i, lesson in enumerate(lessons, 1):
            word_count = len((lesson.mdx_content or "").split())
            print(f"[{i}/{len(lessons)}] {lesson.title[:60]} ({word_count} words) ...", end=" ", flush=True)
            try:
                key, script = synthesize_and_upload(lesson.id, lesson.title, lesson.mdx_content)
                lesson.audio_url = key
                lesson.transcript = script
                db.commit()
                print(f"OK → {key}")
                ok += 1
            except Exception as exc:
                print(f"FAILED: {exc}")
                failed += 1

    print(f"\nDone: {ok} succeeded, {failed} failed.")


if __name__ == "__main__":
    main()
