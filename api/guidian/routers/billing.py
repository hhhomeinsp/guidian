from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from guidian.core.config import settings
from guidian.db.session import get_db
from guidian.models.models import Course, CoursePurchase, Subscription, User
from guidian.routers.deps import get_current_user

router = APIRouter(prefix="/billing", tags=["billing"])

# --- Pricing ---

# Per-course one-time purchase prices (cents). Lookup by course slug.
COURSE_PRICES: dict[str, dict[str, object]] = {
    "nmls-8hr-safe-act-ce": {"amount": 4900, "label": "NMLS 8-Hour SAFE Act CE"},
    "certified-home-inspector-100hr": {"amount": 19900, "label": "Certified Home Inspector — 100-Hour Course"},
    "tx-home-inspector-ce": {"amount": 4900, "label": "TX Home Inspector CE"},
    "fl-real-estate-ethics": {"amount": 3900, "label": "FL Real Estate Ethics CE"},
    "tx-real-estate-ethics": {"amount": 3900, "label": "TX Real Estate Ethics CE"},
    "nc-real-estate-annual-update": {"amount": 3900, "label": "NC Real Estate Annual Update"},
    "fl-fair-housing": {"amount": 3900, "label": "FL Fair Housing CE"},
    "ga-real-estate-ce-36hr": {"amount": 4900, "label": "GA Real Estate CE"},
    "fl-general-contractor-ce-14hr": {"amount": 3900, "label": "FL General Contractor CE"},
    "fl-insurance-adjuster-ce-24hr": {"amount": 4900, "label": "FL Insurance Adjuster CE"},
    "ohio-real-estate-ce": {"amount": 3900, "label": "OH Real Estate CE"},
    "fl-mortgage-broker-ce": {"amount": 3900, "label": "FL Mortgage Broker CE"},
}
DEFAULT_COURSE_PRICE = 3900

# Subscription plans. Pro unlocks Nova on every course the learner owns.
PLANS: dict[str, dict[str, object]] = {
    "free": {"nova": False, "price": 0, "label": "Free"},
    "pro": {"nova": True, "price": 1900, "label": "Pro — $19/mo"},
}


def price_for_slug(slug: str) -> int:
    info = COURSE_PRICES.get(slug)
    if info is None:
        return DEFAULT_COURSE_PRICE
    return int(info["amount"])  # type: ignore[arg-type]


def label_for_slug(slug: str, fallback: str) -> str:
    info = COURSE_PRICES.get(slug)
    if info is None:
        return fallback
    return str(info["label"])


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
        sub = Subscription(user_id=user.id, plan="free", status="active", nova_enabled=False)
        db.add(sub)
        await db.flush()
    return sub


# --- Subscription checkout (Pro / legacy plans) ---

class CheckoutRequest(BaseModel):
    plan: str
    success_url: str | None = None
    cancel_url: str | None = None


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

    if body.plan not in PLANS or body.plan == "free":
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

    web_origin = settings.WEB_BASE_URL.rstrip("/")
    success_url = body.success_url or f"{web_origin}/billing/success?plan={body.plan}"
    cancel_url = body.cancel_url or f"{web_origin}/pricing"

    plan_info = PLANS[body.plan]
    session = stripe.checkout.Session.create(
        customer=sub.stripe_customer_id,
        mode="subscription",
        line_items=[{
            "price_data": {
                "currency": "usd",
                "unit_amount": int(plan_info["price"]),  # type: ignore[arg-type]
                "recurring": {"interval": "month"},
                "product_data": {"name": str(plan_info["label"])},
            },
            "quantity": 1,
        }],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": str(current_user.id),
            "plan": body.plan,
            "type": "subscription",
        },
    )
    return {"checkout_url": session.url}


# --- Per-course one-time checkout ---

class CourseCheckoutRequest(BaseModel):
    course_id: UUID


@router.post("/course/checkout")
async def create_course_checkout(
    body: CourseCheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    course = (
        await db.execute(select(Course).where(Course.id == body.course_id))
    ).scalar_one_or_none()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")

    existing = (
        await db.execute(
            select(CoursePurchase).where(
                CoursePurchase.user_id == current_user.id,
                CoursePurchase.course_id == course.id,
            )
        )
    ).scalar_one_or_none()
    if existing and existing.status == "completed":
        return {"checkout_url": None, "message": "already_owned"}

    stripe = _stripe()
    sub = await _get_or_create_subscription(current_user, db)

    if not sub.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=current_user.full_name or current_user.email,
            metadata={"user_id": str(current_user.id)},
        )
        sub.stripe_customer_id = customer.id
        await db.flush()

    amount = price_for_slug(course.slug)
    label = label_for_slug(course.slug, course.title)
    web_origin = settings.WEB_BASE_URL.rstrip("/")

    session = stripe.checkout.Session.create(
        customer=sub.stripe_customer_id,
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": "usd",
                "unit_amount": amount,
                "product_data": {"name": label},
            },
            "quantity": 1,
        }],
        success_url=f"{web_origin}/billing/course-success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{web_origin}/courses",
        metadata={
            "user_id": str(current_user.id),
            "course_id": str(course.id),
            "course_slug": course.slug,
            "type": "course_purchase",
        },
    )

    if existing is None:
        purchase = CoursePurchase(
            user_id=current_user.id,
            course_id=course.id,
            amount_cents=amount,
            status="pending",
            stripe_checkout_session_id=session.id,
        )
        db.add(purchase)
    else:
        existing.amount_cents = amount
        existing.stripe_checkout_session_id = session.id
        existing.status = "pending"
    await db.commit()

    return {"checkout_url": session.url}


