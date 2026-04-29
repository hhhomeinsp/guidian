"""
Admin-scoped endpoints that aggregate existing data for the authoring portal.

Everything here is guarded by `require_roles(admin, org_admin)`. Most of the
read paths are thin SQL aggregations over tables that already exist — nothing
here required a schema change.
"""
import asyncio
import json
import os
import uuid as uuid_module
from pathlib import Path
from uuid import UUID
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Optional

import anthropic
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.core.config import settings
from guidian.db.session import get_db
from guidian.models.models import (
    AIGenerationJob,
    CEURule,
    Certificate,
    ComplianceAuditLog,
    Course,
    CourseOpportunity,
    Enrollment,
    User,
    UserRole,
)
from guidian.routers.deps import require_roles
from guidian.schemas.admin import (
    AIJobRead,
    AdminMetrics,
    AuditLogRead,
    CEURuleCreate,
    CEURuleRead,
    CEURuleUpdate,
)

_COURSE_CHAT_SYSTEM = """You are Guidian's CE course design expert. Help the admin design a continuing education course. Gather: target profession and state(s), CEU hours required, key topics, learning objectives, regulatory requirements. Ask one or two questions at a time. When you have enough info to generate, output a JSON block exactly like this on its own line: COURSE_READY:{"title":"...","description":"...","ceu_hours":X,"target_audience":"...","compliance_requirement":"...","accrediting_body":"...","num_modules":4,"lessons_per_module":4,"state_approvals":[]}"""


class ChatMessage(BaseModel):
    role: str
    content: str


class CourseChatRequest(BaseModel):
    messages: list[ChatMessage]
    opportunity_id: Optional[str] = None

router = APIRouter(prefix="/admin", tags=["admin"])


def _admin_dep():
    return require_roles(UserRole.admin, UserRole.org_admin)


# --- Metrics dashboard ----------------------------------------------------

@router.get("/metrics", response_model=AdminMetrics, dependencies=[Depends(_admin_dep())])
async def metrics(db: AsyncSession = Depends(get_db)):
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)

    async def scalar(stmt) -> int:
        return int((await db.execute(stmt)).scalar() or 0)

    return AdminMetrics(
        users_total=await scalar(select(func.count(User.id))),
        learners_total=await scalar(
            select(func.count(User.id)).where(User.role == UserRole.learner)
        ),
        courses_total=await scalar(select(func.count(Course.id))),
        courses_published=await scalar(
            select(func.count(Course.id)).where(Course.status == "published")
        ),
        enrollments_total=await scalar(select(func.count(Enrollment.id))),
        certificates_issued=await scalar(
            select(func.count(Certificate.id)).where(Certificate.pdf_url.is_not(None))
        ),
        ai_jobs_pending=await scalar(
            select(func.count(AIGenerationJob.id)).where(
                AIGenerationJob.status.in_(("pending", "running"))
            )
        ),
        ai_jobs_failed=await scalar(
            select(func.count(AIGenerationJob.id)).where(AIGenerationJob.status == "failed")
        ),
        audit_events_24h=await scalar(
            select(func.count(ComplianceAuditLog.id)).where(
                ComplianceAuditLog.created_at >= since_24h
            )
        ),
    )


# --- Audit log -------------------------------------------------------------

@router.get("/audit", response_model=list[AuditLogRead], dependencies=[Depends(_admin_dep())])
async def list_audit_events(
    db: AsyncSession = Depends(get_db),
    event_type: str | None = Query(None, description="Exact-match filter"),
    subject_user_id: UUID | None = None,
    course_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    stmt = select(ComplianceAuditLog).order_by(ComplianceAuditLog.created_at.desc())
    if event_type:
        stmt = stmt.where(ComplianceAuditLog.event_type == event_type)
    if subject_user_id:
        stmt = stmt.where(ComplianceAuditLog.subject_user_id == subject_user_id)
    if course_id:
        stmt = stmt.where(ComplianceAuditLog.course_id == course_id)
    stmt = stmt.limit(limit).offset(offset)
    rows = (await db.execute(stmt)).scalars().all()
    return rows


# --- AI job list -----------------------------------------------------------

@router.get("/ai-jobs", response_model=list[AIJobRead], dependencies=[Depends(_admin_dep())])
async def list_ai_jobs(
    db: AsyncSession = Depends(get_db),
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=500),
):
    stmt = select(AIGenerationJob).order_by(AIGenerationJob.created_at.desc())
    if status_filter:
        stmt = stmt.where(AIGenerationJob.status == status_filter)
    stmt = stmt.limit(limit)
    return (await db.execute(stmt)).scalars().all()


# --- CEU rules CRUD --------------------------------------------------------

@router.get("/ceu-rules/course/{course_id}", response_model=CEURuleRead | None, dependencies=[Depends(_admin_dep())])
async def get_rule_for_course(course_id: UUID, db: AsyncSession = Depends(get_db)):
    rule = (
        await db.execute(select(CEURule).where(CEURule.course_id == course_id).limit(1))
    ).scalar_one_or_none()
    return rule


