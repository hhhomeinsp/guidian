# Guidian

> *From first lesson to final credential.*

**Guidian is an AI-native universal learning platform** that generates, delivers, and tracks education and training for every stage of a person's learning life — from a student's first vocational exploration to a seasoned professional's annual CE renewal.

See [VISION.md](./VISION.md) for the full platform synopsis and product vision.

---

## Monorepo layout

```
/
├── web/        Next.js 14 frontend
├── api/        FastAPI backend
├── mobile/     Flutter app (iOS + Android)
├── infra/      Docker, env configs
└── docs/       Architecture
```

## Build-order status

Build order from the project prompt:

1. Docker Compose environment (Postgres + pgvector, Redis, MinIO, API, worker, web placeholder) — **done**
2. Database schema + Alembic migrations (users, orgs, courses, modules, lessons, profiles, enrollment, progress, quiz, **append-only** audit log, certificates, CEU rules, xAPI, AI jobs) — **done**
3. FastAPI scaffold + JWT auth (access 15min, refresh 7d) — **done**
4. User + organization CRUD — **done**
5. Course / module / lesson data model + API routes — **done**
6. AI course generation service + Celery pipeline — **done**
7. React course component library — **done** (all 12 components in `web/components/course/`)
8. Next.js course player + adaptive renderer — **done**
9. Learner profile + style preference system — **done**
10. Quiz engine + assessment scoring — **done**
11. Compliance rules engine — **done**
12. Certificate generation (server-side PDF → S3) — **done**
13. xAPI statement emission — **done**
14. Admin & authoring portal — **done**
15. Flutter mobile app — **done** (scaffold)

## Getting started (local)

```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY to enable course generation
docker compose up -d postgres redis minio
docker compose run --rm api alembic upgrade head
docker compose up api worker
```

API will be on `http://localhost:8000`. OpenAPI docs at `/docs`.
Health check: `GET /health`.

## Auth flow

- `POST /api/v1/auth/register` — create learner account (optionally bind to org by slug)
- `POST /api/v1/auth/login` — returns `{access_token, refresh_token}`
- `POST /api/v1/auth/refresh` — exchange refresh for a new pair
- `GET  /api/v1/users/me` — current user (requires `Authorization: Bearer <access>`)

Access tokens are signed JWTs (HS256) and expire in 15 minutes.
Refresh tokens expire in 7 days and carry `type: refresh` in their payload.

## AI course generation

```
POST /api/v1/ai/courses/generate
{
  "prompt": "HIPAA privacy rule refresher for pharmacy technicians",
  "target_audience": "Licensed pharmacy technicians",
  "compliance_requirement": "Annual HIPAA training",
  "ceu_hours": 1.0,
  "num_modules": 3,
  "lessons_per_module": 3
}
→ 202 { id, status: "pending", ... }
```

Poll `GET /api/v1/ai/courses/jobs/{job_id}` for status. When `succeeded`, the job's
`course_id` is populated. The pipeline:

1. Enqueues a Celery task (`guidian.workers.tasks.generate_course`) on the `ai` queue.
2. Worker calls Claude (`services/ai/claude_client.py`) with a strict JSON-only
   system prompt (`services/ai/prompts.py`).
3. Response is validated against `AICourseSpec` (Pydantic v2). On `ValidationError`
   the job is marked failed.
4. Course + modules + lessons are persisted in a single transaction.
5. Downstream Celery jobs (`synthesize_lesson_audio`, `render_lesson_diagrams`) are
   dispatched — these are scaffolded placeholders ready for TTS and Mermaid render
   integration.

All Celery tasks use `autoretry_for`, exponential backoff (`retry_backoff`), and
`acks_late` for at-least-once semantics.

## Non-negotiables enforced in the scaffold

- **Append-only audit log.** The `compliance_audit_log` table has DB-level `BEFORE
  UPDATE` and `BEFORE DELETE` triggers (`compliance_audit_log_append_only()`) that
  raise an exception on any modification attempt. See `alembic/versions/0001_initial.py`.
- **Strict AI schema validation.** All Claude output must parse as `AICourseSpec`
  before being persisted.
- **Server-side only** certificate generation path (pending step 12).
- **Retry + DLQ** wiring on every background job.

## Web frontend (`web/`)

Next.js 14 App Router + TypeScript + Tailwind + shadcn-style primitives.

