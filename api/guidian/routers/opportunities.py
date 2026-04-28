from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import CourseOpportunity, UserRole
from guidian.routers.deps import require_roles
from guidian.schemas.opportunities import OpportunityCreate, OpportunityRead, OpportunityUpdate

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


def _admin_dep():
    return require_roles(UserRole.admin, UserRole.org_admin)


@router.get("", response_model=list[OpportunityRead], dependencies=[Depends(_admin_dep())])
async def list_opportunities(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(CourseOpportunity))).scalars().all()
    return sorted(rows, key=lambda o: o.roi_score, reverse=True)


@router.post("", response_model=OpportunityRead, status_code=201, dependencies=[Depends(_admin_dep())])
async def create_opportunity(body: OpportunityCreate, db: AsyncSession = Depends(get_db)):
    opp = CourseOpportunity(**body.model_dump())
    db.add(opp)
    await db.commit()
    await db.refresh(opp)
    return opp


@router.patch("/{opportunity_id}", response_model=OpportunityRead, dependencies=[Depends(_admin_dep())])
async def update_opportunity(opportunity_id: UUID, body: OpportunityUpdate, db: AsyncSession = Depends(get_db)):
    opp = (await db.execute(select(CourseOpportunity).where(CourseOpportunity.id == opportunity_id))).scalar_one_or_none()
    if not opp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Opportunity not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(opp, field, value)
    await db.commit()
    await db.refresh(opp)
    return opp


@router.delete("/{opportunity_id}", status_code=204, dependencies=[Depends(_admin_dep())])
async def delete_opportunity(opportunity_id: UUID, db: AsyncSession = Depends(get_db)):
    opp = (await db.execute(select(CourseOpportunity).where(CourseOpportunity.id == opportunity_id))).scalar_one_or_none()
    if not opp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Opportunity not found")
    await db.delete(opp)
    await db.commit()
