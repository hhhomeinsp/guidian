from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import User, UserRole, XAPIStatement
from guidian.routers.deps import get_current_user, require_roles
from guidian.schemas.xapi import XAPIStatementRead

router = APIRouter(prefix="/xapi", tags=["xapi"])


def _serialize(row: XAPIStatement) -> dict:
    return {
        "id": row.id,
        "stored_at": row.stored_at,
        "actor": row.actor,
        "verb": row.verb,
        "object_": row.object_,
        "result": row.result,
        "context": row.context,
    }


@router.get("/statements/me", response_model=list[XAPIStatementRead])
async def my_statements(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=500),
):
    """
    Returns the authenticated learner's own xAPI statements, newest first.
    Filtered on the `actor.mbox` field which is always `mailto:{email}` in
    this platform's emitter.
    """
    mbox = f"mailto:{user.email}"
    rows = (
        await db.execute(
            select(XAPIStatement)
            .where(XAPIStatement.actor["mbox"].astext == mbox)
            .order_by(XAPIStatement.stored_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [_serialize(r) for r in rows]


@router.get(
    "/statements",
    response_model=list[XAPIStatementRead],
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.org_admin))],
)
async def all_statements(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Admin-only. Dumps recent statements across all actors."""
    rows = (
        await db.execute(
            select(XAPIStatement)
            .order_by(XAPIStatement.stored_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()
    return [_serialize(r) for r in rows]
