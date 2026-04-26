import os
import urllib.parse

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from guidian.db.session import get_db
from guidian.models.models import Organization, User, UserRole
from guidian.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenPair
from guidian.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

_BOOTSTRAP_SECRET = "guidian-bootstrap-2026"


@router.post("/register", response_model=UserRead, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> User:
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    org_id = None
    if body.organization_slug:
        org = (await db.execute(select(Organization).where(Organization.slug == body.organization_slug))).scalar_one_or_none()
        if not org:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
        org_id = org.id

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=UserRole.learner,
        organization_id=org_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/bootstrap-admin", response_model=UserRead, status_code=201)
async def bootstrap_admin(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> User:
    """One-time bootstrap endpoint to create first admin. Remove after use."""
    import os
    secret = os.environ.get("BOOTSTRAP_SECRET", _BOOTSTRAP_SECRET)
    if body.organization_slug != secret:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid bootstrap secret")
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=UserRole.admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenPair)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    user = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Inactive account")
    return TokenPair(
        access_token=create_access_token(str(user.id), {"role": user.role.value}),
        refresh_token=create_refresh_token(str(user.id)),
    )


_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
_WEB_BASE = os.environ.get("WEB_BASE_URL", "https://guidian-web.onrender.com")


@router.get("/google")
async def google_login() -> RedirectResponse:
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Google OAuth not configured")
    callback_url = f"{os.environ.get('API_BASE_URL', 'https://guidian-api.onrender.com')}/api/v1/auth/google/callback"
    params = urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
    })
    return RedirectResponse(f"{_GOOGLE_AUTH_URL}?{params}")


@router.get("/google/callback")
async def google_callback(code: str, db: AsyncSession = Depends(get_db)) -> RedirectResponse:
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Google OAuth not configured")

    callback_url = f"{os.environ.get('API_BASE_URL', 'https://guidian-api.onrender.com')}/api/v1/auth/google/callback"

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(_GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": callback_url,
            "grant_type": "authorization_code",
        })
        token_resp.raise_for_status()
        google_access_token = token_resp.json()["access_token"]

        userinfo_resp = await client.get(
            _GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {google_access_token}"},
        )
        userinfo_resp.raise_for_status()
        userinfo = userinfo_resp.json()

    email = userinfo.get("email")
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google did not return an email address")

    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not user:
        user = User(
            email=email,
            hashed_password=hash_password(os.urandom(32).hex()),
            full_name=userinfo.get("name") or email.split("@")[0],
            role=UserRole.learner,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account inactive")

    access_token = create_access_token(str(user.id), {"role": user.role.value})
    refresh_token = create_refresh_token(str(user.id))

    params = urllib.parse.urlencode({
        "access_token": access_token,
        "refresh_token": refresh_token,
    })
    return RedirectResponse(f"{_WEB_BASE}/auth/callback?{params}")


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        payload = decode_token(body.refresh_token)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    sub = payload.get("sub")
    user = (await db.execute(select(User).where(User.id == sub))).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return TokenPair(
        access_token=create_access_token(str(user.id), {"role": user.role.value}),
        refresh_token=create_refresh_token(str(user.id)),
    )
