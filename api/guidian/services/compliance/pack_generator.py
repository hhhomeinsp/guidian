"""Generate a compliance submission pack (ZIP) for a course + state."""
import io
import zipfile
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from guidian.models.models import ComplianceSubmission, Course, Lesson, Module, StateRequirement


async def generate_compliance_pack(course_id: UUID, state_code: str, db: AsyncSession) -> bytes:
    course = (
        await db.execute(
            select(Course)
            .where(Course.id == course_id)
            .options(selectinload(Course.modules).selectinload(Module.lessons))
        )
    ).scalar_one_or_none()
    if not course:
        raise ValueError(f"Course {course_id} not found")

    req = (
        await db.execute(
            select(StateRequirement).where(
                StateRequirement.state_code == state_code,
                StateRequirement.profession == "home_inspector",
            )
        )
    ).scalar_one_or_none()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("course_outline.txt", _build_outline(course))
        zf.writestr("quiz_samples.txt", _build_quiz_samples(course))
        zf.writestr("provider_info.txt", _PROVIDER_INFO)
        zf.writestr("submission_checklist.txt", _build_checklist(course, req, state_code))
        zf.writestr("certificate_sample.txt", _build_cert_sample(course))

    return buf.getvalue()


def _build_outline(course: Course) -> str:
    lines = [
        f"COURSE OUTLINE",
        f"==============",
        f"Title: {course.title}",
        f"Description: {course.description or 'N/A'}",
        f"CEU Hours: {course.ceu_hours}",
        f"Accrediting Body: {course.accrediting_body or 'N/A'}",
        f"",
    ]
    for module in course.modules:
        lines.append(f"Module {module.order_index}: {module.title}")
        if module.description:
            lines.append(f"  {module.description}")
        for lesson in module.lessons:
            lines.append(f"  Lesson {lesson.order_index}: {lesson.title} ({lesson.clock_minutes} min)")
            for obj in (lesson.objectives or []):
                lines.append(f"    - {obj}")
        lines.append("")
    return "\n".join(lines)


def _build_quiz_samples(course: Course) -> str:
    lines = [
        "SAMPLE QUIZ QUESTIONS (FOR REVIEW ONLY — NOT FOR DISTRIBUTION)",
        "================================================================",
        "",
    ]
    count = 0
    for module in course.modules[:2]:
        for lesson in module.lessons:
            questions = (lesson.quiz or {}).get("questions", [])
            for q in questions:
                if count >= 5:
                    break
                count += 1
                lines.append(f"Q{count}. {q.get('prompt', '')}")
                for i, choice in enumerate(q.get("choices", [])):
                    lines.append(f"  {chr(65+i)}. {choice}")
                correct_idx = q.get("correct", 0)
                if isinstance(correct_idx, int):
                    correct_letter = chr(65 + correct_idx)
                    lines.append(f"  Correct Answer: {correct_letter}")
                if q.get("explanation"):
                    lines.append(f"  Explanation: {q['explanation']}")
                lines.append("")
            if count >= 5:
                break
    if count == 0:
        lines.append("(No quiz questions available yet — course content still generating)")
    return "\n".join(lines)


_PROVIDER_INFO = """\
PROVIDER INFORMATION
====================
Provider: Guidian Learning Inc.
Website: https://guidian.io
Contact: compliance@guidian.io
Address: [Provider Address]
Phone: [Provider Phone]
"""


def _build_checklist(course: Course, req: StateRequirement | None, state_code: str) -> str:
    if req:
        reg_body = req.regulatory_body
        reg_url = req.regulatory_url
        fee = f"${req.application_fee:.2f}" if req.application_fee else "No fee"
        fmt = req.submission_format.replace("_", " ").title()
        days = req.processing_days
        score = f"{int(req.min_passing_score * 100)}%"
    else:
        reg_body = f"{state_code} Regulatory Body"
        reg_url = "See state website"
        fee = "See state website"
        fmt = "See state website"
        days = "Unknown"
        score = "See state requirements"

    lines = [
        f"SUBMISSION CHECKLIST — {state_code}",
        "=" * 40,
        f"",
        f"Regulatory Body: {reg_body}",
        f"Regulatory URL: {reg_url}",
        f"Application Fee: {fee}",
        f"Submission Format: {fmt}",
        f"Estimated Processing Time: {days} business days",
        f"Minimum Passing Score: {score}",
        f"",
        "ITEMS TO SUBMIT:",
        "[ ] Completed course outline (course_outline.txt from this package)",
        "[ ] Provider information (provider_info.txt from this package)",
        "[ ] Sample quiz questions (quiz_samples.txt from this package)",
        "[ ] Certificate of completion sample (certificate_sample.txt from this package)",
        "[ ] Proof of provider accreditation",
        "[ ] Application fee payment (if applicable)",
        "",
        "SUBMISSION STEPS:",
        f"1. Visit: {reg_url}",
        f"2. Navigate to provider/course approval section",
        f"3. Submit all documents in {fmt} format",
        f"4. Allow {days} business days for processing",
        f"5. Upon approval, record approval number in Guidian compliance tracker",
    ]
    return "\n".join(lines)


def _build_cert_sample(course: Course) -> str:
    return f"""\
CERTIFICATE OF COMPLETION — SAMPLE TEMPLATE
============================================

This certifies that:

[LEARNER FULL NAME]

has successfully completed the course:

{course.title}

CEU Hours Awarded: {course.ceu_hours}
Accrediting Body: {course.accrediting_body or 'Guidian Learning Inc.'}
Completion Date: [DATE OF COMPLETION]
Certificate Issued: [ISSUE DATE]
Expires: [EXPIRATION DATE]
Verification Code: [UNIQUE VERIFICATION CODE]

This certificate may be verified at: https://guidian.io/verify
"""