@router.get("/my-courses")
async def my_courses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        await db.execute(
            select(CoursePurchase).where(
                CoursePurchase.user_id == current_user.id,
                CoursePurchase.status == "completed",
            )
        )
    ).scalars().all()
    return {"course_ids": [str(p.course_id) for p in rows]}


@router.get("/course/session/{session_id}")
async def course_purchase_by_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    purchase = (
        await db.execute(
            select(CoursePurchase).where(
                CoursePurchase.user_id == current_user.id,
                CoursePurchase.stripe_checkout_session_id == session_id,
            )
        )
    ).scalar_one_or_none()
    if not purchase:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase not found")
    course = (
        await db.execute(select(Course).where(Course.id == purchase.course_id))
    ).scalar_one_or_none()
    return {
        "course_id": str(purchase.course_id),
        "course_title": course.title if course else None,
        "status": purchase.status,
        "amount_cents": purchase.amount_cents,
    }


@router.get("/course/{course_id}/owned")
async def course_owned(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    purchase = (
        await db.execute(
            select(CoursePurchase).where(
                CoursePurchase.user_id == current_user.id,
                CoursePurchase.course_id == course_id,
                CoursePurchase.status == "completed",
            )
        )
    ).scalar_one_or_none()
    return {"owned": purchase is not None}


@router.get("/course/{course_id}/price")
async def course_price(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    course = (
        await db.execute(select(Course).where(Course.id == course_id))
    ).scalar_one_or_none()
    if not course:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Course not found")
    return {"amount_cents": price_for_slug(course.slug), "slug": course.slug}


# --- Customer portal ---

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


# --- Webhook ---

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
    metadata = data.get("metadata") or {}
    purchase_type = metadata.get("type")

    if event_type == "checkout.session.completed":
        if purchase_type == "course_purchase":
            session_id = data.get("id")
            payment_intent = data.get("payment_intent")
            user_id = metadata.get("user_id")
            course_id = metadata.get("course_id")
            purchase = None
            if session_id:
                purchase = (
                    await db.execute(
                        select(CoursePurchase).where(
                            CoursePurchase.stripe_checkout_session_id == session_id
                        )
                    )
                ).scalar_one_or_none()
            if purchase is None and user_id and course_id:
                purchase = (
                    await db.execute(
                        select(CoursePurchase).where(
                            CoursePurchase.user_id == UUID(user_id),
                            CoursePurchase.course_id == UUID(course_id),
                        )
                    )
                ).scalar_one_or_none()
            if purchase is not None:
                purchase.status = "completed"
                if payment_intent:
                    purchase.stripe_payment_intent_id = payment_intent
                await db.commit()
        else:
            # Subscription checkout
            customer_id = data.get("customer")
            plan = metadata.get("plan", "pro")
            stripe_sub_id = data.get("subscription")
            sub = (
                await db.execute(
                    select(Subscription).where(Subscription.stripe_customer_id == customer_id)
                )
            ).scalar_one_or_none()
            if sub:
                sub.plan = plan
                sub.status = "active"
                sub.stripe_subscription_id = stripe_sub_id
                sub.nova_enabled = bool(PLANS.get(plan, {}).get("nova", False))
                await db.commit()

    elif event_type == "customer.subscription.updated":
        stripe_sub_id = data.get("id")
        sub = (
            await db.execute(
                select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id)
            )
        ).scalar_one_or_none()
        if sub:
            sub.status = data.get("status", sub.status)
            sub.cancel_at_period_end = data.get("cancel_at_period_end", False)
            period_end = data.get("current_period_end")
            if period_end:
                from datetime import datetime, timezone
                sub.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)
            # Re-evaluate nova access based on current plan + active status
            sub.nova_enabled = (
                bool(PLANS.get(sub.plan, {}).get("nova", False))
                and sub.status == "active"
            )
            await db.commit()

    elif event_type == "customer.subscription.deleted":
        stripe_sub_id = data.get("id")
        sub = (
            await db.execute(
                select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id)
            )
        ).scalar_one_or_none()
        if sub:
            sub.plan = "free"
            sub.status = "canceled"
            sub.stripe_subscription_id = None
            sub.nova_enabled = False
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
        "nova_enabled": sub.nova_enabled,
        "cancel_at_period_end": sub.cancel_at_period_end,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
    }
