"""
Sage — real-time voice AI instructor.

REST endpoint to create a session token, WebSocket endpoint that proxies
audio between the browser and OpenAI Realtime API.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select

from guidian.core.config import settings
from guidian.db.session import AsyncSessionLocal
from guidian.models.models import LearnerMemory, TeacherSession, User
from guidian.routers.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sage", tags=["sage"])

OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
SAGE_TOKEN_EXPIRE_MINUTES = 15


# ── Schemas ────────────────────────────────────────────────────────────────────

class SessionRequest(BaseModel):
    course_id: str | None = None
    course_title: str | None = None
    voice: str = "shimmer"


class SessionResponse(BaseModel):
    token: str
    ws_url: str


# ── REST: create session token ─────────────────────────────────────────────────

@router.post("/session", response_model=SessionResponse)
async def create_sage_session(
    body: SessionRequest,
    current_user: User = Depends(get_current_user),
):
    payload = {
        "sub": str(current_user.id),
        "course_id": body.course_id,
        "course_title": body.course_title,
        "voice": body.voice,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=SAGE_TOKEN_EXPIRE_MINUTES),
        "type": "sage_session",
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    ws_url = f"/api/v1/sage/ws?token={token}"
    return SessionResponse(token=token, ws_url=ws_url)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _decode_sage_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "sage_session":
            raise ValueError("invalid token type")
        return payload
    except JWTError as exc:
        raise ValueError(f"invalid sage token: {exc}")


def _build_sage_prompt(memory: LearnerMemory | None, course_title: str | None) -> str:
    profession = (memory.profession or "professional") if memory else "professional"
    license_state = (memory.license_state or "unknown") if memory else "unknown"
    vark_style = (memory.vark_style or "mixed") if memory else "mixed"
    strengths = (memory.strengths or []) if memory else []
    struggle_areas = (memory.struggle_areas or []) if memory else []

    strengths_text = ", ".join(strengths) if strengths else "none identified yet"
    struggle_text = ", ".join(struggle_areas) if struggle_areas else "none identified yet"
    context_line = f"Current course: {course_title}" if course_title else "No specific course context"

    return (
        "You are Sage, a warm and knowledgeable AI instructor on Guidian — "
        "a professional continuing education platform.\n\n"
        "Learner profile:\n"
        f"- Profession: {profession}\n"
        f"- License state: {license_state}\n"
        f"- Learning style: {vark_style}\n"
        f"- Strengths: {strengths_text}\n"
        f"- Areas to improve: {struggle_text}\n\n"
        f"Current context: {context_line}\n\n"
        "Your role as Sage:\n"
        "- Be the learner's trusted advisor and guide\n"
        "- Answer questions about course content, CE requirements, and licensing\n"
        "- Adapt your explanations to their profession and learning style\n"
        "- Keep responses concise for voice — 2-4 sentences unless more is needed\n"
        "- Be warm, encouraging, and practical\n"
        "- If they ask about a topic outside your knowledge, say so honestly\n"
        "- You have a calm, professional voice. Do not use filler words.\n\n"
        "Start by greeting the learner warmly, then ask what they want to work on."
    )


# ── WebSocket: bidirectional proxy ─────────────────────────────────────────────

@router.websocket("/ws")
async def sage_ws(websocket: WebSocket, token: str):
    try:
        payload = _decode_sage_token(token)
    except ValueError as exc:
        await websocket.close(code=4001, reason=str(exc))
        return

    await websocket.accept()

    user_id = UUID(payload["sub"])
    course_title = payload.get("course_title")
    voice = payload.get("voice") or "shimmer"

    memory: LearnerMemory | None = None
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(LearnerMemory).where(LearnerMemory.user_id == user_id)
            )
            memory = result.scalar_one_or_none()
    except Exception:
        logger.warning("Could not load learner memory for sage session user=%s", user_id)

    try:
        import websockets as ws_lib
    except ImportError:
        await websocket.send_json({"type": "error", "message": "Server missing websockets library"})
        await websocket.close()
        return

    if not settings.OPENAI_API_KEY:
        await websocket.send_json({"type": "error", "message": "OpenAI API key not configured"})
        await websocket.close()
        return

    session_messages: list[dict] = []
    openai_ws = None

    try:
        extra_headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "OpenAI-Beta": "realtime=v1",
        }
        openai_ws = await ws_lib.connect(
            OPENAI_REALTIME_URL,
            additional_headers=extra_headers,
        )

        session_update = {
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "voice": voice,
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {"model": "whisper-1"},
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 600,
                },
                "instructions": _build_sage_prompt(memory, course_title),
            },
        }
        await openai_ws.send(json.dumps(session_update))
        await openai_ws.send(json.dumps({"type": "response.create"}))

        async def client_to_openai():
            try:
                while True:
                    data = await websocket.receive_json()
                    msg_type = data.get("type")

                    if msg_type == "audio_chunk":
                        await openai_ws.send(json.dumps({
                            "type": "input_audio_buffer.append",
                            "audio": data["audio"],
                        }))
                    elif msg_type == "audio_commit":
                        await openai_ws.send(json.dumps({"type": "input_audio_buffer.commit"}))
                        await openai_ws.send(json.dumps({"type": "response.create"}))
                    elif msg_type == "text":
                        session_messages.append({"role": "user", "content": data["text"]})
                        await openai_ws.send(json.dumps({
                            "type": "conversation.item.create",
                            "item": {
                                "type": "message",
                                "role": "user",
                                "content": [{"type": "input_text", "text": data["text"]}],
                            },
                        }))
                        await openai_ws.send(json.dumps({"type": "response.create"}))
                    elif msg_type == "interrupt":
                        await openai_ws.send(json.dumps({"type": "response.cancel"}))
            except WebSocketDisconnect:
                pass
            except Exception as exc:
                logger.debug("sage client_to_openai ended: %s", exc)

        async def openai_to_client():
            try:
                async for raw in openai_ws:
                    event = json.loads(raw)
                    evt_type = event.get("type", "")

                    if evt_type == "response.audio.delta":
                        await websocket.send_json({
                            "type": "audio_chunk",
                            "audio": event.get("delta", ""),
                        })
                    elif evt_type == "response.audio.done":
                        await websocket.send_json({"type": "audio_done"})
                    elif evt_type == "response.audio_transcript.delta":
                        await websocket.send_json({
                            "type": "transcript_delta",
                            "text": event.get("delta", ""),
                        })
                    elif evt_type == "response.audio_transcript.done":
                        transcript = event.get("transcript", "")
                        session_messages.append({"role": "assistant", "content": transcript})
                        await websocket.send_json({
                            "type": "transcript_done",
                            "text": transcript,
                        })
                    elif evt_type == "conversation.item.input_audio_transcription.completed":
                        await websocket.send_json({
                            "type": "user_transcript",
                            "text": event.get("transcript", ""),
                        })
                    elif evt_type == "input_audio_buffer.speech_started":
                        await websocket.send_json({"type": "speech_started"})
                    elif evt_type == "input_audio_buffer.speech_stopped":
                        await websocket.send_json({"type": "speech_stopped"})
                    elif evt_type in ("response.created", "response.done"):
                        await websocket.send_json({"type": evt_type})
                    elif evt_type == "error":
                        err_msg = event.get("error", {}).get("message", "Unknown error")
                        await websocket.send_json({"type": "error", "message": err_msg})
            except ws_lib.exceptions.ConnectionClosed:
                pass
            except Exception as exc:
                logger.debug("sage openai_to_client ended: %s", exc)

        done, pending = await asyncio.wait(
            [
                asyncio.create_task(client_to_openai()),
                asyncio.create_task(openai_to_client()),
            ],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()

    except Exception as exc:
        logger.error("Sage WS error: %s", exc, exc_info=True)
        try:
            await websocket.send_json({"type": "error", "message": "Failed to connect to AI service"})
        except Exception:
            pass
    finally:
        if session_messages:
            try:
                course_uuid: UUID | None = None
                if payload.get("course_id"):
                    try:
                        course_uuid = UUID(payload["course_id"])
                    except ValueError:
                        pass
                async with AsyncSessionLocal() as db:
                    session = TeacherSession(
                        user_id=user_id,
                        messages=session_messages,
                        session_type="voice",
                        course_id=course_uuid,
                    )
                    db.add(session)
                    await db.commit()
            except Exception:
                logger.warning("Could not save sage session for user=%s", user_id)

        if openai_ws:
            try:
                await openai_ws.close()
            except Exception:
                pass
        try:
            await websocket.close()
        except Exception:
            pass
