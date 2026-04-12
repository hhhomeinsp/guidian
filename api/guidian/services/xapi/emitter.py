"""
xAPI statement emitter.

Writes a statement row to the internal `xapi_statements` LRS table. Callers
invoke these inside the same DB transaction as the underlying state change
(lesson completion, quiz attempt, certificate issuance, etc.) so the LRS
record is atomic with the audit log write and the domain write.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.models.models import XAPIStatement


def _build_row(statement: dict[str, Any]) -> XAPIStatement:
    return XAPIStatement(
        actor=statement["actor"],
        verb=statement["verb"],
        object_=statement["object"],
        result=statement.get("result"),
        context=statement.get("context"),
        raw=statement,
    )


async def emit_async(db: AsyncSession, statement: dict[str, Any]) -> None:
    """Emit inside an async FastAPI handler's session. Does NOT commit."""
    db.add(_build_row(statement))


def emit_sync(db: Session, statement: dict[str, Any]) -> None:
    """Emit inside a sync Celery worker session. Does NOT commit."""
    db.add(_build_row(statement))