@router.post("/ceu-rules", response_model=CEURuleRead, status_code=201, dependencies=[Depends(_admin_dep())])
async def create_rule(body: CEURuleCreate, db: AsyncSession = Depends(get_db)):
    # Confirm course exists
    course = (await db.execute(select(Course).where(Course.id == body.course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    rule = CEURule(**body.model_dump())
    db.add(rule)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Rule already exists for this course")
    await db.refresh(rule)
    return rule


@router.patch("/ceu-rules/{rule_id}", response_model=CEURuleRead, dependencies=[Depends(_admin_dep())])
async def update_rule(rule_id: UUID, body: CEURuleUpdate, db: AsyncSession = Depends(get_db)):
    rule = (await db.execute(select(CEURule).where(CEURule.id == rule_id))).scalar_one_or_none()
    if not rule:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rule not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return rule


# --- Course chat (SSE) -----------------------------------------------------

@router.post("/course-chat", dependencies=[Depends(_admin_dep())])
async def course_chat(body: CourseChatRequest, db: AsyncSession = Depends(get_db)):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI service not configured")

    system = _COURSE_CHAT_SYSTEM
    if body.opportunity_id:
        opp = (
            await db.execute(select(CourseOpportunity).where(CourseOpportunity.id == body.opportunity_id))
        ).scalar_one_or_none()
        if opp:
            opp_ctx = (
                f"\n\nContext from pipeline opportunity:\n"
                f"Title: {opp.title}\nProfession: {opp.profession}\n"
                f"States: {', '.join(opp.target_states)}\nCEU Hours: {opp.ceu_hours}\n"
                f"Notes: {opp.notes or 'None'}"
            )
            system = _COURSE_CHAT_SYSTEM + opp_ctx

    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    async def stream_events() -> AsyncGenerator[str, None]:
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        accumulated = ""
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                accumulated += text
                yield f"data: {json.dumps({'text': text})}\n\n"
                if "COURSE_READY:" in accumulated:
                    idx = accumulated.index("COURSE_READY:")
                    spec_str = accumulated[idx + len("COURSE_READY:"):]
                    brace_start = spec_str.find("{")
                    brace_end = spec_str.rfind("}")
                    if brace_start != -1 and brace_end != -1:
                        try:
                            spec = json.loads(spec_str[brace_start : brace_end + 1])
                            yield f"data: {json.dumps({'ready': True, 'spec': spec})}\n\n"
                        except json.JSONDecodeError:
                            pass

    return StreamingResponse(stream_events(), media_type="text/event-stream")


# --- Claude Code Max plan course generation -----------------------------------

class CCGenerateRequest(BaseModel):
    title: str
    slug: str
    ceu_hours: float
    num_modules: int
    lessons_per_module: int
    accrediting_body: str = ""
    prompt: str
    target_audience: str = ""


class CCJobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: dict = {}
    course_id: str | None = None
    error: str | None = None


def _cc_job_file(job_id: str) -> Path:
    d = Path("/tmp/cc_jobs")
    d.mkdir(exist_ok=True)
    return d / f"{job_id}.json"


# Keep strong references so GC doesn't collect running tasks.
_bg_tasks: set[asyncio.Task] = set()


async def _run_cc_job(
    job_id: str,
    body: CCGenerateRequest,
    token: str,
    api_base: str,
) -> None:
    job_file = _cc_job_file(job_id)

    def _write(data: dict) -> None:
        job_file.write_text(json.dumps(data))

    _write({
        "status": "running",
        "progress": {"modules_done": 0, "modules_total": body.num_modules},
        "course_id": None,
        "error": None,
    })

    gen_url = settings.OPENCLAW_GENERATION_URL

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                f"{gen_url}/generate",
                json={
                    "title": body.title,
                    "slug": body.slug,
                    "ceu_hours": body.ceu_hours,
                    "num_modules": body.num_modules,
                    "lessons_per_module": body.lessons_per_module,
                    "accrediting_body": body.accrediting_body,
                    "prompt": body.prompt,
                    "target_audience": body.target_audience,
                    "api_base": api_base,
                    "token": token,
                },
            )
            resp.raise_for_status()
            openclaw_job_id = resp.json()["job_id"]
        except Exception as exc:
            _write({
                "status": "failed",
                "progress": {},
                "course_id": None,
                "error": f"Failed to contact generation server: {exc}",
            })
            return

        poll_url = f"{gen_url}/jobs/{openclaw_job_id}"
        while True:
            await asyncio.sleep(15)
            try:
                poll = await client.get(poll_url)
                poll.raise_for_status()
                data = poll.json()
                _write({
                    "status": data["status"],
                    "progress": data.get("progress", {}),
                    "course_id": data.get("course_id"),
                    "error": data.get("error"),
                })
                if data["status"] in ("succeeded", "failed"):
                    return
            except Exception as exc:
                _write({
                    "status": "failed",
                    "progress": {},
                    "course_id": None,
                    "error": f"Polling error: {exc}",
                })
                return


@router.post(
    "/cc-generate-course",
    status_code=202,
    dependencies=[Depends(_admin_dep())],
)
async def cc_generate_course(body: CCGenerateRequest, request: Request):
    job_id = str(uuid_module.uuid4())
    job_file = _cc_job_file(job_id)
    job_file.write_text(
        json.dumps({
            "status": "queued",
            "progress": {"modules_done": 0, "modules_total": body.num_modules},
            "course_id": None,
            "error": None,
        })
    )

    # Prefer a long-lived env token; fall back to the request's Bearer token.
    token = os.environ.get("GUIDIAN_TOKEN") or (
        request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    )
    api_base = f"{settings.API_BASE_URL}{settings.API_V1_PREFIX}"

    task = asyncio.create_task(_run_cc_job(job_id, body, token, api_base))
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)

    return {"job_id": job_id, "status": "queued"}


@router.get(
    "/cc-jobs/{job_id}",
    response_model=CCJobStatusResponse,
    dependencies=[Depends(_admin_dep())],
)
async def get_cc_job(job_id: str):
    job_file = _cc_job_file(job_id)
    if not job_file.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "CC job not found")
    data = json.loads(job_file.read_text())
    return CCJobStatusResponse(job_id=job_id, **data)
