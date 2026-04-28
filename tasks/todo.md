# P1 Compliance — Task List

## Phase 1: Foundation

- [ ] **Task 1** — `api/alembic/versions/0003_lesson_transcript.py`: migration adding `transcript TEXT NULL` to lessons
- [ ] **Task 2** — `api/guidian/models/models.py`: add `transcript: Mapped[str | None]` to `Lesson`

## Phase 2: Backend APIs

- [ ] **Task 3** — `api/guidian/services/certificates/issuer.py`: enrich `cert.metadata_` with instructor_name, instructor_credentials, course_approval_number, state_approvals, completion_date, expiry_date, verify_url
- [ ] **Task 4** — `api/guidian/routers/certificates.py`: add `GET /certificates/verify/{verification_code}` (no auth)
- [ ] **Task 5** — `api/guidian/services/media/tts.py` + worker task: save TTS script to `lesson.transcript`
- [ ] **Task 6** — `api/guidian/routers/users.py` + `api/guidian/schemas/user.py`: `PATCH /users/me/identity` endpoint; add `profile` to `UserRead`

## Phase 3: PDF Template

- [ ] **Task 7** — `api/guidian/services/certificates/template.py`: add instructor, approval#, state approvals, expiry, verify URL to HTML

## Phase 4: Frontend

- [ ] **Task 8** — `web/components/course/SlideViewer.tsx`: add `transcript?` to props; transcript toggle panel in audio bar
- [ ] **Task 9** — `web/components/course/SlideViewer.tsx`: ARIA labels, skip link, aria-live on heading, role="navigation"
- [ ] **Task 10** — `web/components/course/SlideViewer.tsx`: inactivity timeout — 30-min warn modal, 35-min pause
- [ ] **Task 11** — `web/app/layout.tsx`: skip nav `<a>` as first body child
- [ ] **Task 12** — `web/app/courses/[courseId]/page.tsx`: identity verification gate before "Issue certificate"
