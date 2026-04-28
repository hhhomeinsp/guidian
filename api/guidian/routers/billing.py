from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.core.config import settings
from guidian.db.session import get_db
from guidian.models.models import Subscription, User
from guidian.routers.deps import get_current_user

router = APIRouter(prefix="/billing", tags=["billing"])

# Hardcoded plan price IDs — move to env vars when ready
_PLAN_PRICES = {
    "learner": {"amount": 2900, "name": "Learner — $29/mo"},
    "pro": {"amount": 5900, "name": "Pro — $59/mo"},
}


def _stripe():
    import stripe
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Stripe not configured")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


async def _get_or_create_subscription(user: User, db: AsyncSession) -> Subscription:
    result = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    sub = result.scalar_one_or_none()
    if not sub:
        sub = Subscription(user_id=user.id, plan="free", status="active")
        db.add(sub)
        await db.flush()
    return sub


class CheckoutRequest(BaseModel):
    plan: str
    success_url: str
    cancel_url: str


class PortalRequest(BaseModel):
    return_url: str


@router.post("/checkout")
async def create_checkout(
    body: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.plan == "org":
        return {"checkout_url": None, "message": "Contact sales for org plans"}

    if body.plan not in _PLAN_PRICES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown plan: {body.plan}")

    stripe = _stripe()
    sub = await _get_or_create_subscription(current_user, db)

    if not sub.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=current_user.full_name or current_user.email,
            metadata={"user_id": str(current_user.id)},
        )
        sub.stripe_customer_id = customer.id
        await db.commit()

    price_info = _PLAN_PRICES[body.plan]
    session = stripe.checkout.Session.create(
        customer=sub.stripe_customer_id,
        mode="subscription",
        line_items=[{
            "price_data": {
                "currency": "usd",
                "unit_amount": price_info["amount"],
                "recurring": {"interval": "month"},
                "product_data": {"name": price_info["name"]},
            },
            "quantity": 1,
        }],
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={"user_id": str(current_user.id), "plan": body.plan},
    )
    return {"checkout_url": session.url}


@router.post("/portal")
async def create_portal(
    body: PortalRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stripe = _stripe()
    sub = await _get_or_create_subscription(current_user, db)

    if not sub.stripe_customer_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No billing account found")

    portal = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=body.return_url,
    )
    return {"portal_url": portal.url}


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(None, alias="stripe-signature"),
    db: AsyncSession = Depends(get_db),
):
    stripe = _stripe()
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Webhook secret not configured")

    body = await request.body()
    try:
        event = stripe.Webhook.construct_event(body, stripe_signature, settings.STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid webhook signature")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        customer_id = data.get("customer")
        plan = data.get("metadata", {}).get("plan", "learner")
        stripe_sub_id = data.get("subscription")
        result = await db.execute(select(Subscription).where(Subscription.stripe_customer_id == customer_id))
        sub = result.scalar_one_or_none()
        if sub:
            sub.plan = plan
            sub.status = "active"
            sub.stripe_subscription_id = stripe_sub_id
            await db.commit()

    elif event_type == "customer.subscription.updated":
        stripe_sub_id = data.get("id")
        result = await db.execute(select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id))
        sub = result.scalar_one_or_none()
        if sub:
            sub.status = data.get("status", sub.status)
            sub.cancel_at_period_end = data.get("cancel_at_period_end", False)
            period_end = data.get("current_period_end")
            if period_end:
                from datetime import datetime, timezone
                sub.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)
            await db.commit()

    elif event_type == "customer.subscription.deleted":
        stripe_sub_id = data.get("id")
        result = await db.execute(select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id))
        sub = result.scalar_one_or_none()
        if sub:
            sub.plan = "free"
            sub.status = "canceled"
            sub.stripe_subscription_id = None
            await db.commit()

    return {"received": True}


@router.get("/subscription")
async def get_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = await _get_or_create_subscription(current_user, db)
    await db.commit()
    return {
        "plan": sub.plan,
        "status": sub.status,
        "cancel_at_period_end": sub.cancel_at_period_end,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
    }