```
web/
├── app/
│   ├── layout.tsx          theme + query providers
│   ├── page.tsx            landing
│   ├── providers.tsx       TanStack Query + next-themes
│   └── _dev/components/    dev-only sandbox (poor-man's Storybook)
├── components/
│   ├── ui/                 button, card, progress (shadcn-style primitives)
│   └── course/             the 12-component library (see below)
└── lib/
    ├── api/
    │   ├── client.ts       fetch wrapper w/ JWT refresh retry
    │   └── schema.d.ts     types (regen via `npm run generate:api`)
    ├── store/learner.ts    Zustand learner preference store
    └── utils.ts            cn() + formatSeconds()
```

### Course component library (step 7 — done)

Every component is fully typed, supports dark mode via Tailwind's `class` strategy,
and uses `cn()` for className composition.

| Component | File | Purpose |
|---|---|---|
| LessonPage | `LessonPage.tsx` | Master wrapper: progress bar, nav, seat-time timer |
| ContentBlock | `ContentBlock.tsx` | MDX renderer (`next-mdx-remote`) + minimal markdown fallback for fixtures |
| Quiz | `Quiz.tsx` | single / multi / true-false with per-question explanations + score callback |
| Scenario | `Scenario.tsx` | Branching decision tree with Framer Motion transitions |
| Flashcard | `Flashcard.tsx` | 3D flip card + SRS-style rating buttons |
| Diagram | `Diagram.tsx` | Mermaid (dynamic-imported, SSR-safe) with zoom controls |
| VideoEmbed | `VideoEmbed.tsx` | Responsive iframe/video wrapper |
| AudioPlayer | `AudioPlayer.tsx` | Narration player with playback-speed control |
| Callout | `Callout.tsx` | tip / warning / important / note variants |
| ProgressCheck | `ProgressCheck.tsx` | Compliance milestone marker with CEU badge |
| Certificate | `Certificate.tsx` | Display-only credential (authoritative PDF is server-side in step 12) |
| Checklist | `Checklist.tsx` | Interactive completion list with required/optional items |

**Dev sandbox:** `/web/app/_dev/components/page.tsx` renders every component with
fixture data (`components/course/fixtures.ts`). Visit `/_dev/components` locally
or on any non-production deploy.

**API types:** `lib/api/schema.d.ts` is regenerated from the FastAPI OpenAPI spec
via `npm run generate:api` (which hits `$NEXT_PUBLIC_API_BASE_URL/openapi.json`).
The checked-in file is a hand-written stub sufficient for the component library
to typecheck until the first regen.

### Course player & adaptive renderer (step 8 — done)

Routes:
- `/login`, `/register` — auth (JWT stored in `localStorage`, refresh handled by `client.ts`)
- `/courses` — catalog + enroll button
- `/courses/[courseId]` — module/lesson outline
- `/courses/[courseId]/lessons/[lessonId]` — lesson player

The lesson player composes `LessonPage` (wrapper, timer, nav) around the new
`AdaptiveRenderer` component + the `Quiz` component. Seat-time is pushed to
`PUT /lessons/{id}/progress` every 15 seconds; variant switches are pushed
immediately.

**`AdaptiveRenderer`** (`web/components/course/AdaptiveRenderer.tsx`) is the
centerpiece of step 8:

