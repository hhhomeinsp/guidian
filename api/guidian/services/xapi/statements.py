"""
xAPI (Tin Can) statement builders.

Produces canonical statement dicts that get persisted to `xapi_statements`
and are consumable by any xAPI-compliant Learning Record Store.

Verb IRIs are drawn from the ADL registry and the community Tin Can registry
where a matching standard verb exists. Where no standard verb fits (notably
credential issuance), we namespace under `https://guidian.app/xapi/verbs/`.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from guidian.models.models import Certificate, Course, Lesson, User

# Public base IRI for this platform's activities. This does NOT have to be a
# live URL — it's an identifier, per xAPI spec 4.1.4.
PLATFORM_IRI = "https://guidian.app/xapi"
PLATFORM_NAME = "Guidian"


# --- Verbs -----------------------------------------------------------------

_VERBS: dict[str, dict[str, Any]] = {
    "registered": {
        "id": "http://adlnet.gov/expapi/verbs/registered",
        "display": {"en-US": "registered"},
    },
    "attempted": {
        "id": "http://adlnet.gov/expapi/verbs/attempted",
        "display": {"en-US": "attempted"},
    },
    "passed": {
        "id": "http://adlnet.gov/expapi/verbs/passed",
        "display": {"en-US": "passed"},
    },
    "failed": {
        "id": "http://adlnet.gov/expapi/verbs/failed",
        "display": {"en-US": "failed"},
    },
    "completed": {
        "id": "http://adlnet.gov/expapi/verbs/completed",
        "display": {"en-US": "completed"},
    },
    "experienced": {
        "id": "http://adlnet.gov/expapi/verbs/experienced",
        "display": {"en-US": "experienced"},
    },
    # Credential issuance — no matching ADL verb; use the community registry's
    # "earned" for credential/badge acquisition.
    "earned": {
        "id": "http://id.tincanapi.com/verb/earned",
        "display": {"en-US": "earned"},
    },
}


def verb(key: str) -> dict[str, Any]:
    try:
        return _VERBS[key]
    except KeyError as e:
        raise ValueError(f"Unknown xAPI verb key: {key}") from e


# --- Actors ----------------------------------------------------------------

def actor_from_user(user: User) -> dict[str, Any]:
    return {
        "objectType": "Agent",
        "name": user.full_name or user.email,
        "mbox": f"mailto:{user.email}",
    }


# --- Activities ------------------------------------------------------------

def course_activity(course: Course) -> dict[str, Any]:
    return {
        "objectType": "Activity",
        "id": f"{PLATFORM_IRI}/courses/{course.id}",
        "definition": {
            "name": {"en-US": course.title},
            "description": {"en-US": course.description or ""},
            "type": "http://adlnet.gov/expapi/activities/course",
        },
    }


def lesson_activity(lesson: Lesson, course: Course) -> dict[str, Any]:
    return {
        "objectType": "Activity",
        "id": f"{PLATFORM_IRI}/courses/{course.id}/lessons/{lesson.id}",
        "definition": {
            "name": {"en-US": lesson.title},
            "type": "http://adlnet.gov/expapi/activities/lesson",
        },
    }


def certificate_activity(cert: Certificate, course: Course) -> dict[str, Any]:
    return {
        "objectType": "Activity",
        "id": f"{PLATFORM_IRI}/certificates/{cert.id}",
        "definition": {
            "name": {"en-US": f"Certificate: {course.title}"},
            "description": {
                "en-US": f"{cert.ceu_hours} CEU hours · code {cert.verification_code}"
            },
            "type": "http://id.tincanapi.com/activitytype/certificate",
            "extensions": {
                f"{PLATFORM_IRI}/extensions/verification-code": cert.verification_code,
                f"{PLATFORM_IRI}/extensions/ceu-hours": cert.ceu_hours,
            },
        },
    }


# --- Context + result builders --------------------------------------------

def base_context(course: Course | None = None) -> dict[str, Any]:
    ctx: dict[str, Any] = {
        "platform": PLATFORM_NAME,
        "language": "en-US",
    }
    if course is not None:
        ctx["contextActivities"] = {
            "parent": [{"id": f"{PLATFORM_IRI}/courses/{course.id}"}]
        }
    return ctx


def _iso8601_duration_seconds(seconds: int) -> str:
    """Minimal ISO-8601 duration emitter (e.g. 930 → 'PT15M30S')."""
    if seconds <= 0:
        return "PT0S"
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    parts: list[str] = []
    if h:
        parts.append(f"{h}H")
    if m:
        parts.append(f"{m}M")
    if s or not parts:
        parts.append(f"{s}S")
    return "PT" + "".join(parts)


def lesson_completed_result(seconds_spent: int) -> dict[str, Any]:
    return {"completion": True, "duration": _iso8601_duration_seconds(seconds_spent)}


def quiz_result(score: float, passed: bool) -> dict[str, Any]:
    return {
        "completion": True,
        "success": passed,
        "score": {"scaled": max(0.0, min(1.0, float(score)))},
    }


# --- Top-level statement assembly -----------------------------------------

def build_statement(
    *,
    actor: dict[str, Any],
    verb_dict: dict[str, Any],
    object_: dict[str, Any],
    result: dict[str, Any] | None = None,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    stmt: dict[str, Any] = {"actor": actor, "verb": verb_dict, "object": object_}
    if result is not None:
        stmt["result"] = result
    if context is not None:
        stmt["context"] = context
    return stmt


# --- Convenience event builders -------------------------------------------

def registered(user: User, course: Course) -> dict[str, Any]:
    return build_statement(
        actor=actor_from_user(user),
        verb_dict=verb("registered"),
        object_=course_activity(course),
        context=base_context(),
    )


def lesson_completed(user: User, lesson: Lesson, course: Course, seconds_spent: int) -> dict[str, Any]:
    return build_statement(
        actor=actor_from_user(user),
        verb_dict=verb("completed"),
        object_=lesson_activity(lesson, course),
        result=lesson_completed_result(seconds_spent),
        context=base_context(course),
    )


def quiz_attempted(
    user: User, lesson: Lesson, course: Course, score: float, passed: bool
) -> dict[str, Any]:
    return build_statement(
        actor=actor_from_user(user),
        verb_dict=verb("attempted"),
        object_=lesson_activity(lesson, course),
        result=quiz_result(score, passed),
        context=base_context(course),
    )


def quiz_outcome(
    user: User, lesson: Lesson, course: Course, score: float, passed: bool
) -> dict[str, Any]:
    return build_statement(
        actor=actor_from_user(user),
        verb_dict=verb("passed") if passed else verb("failed"),
        object_=lesson_activity(lesson, course),
        result=quiz_result(score, passed),
        context=base_context(course),
    )


def certificate_earned(user: User, cert: Certificate, course: Course) -> dict[str, Any]:
    return build_statement(
        actor=actor_from_user(user),
        verb_dict=verb("earned"),
        object_=certificate_activity(cert, course),
        result={
            "completion": True,
            "success": True,
            "extensions": {
                f"{PLATFORM_IRI}/extensions/ceu-hours": cert.ceu_hours,
            },
        },
        context=base_context(course),
    )
