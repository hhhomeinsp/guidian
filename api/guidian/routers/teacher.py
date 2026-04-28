from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import LearnerMemory, TeacherSession, User
from guidian.routers.deps import get_current_user
from guidian.services.ai.onboarding_agent import extract_onboarding_complete, run_onboarding_stream
from guidian.services.ai.teacher import get_teacher_response, update_memory_after_session

router = APIRouter(prefix="/teacher", tags=["teacher"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    course_id: str | None = None
    session_id: str | None = None


class OnboardingRequest(BaseModel):
    messages: list[ChatMessage]


@router.post("/chat")
async def teacher_chat(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    course_id = UUID(body.course_id) if body.course_id else None
    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    session_id_holder: list[str] = []

    async def _stream():
        accumulated = []
        async for chunk in get_teacher_response(
            user_id=current_user.id,
            messages=messages,
            db=db,
            course_id=course_id,
        ):
            accumulated.append(chunk)
            yield f"data: {json.dumps({'text': chunk})}\n\n"

        # Fetch the session that was just created (last one for this user)
        result = await db.execute(
            select(TeacherSession)
            .where(TeacherSession.user_id == current_user.id)
            .order_by(TeacherSession.created_at.desc())
            .limit(1)
        )
        session = result.scalar_one_or_none()
        sid = str(session.id) if session else None
        yield f"data: {json.dumps({'done': True, 'session_id': sid})}\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream")


@router.post("/onboarding")
async def teacher_onboarding(
    body: OnboardingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    full_text: list[str] = []

    async def _stream():
        async for chunk in run_onboarding_stream(
            user_id=current_user.id,
            messages=messages,
            db=db,
        ):
            full_text.append(chunk)
            yield f"data: {json.dumps({'text': chunk})}\n\n"

        response_text = "".join(full_text)
        profile = extract_onboarding_complete(response_text)
        if profile:
            yield f"data: {json.dumps({'done': True, 'onboarding_complete': True, 'profile': profile})}\n\n"
        else:
            yield f"data: {json.dumps({'done': True, 'onboarding_complete': False})}\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream")


@router.get("/memory")
async def get_memory(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(LearnerMemory).where(LearnerMemory.user_id == current_user.id))
    memory = result.scalar_one_or_none()
    if not memory:
        return {
            "onboarding_complete": False,
            "profession": None,
            "license_state": None,
            "license_type": None,
            "vark_style": None,
            "learning_goals": None,
            "strengths": [],
            "struggle_areas": [],
            "total_sessions": 0,
        }
    return {
        "onboarding_complete": memory.onboarding_complete,
        "profession": memory.profession,
        "license_state": memory.license_state,
        "license_type": memory.license_type,
        "vark_style": memory.vark_style,
        "learning_goals": memory.learning_goals,
        "renewal_deadline": memory.renewal_deadline.isoformat() if memory.renewal_deadline else None,
        "strengths": memory.strengths or [],
        "struggle_areas": memory.struggle_areas or [],
        "total_sessions": memory.total_sessions,
        "last_session_at": memory.last_session_at.isoformat() if memory.last_session_at else None,
    }


@router.get("/sessions")
async def get_sessions(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TeacherSession)
        .where(TeacherSession.user_id == current_user.id)
        .order_by(TeacherSession.created_at.desc())
        .limit(min(limit, 50))
    )
    sessions = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "session_type": s.session_type,
            "course_id": str(s.course_id) if s.course_id else None,
            "session_summary": s.session_summary,
            "tokens_used": s.tokens_used,
            "message_count": len(s.messages or []),
            "created_at": s.created_at.isoformat(),
        }
        for s in sessions
    ]


@router.post("/sessions/{session_id}/end", status_code=202)
async def end_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TeacherSession).where(
            TeacherSession.id == session_id,
            TeacherSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")

    await update_memory_after_session(
        user_id=current_user.id,
        session_messages=session.messages or [],
        db=db,
    )
    return {"status": "memory updated"}
