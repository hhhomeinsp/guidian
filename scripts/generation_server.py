"""
OpenClaw generation server.

Routes Guidian course generation through the local claude CLI (Claude Code Max plan),
eliminating per-token Anthropic API billing.

Run with:
  python3 -m uvicorn scripts.generation_server:app --host 127.0.0.1 --port 8765 --workers 1
"""
import asyncio
import contextlib
import json
import os
import shutil
import sys
import uuid
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="OpenClaw Generation Server", docs_url=None, redoc_url=None)

_jobs: dict[str, dict[str, Any]] = {}

_SCRIPT = Path(__file__).parent / "cc_generate_course.py"
_CLAUDE_DEFAULT = Path("/home/claudeuser/.local/bin/claude")
_JOB_DIR = Path("/tmp/openclaw_jobs")


class GenerateRequest(BaseModel):
    title: str
    slug: str
    ceu_hours: float
    num_modules: int
    lessons_per_module: int
    accrediting_body: str = ""
    prompt: str
    target_audience: str = ""
    api_base: str
    token: str


class JobStatus(BaseModel):
    job_id: str
    status: str  # queued | running | succeeded | failed
    progress: dict = {}
    course_id: str | None = None
    error: str | None = None


def _find_claude() -> str | None:
    if _CLAUDE_DEFAULT.exists():
        return str(_CLAUDE_DEFAULT)
    return shutil.which("claude")


@app.get("/health")
async def health():
    claude = _find_claude()
    return {
        "status": "ok",
        "claude_available": claude is not None,
        "claude_path": claude,
        "jobs": {
            "total": len(_jobs),
            "running": sum(1 for j in _jobs.values() if j["status"] == "running"),
        },
    }


@app.post("/generate", status_code=202)
async def generate(req: GenerateRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status": "queued",
        "progress": {"modules_done": 0, "modules_total": req.num_modules},
        "course_id": None,
        "error": None,
    }
    background_tasks.add_task(_run_job, job_id, req)
    return {"job_id": job_id, "status": "queued"}


@app.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(404, "Job not found")
    return JobStatus(job_id=job_id, **_jobs[job_id])


async def _run_job(job_id: str, req: GenerateRequest) -> None:
    _JOB_DIR.mkdir(parents=True, exist_ok=True)
    job_file = _JOB_DIR / f"{job_id}.json"
    _jobs[job_id]["status"] = "running"

    env = {**os.environ, "PATH": f"/home/claudeuser/.local/bin:{os.environ.get('PATH', '')}"}

    cmd = [
        sys.executable, str(_SCRIPT),
        "--title", req.title,
        "--slug", req.slug,
        "--ceu-hours", str(req.ceu_hours),
        "--modules", str(req.num_modules),
        "--lessons-per-module", str(req.lessons_per_module),
        "--prompt", req.prompt,
        "--audience", req.target_audience,
        "--accrediting-body", req.accrediting_body,
        "--api", req.api_base,
        "--token", req.token,
        "--job-file", str(job_file),
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env,
        )

        async def _sync_progress() -> None:
            """Mirror job file progress into the in-memory store while the script runs."""
            while True:
                await asyncio.sleep(10)
                if job_file.exists():
                    try:
                        data = json.loads(job_file.read_text())
                        for key in ("progress", "course_id"):
                            if key in data:
                                _jobs[job_id][key] = data[key]
                    except Exception:
                        pass

        sync_task = asyncio.create_task(_sync_progress())
        try:
            await proc.wait()
        finally:
            sync_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await sync_task

        # Read final state from job file written by the script.
        if job_file.exists():
            data = json.loads(job_file.read_text())
            _jobs[job_id].update(data)
            if data.get("status") not in ("succeeded", "failed"):
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = f"Script exited with code {proc.returncode}"
        else:
            _jobs[job_id].update({
                "status": "failed",
                "error": f"Script exited with code {proc.returncode}, no job file written",
            })

    except Exception as exc:
        _jobs[job_id].update({"status": "failed", "error": str(exc)})
