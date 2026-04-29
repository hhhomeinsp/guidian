# Guidian — CLAUDE.md

AI-native universal learning platform. Generates, delivers, and tracks education for every stage of a learner's life — from vocational exploration to professional CE renewal. Deploys on Render. Repo: https://github.com/hhhomeinsp/guidian

See VISION.md for full product synopsis.

## Stack

| Layer | Tech |
|---|---|
| API | FastAPI + SQLAlchemy async + Alembic + Postgres |
| Workers | Celery + Redis (separate `guidian-worker` service) |
| Frontend | Next.js 14 App Router + Tailwind + shadcn/ui + Framer Motion |
| Storage | Cloudflare R2 (S3-compatible) — courses, audio, certificates buckets |
| Auth | JWT (access 15min / refresh 7d) + Google OAuth 2.0 |
| AI | Claude claude-opus-4-7 (content), GPT Image 1 (lesson images), ElevenLabs (TTS narration) |

## Render Services

| Service | ID |
|---|---|
| guidian-api | `srv-d7mvh34vikkc73b0ok7g` |
| guidian-worker | `srv-d7mvhb1o3t8c73ecsdf0` |
| guidian-web | `srv-d7mvhs0g4nts73askf5g` |
| guidian-postgres | `dpg-d7mvfr9kh4rs73au27i0-a` |
| guidian-redis | `red-d7mvg657vvec738r591g` |

## Live URLs

- Web: https://guidian.io
- API: https://guidian-api.onrender.com
- API docs: https://guidian-api.onrender.com/docs

## Key API Routes

```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
GET  /api/v1/auth/google          → OAuth redirect
GET  /api/v1/auth/google/callback → OAuth callback (redirects to web /auth/callback)
GET  /api/v1/courses
GET  /api/v1/courses/{id}         → CourseDetail with modules + lessons
POST /api/v1/courses/{id}/modules → Add module (admin only)
GET  /api/v1/courses/lessons/{id}
GET  /api/v1/courses/lessons/{id}/audio → 302 redirect to presigned R2 URL
POST /api/v1/generation/courses   → Trigger Celery course generation job
```

## Cloudflare R2 Storage

- Account ID: `797358481bc7dd22f58621e9713eccd3`
- Endpoint: `https://797358481bc7dd22f58621e9713eccd3.r2.cloudflarestorage.com`
- Buckets: `guidian-courses` (images), `guidian-audio` (TTS MP3s), `guidian-certificates`
- Credentials in Render env vars: `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`

## Google OAuth

- Redirect URI registered in Google Cloud Console: `https://guidian.io/api/v1/auth/google/callback`
- Frontend callback page: `/auth/callback` — reads tokens from URL params, stores, redirects to `/courses`
- Env vars on guidian-api: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `WEB_BASE_URL`, `API_BASE_URL`

## Course Content Pipeline

### Small courses (≤10 CEU hours)
Single Celery task: `generate_course` → Claude generates full JSON → persisted → TTS + image generation triggered

### Large courses (>10 CEU hours)
3-phase pipeline:
1. `generate_large_course` — outline agent produces module/lesson structure
2. `generate_and_validate_module` (parallel, one per module) — module writer + validator agents
3. `assemble_large_course` (Celery chord callback) — marks course published, triggers TTS + images

### Nightly cron (home inspector course)
- Trigger ID: `trig_01QuaZWYXppMUnmwMkLB1d67`
- Schedule: 2am UTC daily
- Adds 2 modules per night via remote Claude Code session
- Uses Claude CLI auth (not the ANTHROPIC_API_KEY env var)
- Manage: https://claude.ai/code/scheduled/trig_01QuaZWYXppMUnmwMkLB1d67

## Content Quality Requirements

All generated lessons must meet:
- **Word count**: `clock_minutes × 40` minimum (75-min lesson = 3,000+ words)
- **Section count**: `clock_minutes ÷ 4` level-2 `##` headings minimum (75-min = 18+ sections)
- Each `##` section = one slide in SlideViewer — section count drives learner UX
- At least 3 quiz questions per lesson (scenario-based, not recall)
- At least 1 Mermaid diagram per module

## Live Home Inspector Course

- **Course:** Certified Home Inspector — 100-Hour Professional Course
- **Course ID:** `2c903510-fceb-4937-8517-3380c59c185a`
- **Admin:** hhhomeinsp@gmail.com (user ID: `569aba80-ef1d-4be6-9ac6-2ff3af904821`)
- **Admin JWT:** `eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiNTY5YWJhODAtZWYxZC00YmU2LTlhYzYtMmZmM2FmOTA0ODIxIiwgImV4cCI6IDE4MDg3Nzg0NjUsICJ0eXBlIjogImFjY2VzcyJ9.wDKFNKQgv6BWPM6gCR9CE0jpgLWAA_h0il-hBXuHbr0` (expires 2027)
- **Structure:** 13 modules × 4 lessons = 52 lessons, 100 CEU hours
- **Status as of 2026-04-27:** 0 modules live (Module 1 deleted for regeneration; nightly cron will rebuild starting 2am UTC 2026-04-27)

## Frontend — SlideViewer

Lesson content is presented as a slide deck. Each `##` heading in `mdx_content` becomes a slide.

Slide types:
- **TitleSlide** — lesson hero image + objectives + "Start" button
- **ContentSlide** — gradient header + scrollable MDX body
- **SummarySlide** — objectives checklist + "Take Quiz" button

Features: Framer Motion direction-aware animations, keyboard/swipe/touch navigation, dot indicators, top progress bar, sticky audio bar (ElevenLabs narration), color-coded callout cards, numbered step cards, key insight pull quotes.

File: `web/components/course/SlideViewer.tsx`

## Known Issues / TODOs

- **ANTHROPIC_API_KEY on Render is expired/invalid (as of 2026-04-27)** — returns 401. Needs rotating at console.anthropic.com. Update in 1Password and all three Render services.
- Reference diagram map (`api/guidian/services/media/diagram_references.py`) is empty — InterNACHI and Wikimedia block server-side hotlinking. Needs self-hosted reference images in R2.
- No DELETE endpoint for modules — requires direct DB job to remove a module.

## Useful One-Off Commands

```bash
# Trigger TTS synthesis for a course (run on guidian-worker via Render Jobs API)
python -c "from guidian.workers.tasks import synthesize_lesson_audio; synthesize_lesson_audio.apply_async(args=['<course_id>'])"

# Delete a module (replace module_id)
python3 -c "
from guidian.workers.tasks import SyncSessionLocal
from guidian.models.models import Module
import uuid
with SyncSessionLocal() as db:
    m = db.get(Module, uuid.UUID('<module_id>'))
    if m: db.delete(m); db.commit(); print('Deleted')
"
```

## Icons
**Always use Lucide React** (`lucide-react`) for all icons. No other icon libraries.
Browse available icons at lucide.dev.

## Diagrams
**NO MERMAID DIAGRAMS.** All lessons must have diagrams: []
Diagrams are created manually by Patrick and processed through GPT Image 2.
Use scripts/process_diagram.py to upload a diagram image to R2 and map it to a lesson.
