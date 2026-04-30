from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from guidian.core.config import settings
from guidian.routers import (
    admin,
    auth,
    certificates,
    compliance,
    courses,
    enrollments,
    exam,
    generation,
    learner,
    organizations,
    quiz,
    users,
    xapi,
)
from guidian.routers.billing import router as billing_router
from guidian.routers.compliance_submissions import router as compliance_submissions_router
from guidian.routers.opportunities import router as opportunities_router
from guidian.routers.privacy import router as privacy_router
from guidian.routers.scorm import router as scorm_router
from guidian.routers.teacher import router as teacher_router
from guidian.routers.nova import router as nova_router
from guidian.routers.waitlist import router as waitlist_router

app = FastAPI(title=settings.PROJECT_NAME, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.PROJECT_NAME}


api_prefix = settings.API_V1_PREFIX
app.include_router(auth.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(organizations.router, prefix=api_prefix)
app.include_router(courses.router, prefix=api_prefix)
app.include_router(enrollments.router, prefix=api_prefix)
app.include_router(enrollments.progress_router, prefix=api_prefix)
app.include_router(quiz.router, prefix=api_prefix)
app.include_router(exam.router, prefix=api_prefix)
app.include_router(compliance.router, prefix=api_prefix)
app.include_router(certificates.router, prefix=api_prefix)
app.include_router(xapi.router, prefix=api_prefix)
app.include_router(admin.router, prefix=api_prefix)
app.include_router(learner.router, prefix=api_prefix)
app.include_router(generation.router, prefix=api_prefix)
app.include_router(privacy_router, prefix=api_prefix)
app.include_router(scorm_router, prefix=api_prefix)
app.include_router(opportunities_router, prefix=api_prefix)
app.include_router(compliance_submissions_router, prefix=api_prefix)
app.include_router(teacher_router, prefix=api_prefix)
app.include_router(nova_router, prefix=api_prefix)
app.include_router(billing_router, prefix=api_prefix)
app.include_router(waitlist_router, prefix=api_prefix)
