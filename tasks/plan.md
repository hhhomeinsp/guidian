# Implementation Plan: P1 Compliance Features

## Overview

Five compliance-related feature areas: certificate metadata enrichment + public verify endpoint, audio transcripts (API + frontend toggle), ARIA accessibility improvements, inactivity session timeout, and identity verification gate before certificate issuance.

## Architecture Decisions

- **Certificate metadata**: Stored in existing `metadata_` JSONB column — no migration needed. Fields populated at `render_and_persist_certificate` time in `issuer.py`.
- **Transcript**: New `Text` column on `lessons` table — requires Alembic migration (0003). Populated by the TTS worker after synthesis.
- **Identity data**: Stored in `learner_profiles.preferences` JSONB — no migration needed. New `PATCH /users/me/identity` endpoint writes to profile.
- **Inactivity timeout**: Single `setInterval` polling a `lastActive` ref — no timeout chains. Modal state managed with React state.
- **Skip link / ARIA**: Pure HTML/JSX attributes — no new dependencies.

## Dependency Graph

```
DB migration (transcript column)
    └── Lesson model (already has Text columns)
            └── TTS service saves transcript
                    └── SlideViewer reads lesson.transcript

Certificate metadata (JSONB — no migration)
    └── issuer.py enriches metadata_
            └── template.py renders new fields
                    └── verify endpoint reads metadata_

Identity data (LearnerProfile.preferences — no migration)
    └── PATCH /users/me/identity endpoint
            └── UserRead schema adds profile field
                    └── Course detail page gates cert issuance
```

## Task List

### Phase 1: Foundation — Database

- [ ] Task 1: Alembic migration 0003 — add `transcript` TEXT nullable column to `lessons`
- [ ] Task 2: Add `transcript` mapped column to `Lesson` model in `models.py`

### Checkpoint: Foundation
- [ ] Migration file syntactically valid (alembic check)
- [ ] Model reflects new column

### Phase 2: Backend APIs

- [ ] Task 3: Enrich certificate metadata in `issuer.py` — instructor, approval number, state_approvals, completion_date, expiry_date, verify_url
- [ ] Task 4: Add `GET /certificates/verify/{code}` (no auth) to `certificates.py`
- [ ] Task 5: TTS service saves `script` to `lesson.transcript` after synthesis
- [ ] Task 6: `PATCH /users/me/identity` endpoint in `users.py` + `UserRead` schema adds `profile` field

### Checkpoint: Backend
- [ ] Verify endpoint returns expected JSON shape
- [ ] Identity endpoint writes to profile without migration
- [ ] TTS service signature unchanged

### Phase 3: Certificate PDF Template

- [ ] Task 7: Update `template.py` — add instructor, approval number, state approvals, expiry date, verify URL to HTML

### Phase 4: Frontend

- [ ] Task 8: Add `transcript` to `SlideViewerProps.lesson` + transcript toggle in audio bar
- [ ] Task 9: ARIA labels + skip link in `SlideViewer.tsx`
- [ ] Task 10: Inactivity timeout modal in `SlideViewer.tsx` (single interval, 30-min warn + 5-min pause)
- [ ] Task 11: Skip nav link in `web/app/layout.tsx`
- [ ] Task 12: Identity gate in `web/app/courses/[courseId]/page.tsx`

### Checkpoint: Complete
- [ ] All frontend TypeScript compiles (`pnpm tsc --noEmit` in web/)
- [ ] No broken imports
- [ ] All acceptance criteria met

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `issuer.py` runs on Celery worker — cert/course loaded from DB, not passed in | Med | Read `course.state_approvals` and `course.accrediting_body` from already-loaded `course` object |
| `synthesize_and_upload` doesn't receive a DB session | Med | Task 5 needs the caller (`tasks.py`) to save transcript — check worker task |
| SlideViewer doesn't receive `transcript` from lesson API | Med | Audit lesson API response schema; add field if missing |
| Identity endpoint writes to `learner_profiles` which may not exist for all users | Low | Create profile row if absent (upsert) |

## Open Questions

- Does `GET /courses/lessons/{id}` already return `transcript`? (Check lesson schema — likely needs adding.)
- Does `synthesize_and_upload` have access to the DB session, or does the calling Celery task need to persist transcript? (Check `tasks.py`.)
