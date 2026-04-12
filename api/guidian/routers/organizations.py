from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.db.session import get_db
from guidian.models.models import Organization, UserRole
from guidian.routers.deps import require_roles
from guidian.schemas.organization import OrganizationCreate, OrganizationRead, OrganizationUpdate

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post("", response_model=OrganizationRead, status_code=201, dependencies=[Depends(require_roles(UserRole.admin))])
async def create_org(body: OrganizationCreate, db: AsyncSession = Depends(get_db)):
    org = Organization(name=body.name, slug=body.slug, settings=body.settings)
    db.add(org)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Slug already exists")
    await db.refresh(org)
    return org


@router.get("", response_model=list[OrganizationRead])
async def list_orgs(db: AsyncSession = Depends(get_db), _=Depends(require_roles(UserRole.admin))):
    return (await db.execute(select(Organization))).scalars().all()


@router.get("/{org_id}", response_model=OrganizationRead)
async def get_org(org_id: UUID, db: AsyncSession = Depends(get_db), _=Depends(require_roles(UserRole.admin, UserRole.org_admin))):
    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalar_one_or_none()
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return org


@router.patch("/{org_id}", response_model=OrganizationRead)
async def update_org(
    org_id: UUID,
    body: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_roles(UserRole.admin, UserRole.org_admin)),
):
    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalar_one_or_none()
    if not org:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    await db.commit()
    await db.refresh(org)
    return org