- Reads the learner's preferred style from the Zustand store
- Uses `pickVariant()` from `lib/adaptive.ts` to choose one of `visual`,
  `auditory`, `read`, `kinesthetic` based on the lesson's `style_tags` and a
  fallback hierarchy (so every lesson renders something even if the learner's
  preferred style isn't supported by the lesson)
- Renders variant-specific bodies:
  - **visual** → `<Diagram>` + `<ContentBlock>`
  - **auditory** → `<AudioPlayer>` + collapsible transcript
  - **kinesthetic** → `<Checklist>` of objectives + `<ContentBlock>`
  - **read** → `<ContentBlock>`
- Exposes a one-click variant switcher bar. **Switching is a React state
  transition** wrapped in `AnimatePresence` — no route change, no reload — per
  the non-negotiables in the project prompt.
- Emits `onVariantChange` and `onBehavioralSignal` callbacks that the player
  uses to post `variant_served` + behavioral signals to the API. These feed the
  style-vector updates that will land in step 9.

Minor deviations from the original spec worth knowing:
- Routes use course UUIDs (`[courseId]`) instead of slugs for the first cut —
  slug-based routing can be added once the catalog grows.
- Enrollment and lesson-progress endpoints were added to the API as part of
  step 8 (originally implicit in steps 9–10) because the player can't function
  without them. Quiz scoring and compliance rules are still deferred to steps
  10–11; the `Quiz` component currently runs client-side only for the knowledge
  check display.
- Every `enrollment.created` and `lesson.completed` event writes to
  `compliance_audit_log` in the **same database transaction** as the state
  change — enforcing the non-negotiable atomicity requirement.

### Learner profile + adaptive style engine (step 9 — done)

**`services/learner_profile.py`** owns the style-vector math. The
`LearnerProfile.style_vector` is a 16-dim `pgvector` column, allocated:

| Dims | Purpose | Populated by |
|---|---|---|
| 0–3 | base_preference per `[visual, auditory, read, kinesthetic]` | VARK onboarding |
| 4–7 | engagement (EMA of dwell + switches + replays) | Lesson player signals |
| 8–11 | quiz performance per style | Reserved (step 10) |
| 12–15 | completion rate per style | Reserved (step 11) |

`derive_preferred_style()` computes `argmax(0.4 * base + 0.6 * engagement)` when
engagement is non-zero, otherwise falls back to pure VARK base. `apply_signal()`
runs a bounded EMA update with a gentle decay on the non-chosen variants.

**Backend endpoints (`/api/v1/learner/...`):**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/learner/profile` | Fetch or lazily create the profile; returns `preferred_style` |
| `PATCH` | `/learner/profile` | Merge user-facing `preferences` blob |
| `POST` | `/learner/profile/vark` | Accept `{answers: [{question_id, style}]}`, tally to normalized scores, seed dims 0–3 |
| `POST` | `/learner/signals` | Batch of `{variant, event, seconds}` — updates engagement dims |

The lesson-progress endpoint (`PUT /lessons/{id}/progress`) **also** emits a
passive `dwell` signal into the style vector whenever `seconds_spent` advances
and a variant is active — so seat-time on a given variant naturally nudges the
learner's preference without a separate client call.

**Frontend:**

- `app/onboarding/page.tsx` — 8-question VARK-inspired inventory (original
  Guidian-authored questions; the canonical VARK instrument is copyrighted).
  Submits to `/learner/profile/vark` and hydrates the Zustand store with the
  returned `preferred_style` + vector.
- `lib/vark.ts` — question bank.
- `components/LearnerHydrator.tsx` — mounted in the root layout; on every
  page-load for an authenticated user it fetches `/learner/profile` and calls
  `useLearnerStore.hydrate()` so the `AdaptiveRenderer` reads a live preference
  rather than the hard-coded fallback.
- `app/courses/page.tsx` — redirects to `/onboarding` if `vark_scores` is empty.
- Lesson player — wires `AdaptiveRenderer.onBehavioralSignal` to
  `useSendSignals()`, which posts `switch` and `replay` events to
  `/learner/signals` for immediate vector updates.

The Zustand store gained `styleVector` + `hydrated` + `hydrate()`; the
`preferredStyle` reactively drives `pickVariant()` on every lesson load.

**Closing the loop:** learner chooses a variant → emitted as a `switch` signal
→ server updates engagement dims → next lesson's `pickVariant` reads the
refreshed preferred style via `LearnerHydrator`. No page reloads anywhere.

### Quiz engine & assessment scoring (step 10 — done)

**Scoring is server-authoritative.** The client never decides whether an
attempt passes — `services/quiz_scoring.py` re-scores every submission against
the persisted lesson quiz payload.

**Endpoints:**

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/lessons/{id}/quiz/attempts` | Submit an attempt, get per-question feedback + score |
| `GET` | `/lessons/{id}/quiz/summary` | Best score, pass state, attempt count, required pass threshold |

**Atomic transaction on each attempt:**

1. Score the submission against `Lesson.quiz`.
2. Persist `QuizAttempt` row.
3. Append `compliance_audit_log` event `quiz.attempted` (always) plus
   `quiz.passed` when `score >= min_passing_score`.
4. If the learner had a `variant_served` recorded on this lesson's progress,
   call `apply_quiz_result()` to update the `quiz_perf` dims (8–11) of the
   learner's style vector via a bounded EMA (weight 0.3).

All four writes land in the same DB transaction — the append-only audit log
triggers still refuse any subsequent UPDATE/DELETE on the log.

**Passing threshold** is read from `Course.ceu_rules.min_passing_score`
(default 0.7). This is the same field the compliance rules engine (step 11)
will enforce for certificate issuance.

**Completion gate:** `PUT /lessons/{id}/progress` now rejects
`completed: true` with `409 Conflict` if the lesson has a quiz and the learner
has no passing `QuizAttempt`. Enforced server-side; the lesson player also
hides the Next button client-side for a smoother UX.

**Style vector expansion.** `derive_preferred_style()` now mixes three term
groups depending on which are active:

- VARK only → `argmax(base)`
- VARK + engagement → `argmax(0.4 * base + 0.6 * engagement)`
- VARK + engagement + quiz_perf → `argmax(0.3 * base + 0.5 * engagement + 0.2 * quiz_perf)`

This is the one place the formula grows as signals accumulate — dims 12–15
(completion rate per style) will join in step 11.

**Frontend:**

- `Quiz` component gained an `onServerSubmit` prop. When provided, it POSTs
  answers to the server and renders the authoritative per-question feedback
  from the response — the client-side scoring path is retained only as a
  fallback for the dev sandbox.
- `useSubmitQuiz(lessonId)` + `useQuizSummary(lessonId)` hooks.
- Lesson player displays attempt count, best score, and pass threshold, and
  disables the Next button until the quiz is passed (when a quiz exists).

### Compliance rules engine (step 11 — done)

**`services/compliance/engine.py`** is the authoritative gate for certificate
issuance (step 12). It validates a learner's record against the course's CEU
configuration and produces a structured `ComplianceDecision` the UI renders
directly.

**Effective rule loading.** The engine prefers a row in the `ceu_rules` table
(per-course override) and falls back to the `courses.ceu_rules` JSONB blob
plus the course's own columns. This means the AI course generator can seed
rules into the JSONB blob without forcing every course to create a parallel
`ceu_rules` row.

**Checks evaluated on every call:**

| ID | Check | Data source |
|---|---|---|
| `enrollment` | Learner is enrolled in the course | `enrollments` |
| `lessons_completed` | All required lessons completed | `lesson_progress.completed` |
| `min_clock_time` | Aggregate seat time ≥ minimum (minutes) | `lesson_progress.seconds_spent` |
| `quizzes_passed` | Every lesson with a quiz has a passing attempt | `quiz_attempts.passed` |
| `avg_score_threshold` | Average **best** score across quizzed lessons ≥ `min_passing_score` | `quiz_attempts.score` |
| `proctoring` | Proctored session verified | Admin action (pending status if required) |
| `identity_verification` | Identity verified | Admin action (pending status if required) |

Checks are emitted with one of four statuses — `passed`, `failed`, `pending`,
`not_applicable` — so the frontend can render a nuanced per-requirement
status without having to re-derive anything. Proctoring and identity
verification are explicitly `pending` (not `failed`) when required, because
they depend on an out-of-band administrator action rather than any learner
behavior.

**Endpoints:**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/courses/{id}/compliance` | Learner | Evaluate own record |
| `GET` | `/courses/{id}/compliance/{user_id}` | Admin/org_admin/instructor | Evaluate another learner's record |

**Audit log writes on every evaluation:**
- `compliance.evaluated` (always)
- `compliance.met` (only when `eligible` is true)

Both appended to `compliance_audit_log` in the same transaction as any other
writes on the request; the append-only trigger still rejects updates and
deletes.

**Style vector — final term group.** `services/learner_profile.py` gained
`apply_completion()` which bumps `completion_rate` dims 12–15 (EMA weight
0.2) for the variant the learner used to complete a given lesson. This is
called from the lesson-progress PUT path the moment `completed: true` is
accepted.

`derive_preferred_style()` now selects the formula based on which signal
groups are active:

| Active signals | Formula |
|---|---|
| Base only | `argmax(base)` |
| Base + engagement | `argmax(0.40·base + 0.60·eng)` |
| Base + engagement + quiz_perf | `argmax(0.30·base + 0.50·eng + 0.20·quiz_perf)` |
| All four | `argmax(0.25·base + 0.40·eng + 0.20·quiz_perf + 0.15·completion_rate)` |

With step 11 landed, all 16 dims of `LearnerProfile.style_vector` are in use.

**Frontend:**

- `components/course/CompliancePanel.tsx` — status-colored check list with per-check
  icons, blocker summary, and an "Eligible for certificate" header when the
  decision is green. Exported from the `components/course` barrel alongside
  the original 12 components.
- `lib/api/hooks.ts` — `useCompliance(courseId)`.
- `app/courses/[courseId]/page.tsx` — replaces the placeholder `ProgressCheck`
  with `<CompliancePanel>` when the compliance query resolves, keeping the
  old marker as a loading fallback.

This panel is the learner-facing preview of what step 12 (`Certificate`
generation + PDF emission + xAPI statements) will emit once it lands.

### Certificate generation (step 12 — done)

**Server-side only.** The `Certificate` React component exists purely for
on-screen preview; the authoritative PDF is generated by headless Chromium on
the Celery worker and stored in S3. This is the non-negotiable from the
project prompt: _"Certificate PDFs must be generated server-side and stored
in S3. Never generate them client-side."_

**Note on the engine.** The spec says Puppeteer; Puppeteer is Node-only and
would require a sidecar service. Guidian uses **Playwright for Python**,
which drives the same Chromium engine Puppeteer does. PDF output and
capabilities are equivalent, the dep stays in the worker's Python environment,
and the substitution is documented here as the one deviation from the spec.

**Pipeline:**

1. Learner clicks "Issue certificate" on an eligible course.
2. `POST /api/v1/courses/{course_id}/certificates/issue`:
   - Loads course, returns an existing cert if one exists (idempotent).
   - Calls `evaluate_course_completion()` — the authoritative gate. Ineligible
     requests return `409 Conflict` with the full blocker list so the client
     can render actionable feedback.
   - Creates a `certificates` row with `metadata.status = "pending"` and a
     friendly verification code (`GD-XXXX-YYYY`, confusing chars stripped).
   - Appends `certificate.requested` to `compliance_audit_log`.
   - Enqueues `guidian.workers.tasks.generate_certificate` on the worker.
   - Responds `202 Accepted` with the pending certificate row.
3. Worker task:
   - Loads the pending row, builds the HTML via `services/certificates/template.py`
     (landscape Letter, mirrors the React component's look).
   - Renders the PDF via `services/certificates/pdf.py` → Playwright
     headless Chromium with `print_background=True` and
     `prefer_css_page_size=True`.
   - Uploads the bytes to `S3_BUCKET_CERTIFICATES` via boto3 (signature v4,
     MinIO-compatible `endpoint_url`).
   - Updates the row: `pdf_url = s3://bucket/key`, `metadata.status = "issued"`,
     `metadata.s3_key`, `metadata.byte_length`.
   - Appends `certificate.issued` to `compliance_audit_log`.
   - **All DB writes in a single transaction.** On any exception the worker
     rolls back, marks the row `metadata.status = "failed"` with a truncated
     error, and appends `certificate.failed` to the audit log.
4. Client polls `GET /api/v1/certificates/{id}` (TanStack Query
   `refetchInterval` = 2.5s while pending). When `status === "issued"` the
   response includes a fresh `download_url` — a presigned URL scoped to the
   `ResponseContentDisposition: inline` PDF, valid for 15 minutes.

**Endpoints (`/api/v1/...`):**

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/courses/{id}/certificates/issue` | Gate on compliance, enqueue render, return pending row |
| `GET` | `/certificates/me` | List the learner's certificates |
| `GET` | `/certificates/{id}` | Owner-only detail including a fresh presigned `download_url` |

**Storage format.** `certificates.pdf_url` stores an `s3://bucket/key` URI,
**not** a public URL. Presigned URLs are minted on demand per request, so
revoking access is as simple as rotating the S3 credentials.

**Frontend:**

- `useIssueCertificate(courseId)`, `useMyCertificates()`, `useCertificate(id)`.
  The detail hook polls every 2.5s while `status === "pending"` and stops the
  moment the worker writes `issued` (or `failed`).
- `app/courses/[courseId]/page.tsx` — compliance panel now shows an "Issue
  certificate" button when `eligible`, swaps to "Rendering your certificate…"
  during the worker phase, and then to a "View certificate →" link.
- `app/certificates/page.tsx` — learner's full list.
- `app/certificates/[certificateId]/page.tsx` — renders the React `Certificate`
  component for on-screen preview plus a Download PDF button that points to
  the presigned URL. An explanatory footer calls out that the preview and the
  authoritative PDF are different artifacts, rendered independently.
- `AppHeader` — added Certificates nav link.

**Deploy impact:**

- `api/requirements.txt` adds `playwright==1.47.0`.
- `api/Dockerfile` runs `python -m playwright install --with-deps chromium`
  at image build time, so local `docker compose` runs work out of the box.
- `render.yaml` — the **worker** service's build command installs the
  Chromium binary (`pip install -r requirements.txt && python -m playwright
  install chromium`) and is bumped from `starter` to `standard` because
  Chromium needs ~500MB RAM. The **api** service is unchanged — it only
  enqueues tasks and never spawns a browser.

**Non-negotiables still enforced**

- Every cert issuance path writes to `compliance_audit_log` in the same
  transaction as the state change (`certificate.requested`, `certificate.issued`,
  or `certificate.failed`). The append-only trigger from migration 0001 still
  blocks all UPDATEs and DELETEs on the log.
- Certificates are gated on the compliance engine — not on a client claim.
- PDFs never leave the server; clients only ever see presigned S3 URLs.

### xAPI statement emission (step 13 — done)

Guidian's internal Learning Record Store is the `xapi_statements` table from
migration 0001. Step 13 wires an emitter into every material learning event
so each one produces a canonical xAPI statement atomically with the existing
domain write + `compliance_audit_log` write.

**Emitter architecture.** Pure builder functions in
`services/xapi/statements.py` produce statement dicts; the
`services/xapi/emitter.py` module adds them to the active session without
committing, so the caller's existing transaction remains the unit of
atomicity. Both an async variant (`emit_async`) and a sync variant
(`emit_sync`) are provided so the FastAPI routers and the Celery cert worker
use the same builders.

**Events emitted:**

| Trigger | Statement |
|---|---|
| `POST /enrollments` | `Agent` **registered** `Activity(course)` |
| `PUT /lessons/{id}/progress` (completion flips true) | **completed** `Activity(lesson)` with `result.duration` (ISO 8601 from seat time) |
| `POST /lessons/{id}/quiz/attempts` | **attempted** + (**passed** \| **failed**) `Activity(lesson)` with `result.score.scaled` |
| Certificate issuer (worker) | **earned** `Activity(certificate)` with CEU hours extension |

**Verb IRIs.** Drawn from the ADL registry (`registered`, `attempted`,
`passed`, `failed`, `completed`). Credential issuance uses
`http://id.tincanapi.com/verb/earned` from the community Tin Can registry —
the closest match to "received a credential." No Guidian-namespaced verbs
are used; all verbs are interoperable with any third-party LRS.

**Activity IRIs.** Namespaced under `https://guidian.app/xapi/` —
`/courses/{uuid}`, `/courses/{uuid}/lessons/{uuid}`, `/certificates/{uuid}`.
Identifiers, not live URLs (per xAPI §4.1.4.1).

**Certificate statement.** The `object` is the certificate itself
(activity type `http://id.tincanapi.com/activitytype/certificate`) and
includes the verification code and CEU hours in `definition.extensions`,
keyed under the platform IRI to avoid collisions with third-party vocab.

**Read endpoints (`/api/v1/...`):**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/xapi/statements/me` | Learner | Own feed, newest first, limit 1–500 |
| `GET` | `/xapi/statements` | Admin / org_admin | All statements, paginated |

The owner filter is a JSONB key probe on `actor.mbox` (`= mailto:{email}`)
using SQLAlchemy's `[...].astext` accessor — no schema change needed.

**Frontend:**

- `schema.d.ts` — full xAPI statement typings (`XAPIActor`, `XAPIVerb`,
  `XAPIActivity`, `XAPIResult`, `XAPIStatementRead`).
- `useMyStatements(limit?)` hook.
- `app/activity/page.tsx` — verb-tagged feed with colored icons per standard
  verb, scaled-score display, and ISO-8601 duration rendering.
- `AppHeader` — new Activity nav link.

**Atomicity.** Every emitter call lands in the same DB transaction as its
domain write and its `compliance_audit_log` append. If the transaction
rolls back (e.g. a quiz attempt hits a constraint violation), the xAPI
statement is rolled back with it — the LRS never has "orphan" statements
referencing state the domain doesn't hold.

**Non-negotiables still enforced**

- All statement writes land atomically with domain + audit writes.
- No new migration — `xapi_statements` was in migration 0001.
- The certificate issuer uses the **sync** emitter variant because it runs
  in a Celery worker. Same builders, same column layout, same downstream
  consumers.

### Admin & authoring portal (step 14 — done)

The `/admin/*` route tree under `web/app/admin/` covers the five interface
areas from the project prompt: course authoring, learner management,
compliance reporting, CEU rule configuration, and AI job monitoring.

**Backend — thin admin aggregation layer (`/api/v1/admin/...`):**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/metrics` | Dashboard counts: users, courses, enrollments, certs, AI job states, 24h audit volume |
| `GET` | `/admin/audit` | Query the append-only compliance audit log (filter by `event_type`, `subject_user_id`, `course_id`) |
| `GET` | `/admin/ai-jobs` | List AI course generation jobs, filterable by status |
| `GET` | `/admin/ceu-rules/course/{course_id}` | Fetch the effective rule for a course |
| `POST` | `/admin/ceu-rules` | Create a per-course rule |
| `PATCH` | `/admin/ceu-rules/{rule_id}` | Update a rule's fields |

All endpoints are guarded by `require_roles(admin, org_admin)`. No schema
changes — every endpoint is a thin aggregation over tables that already
existed.

**Frontend routes:**

| Route | Purpose |
|---|---|
| `/admin` | Live metrics dashboard (polls every 15s) |
| `/admin/courses` | Course catalog with status + CEU summary |
| `/admin/courses/new` | AI course generator form — submits to `/ai/courses/generate` and redirects to the job monitor |
| `/admin/courses/[id]` | Course editor: CEU rules form (create or update), read-only module/lesson outline |
| `/admin/users` | All users with role + active status badges |
| `/admin/ai-jobs` | AI job monitor (polls every 5s) with status filter bar |
| `/admin/audit` | Append-only audit log viewer with event-type filter |

**Role gate.** `app/admin/layout.tsx` reads `useMe()` once, redirects
non-admins to `/courses` and unauthenticated users to `/login`, and renders
the sidebar + content only for `admin` and `org_admin` roles. The Zustand
store and TanStack Query cache are untouched for non-admin paths.

**Connection back to earlier steps.**

- The AI job monitor (`/admin/ai-jobs`) is the operational counterpart to
  the Celery pipeline from step 6.
- The CEU rule editor writes to the exact rows the compliance engine from
  step 11 reads via `_load_effective_rule()`. Changing a rule's
  `min_passing_score` updates the authoritative gate for certificate
  issuance (step 12) immediately.
- The audit log viewer surfaces the same rows every previous step has
  been writing to (`enrollment.created`, `lesson.completed`,
  `quiz.attempted`, `quiz.passed`, `certificate.requested`,
  `certificate.issued`, `compliance.evaluated`, etc.). Because the log is
  append-only at the DB level (migration 0001 trigger), this view is the
  canonical compliance record.

**Intentional scope limits.**

- **No in-place lesson authoring UI yet.** The course editor shows the
  generated module/lesson outline read-only. Full MDX lesson editing,
  quiz question editing, and diagram editing is a major UI undertaking
  that deserves its own step. The AI generator covers the 95% case — if
  an admin needs to tweak a lesson's MDX, they can do it via the API for
  now.
- **No bulk user operations.** The users page is list-only; per-user
  role/status updates exist on the API (`PATCH /users/{id}`) but the UI
  for them is deferred.
- **No organization UI.** The `Organization` CRUD endpoints exist from
  step 4 but no admin screen was built for them. Single-tenant
  deployments don't need it; multi-tenant can add it on top of the
  existing API.

### Flutter mobile app (step 15 — done, scaffold)

Completes the build order. The `mobile/` directory is a clean Flutter project
targeting iOS and Android, per the spec:

> _"WebView for course content rendering. Native Flutter components for
> quizzes, flashcards, and audio playback."_

**Structure:**

```
mobile/
├── pubspec.yaml
├── lib/
│   ├── main.dart                 App shell, auth gate, theme
│   ├── config.dart               API + web base URLs (via --dart-define)
│   ├── api/
│   │   ├── auth_storage.dart     flutter_secure_storage wrapper
│   │   ├── api_client.dart       HTTP client with JWT refresh
│   │   └── models.dart           Dart models mirroring Pydantic schemas
│   ├── screens/
│   │   ├── login_screen.dart     Material 3 login form
│   │   ├── courses_screen.dart   Catalog with enroll/continue
│   │   ├── course_detail_screen.dart  Module/lesson outline
│   │   └── lesson_screen.dart    WebView + tabbed native widgets
│   └── widgets/
│       ├── quiz_widget.dart      Native quiz (server-scored)
│       ├── flashcard_widget.dart  3D flip card from objectives
│       └── audio_player_widget.dart  just_audio player + speed
```

**Key architectural decisions:**

- **WebView auth injection.** The lesson screen loads `about:blank`, writes
  the JWT to `window.localStorage` under the same key the web client uses
  (`guidian.access_token`), then navigates to the web lesson URL. The web
  app's `lib/api/client.ts` picks it up transparently — no extra auth
  handshake.
- **Server-scored quizzes.** The native quiz widget POSTs to
  `POST /lessons/{id}/quiz/attempts` just like the web `Quiz` component —
  client-side scoring is never trusted. Per-question feedback from the
  server response is rendered inline.
- **Config via `--dart-define`.** `API_BASE_URL` and `WEB_BASE_URL` default
  to `10.0.2.2` (Android emulator → host loopback). Production builds pass
  the Render URLs.
- **Material 3 + system dark mode.** `colorSchemeSeed` matches the web's
  `--primary` hue. `ThemeMode.system` follows the device setting.

**What's NOT in this scaffold (requires local machine + dev accounts):**

- `flutter create` bootstrapping (generates `android/`, `ios/`, `test/`
  directories + Gradle/Xcode projects). Run `flutter create --org app.guidian .`
  inside `mobile/` once you have the Flutter SDK installed.
- Native platform config: `AndroidManifest.xml` internet permission,
  `Info.plist` webview entitlement, signing certificates.
- App Store / Play Store submission, TestFlight builds, Firebase
  distribution.
- Offline support (SQLite local cache + download-for-later). The spec
  mentions it; the data layer here is online-only.

**To build locally:**

```bash
cd mobile
flutter create --org app.guidian .
flutter pub get
flutter run --dart-define=API_BASE_URL=https://guidian-api.onrender.com/api/v1 \
            --dart-define=WEB_BASE_URL=https://guidian-web.onrender.com
```

## Deployment (Render via GitHub)

The repo ships with a `render.yaml` blueprint. Pushing to `main` on GitHub and
connecting the repo as a Render Blueprint provisions:

- **guidian-postgres** — Render Postgres Standard (pgvector-enabled)
- **guidian-redis** — Render Key Value (Redis) for Celery broker + result backend
- **guidian-api** — FastAPI web service (`uvicorn ... --port $PORT`)
- **guidian-worker** — Celery worker consuming `ai,media,default` queues
- **guidian-web** — Next.js frontend (`npm ci && npm run build` → `npm start`)

`DATABASE_URL` is injected by Render as `postgresql://...`; `core/config.py`
normalizes it to `postgresql+asyncpg://` / `postgresql+psycopg://` at load time
so the same env var works for the app and Alembic.

Alembic migrations run automatically on every deploy via `preDeployCommand:
alembic upgrade head`.

**Secrets to set manually in the Render dashboard** (blueprint marks them
`sync: false`):

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `S3_BUCKET_COURSES`, `S3_BUCKET_AUDIO`, `S3_BUCKET_CERTIFICATES`

Render has no native object store — use AWS S3 or Cloudflare R2 in production.
MinIO in `docker-compose.yml` is for local development only.

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every push and PR to `main`:

- Spins up a `pgvector/pgvector:pg16` service container
- Installs `api/requirements.txt` + `ruff`
- `ruff check` + `ruff format --check`
- Import smoke test (catches circular imports / syntax errors in `main` + worker)
- `alembic upgrade head` → `downgrade base` → `upgrade head` round-trip to catch
  irreversible migrations

A second `web` job runs in parallel:
- `npm ci`
- `next lint`
- `tsc --noEmit`
- `next build`

For the `guidian-web` service, `NEXT_PUBLIC_API_BASE_URL` must be set manually in
the Render dashboard to the public `guidian-api` URL (e.g.
`https://guidian-api.onrender.com/api/v1`), because Next public env vars are
baked in at **build time** and Render's `fromService` injection happens at
runtime.

## Environment variables

See `.env.example`. Required at minimum:

- `DATABASE_URL`, `SYNC_DATABASE_URL`
- `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`
- `JWT_SECRET_KEY`
- `ANTHROPIC_API_KEY` (for AI generation)
- `S3_*` (for MinIO / S3)
