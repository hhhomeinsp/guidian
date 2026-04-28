"""
Admin-scoped endpoints that aggregate existing data for the authoring portal.

Everything here is guarded by `require_roles(admin, org_admin)`. Most of the
read paths are thin SQL aggregations over tables that already exist — nothing
here required a schema change.
"""
import json
from uuid import UUID
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Query, status
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
