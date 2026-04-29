#!/usr/bin/env python3
"""
Generate a Guidian CE course using Claude Code Max plan (subprocess claude CLI).

LLM costs are billed to the Claude Code Max subscription rather than per-token API charges.

Usage:
  python3 scripts/cc_generate_course.py \\
    --title "Course Title" \\
    --slug "course-slug" \\
    --ceu-hours 3.0 \\
    --modules 3 \\
    --lessons-per-module 4 \\
    --accrediting-body "FREC" \\
    --prompt "Course topic and key areas to cover" \\
    --audience "Target learners" \\
    --api https://guidian-api.onrender.com/api/v1 \\
    --token "JWT_TOKEN"

Resume an interrupted run by re-running with the same arguments.
Progress is saved to /tmp/cc_course_progress.json.
"""
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

CLAUDE_BIN_DEFAULT = "/home/claudeuser/.local/bin/claude"
PROGRESS_FILE_DEFAULT = "/tmp/cc_course_progress.json"
MAX_RETRIES = 3


def log(msg: str) -> None:
    print(msg, flush=True)


def find_claude() -> str:
    if Path(CLAUDE_BIN_DEFAULT).exists():
        return CLAUDE_BIN_DEFAULT
    import shutil
    found = shutil.which("claude")
    if found:
        return found
    print(
        f"ERROR: claude CLI not found at {CLAUDE_BIN_DEFAULT} or in PATH. "
        "Install Claude Code or add it to PATH.",
        file=sys.stderr,
    )
    sys.exit(1)


def load_progress(progress_file: str) -> dict:
    p = Path(progress_file)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            pass
    return {}


def save_progress(progress: dict, progress_file: str) -> None:
    Path(progress_file).write_text(json.dumps(progress, indent=2))


def update_job_file(job_file: str | None, data: dict) -> None:
    if not job_file:
        return
    try:
        Path(job_file).parent.mkdir(parents=True, exist_ok=True)
        Path(job_file).write_text(json.dumps(data, indent=2))
    except Exception as e:
        log(f"Warning: could not write job file {job_file}: {e}")


def api_request(
    api_base: str,
    token: str,
    method: str,
    path: str,
    body: dict | None = None,
) -> dict:
    url = f"{api_base}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def build_module_prompt(
    module_index: int,
    num_modules: int,
    course_title: str,
    course_prompt: str,
    audience: str,
    accrediting_body: str,
    lessons_per_module: int,
    clock_minutes_per_lesson: int,
    ceu_hours: float,
) -> str:
    min_words = clock_minutes_per_lesson * 40
    min_sections = max(4, clock_minutes_per_lesson // 4)

    return f"""Generate module {module_index + 1} of {num_modules} for a continuing education course.

Course title: {course_title}
Course description: {course_prompt}
Target audience: {audience or "professionals"}
Accrediting body: {accrediting_body or "N/A"}
Total course CEU hours: {ceu_hours}
Lessons in this module: {lessons_per_module}
Clock minutes per lesson: {clock_minutes_per_lesson}

CONTENT REQUIREMENTS (per lesson):
- mdx_content must be at least {min_words} words
- mdx_content must have at least {min_sections} level-2 (##) headings — each ## becomes one slide
- At least 4 quiz questions per lesson, scenario-based (not recall)
- At least 1 Mermaid diagram in the first lesson of this module (set diagrams: [] for subsequent lessons)

OUTPUT: Return ONLY a valid JSON object. No markdown code fences, no explanation, no preamble.

JSON schema to follow exactly:
{{
  "title": "Module {module_index + 1} Title",
  "description": "One-paragraph module overview",
  "order_index": {module_index},
  "lessons": [
    {{
      "title": "Lesson Title",
      "objectives": ["objective 1", "objective 2", "objective 3"],
      "mdx_content": "# Lesson Title\\n\\n## Section 1\\n\\nAt least {max(50, min_words // min_sections)} words per section...\\n\\n## Section 2\\n\\n...",
      "style_tags": ["visual", "read"],
      "diagrams": [{{"id": "d1", "mermaid": "flowchart TD\\n  A[Topic] --> B[Result]", "url": null}}],
      "quiz": {{
        "questions": [
          {{"id": "q1", "type": "single_choice", "prompt": "Scenario-based question?", "choices": ["Option A", "Option B", "Option C", "Option D"], "correct": 0, "explanation": "Why A is correct."}},
          {{"id": "q2", "type": "true_false", "prompt": "True/false statement.", "choices": ["True", "False"], "correct": true, "explanation": "Why true."}},
          {{"id": "q3", "type": "single_choice", "prompt": "Another scenario?", "choices": ["Option A", "Option B", "Option C", "Option D"], "correct": 2, "explanation": "Why C is correct."}},
          {{"id": "q4", "type": "single_choice", "prompt": "Final question?", "choices": ["Option A", "Option B", "Option C", "Option D"], "correct": 1, "explanation": "Why B is correct."}}
        ]
      }},
      "clock_minutes": {clock_minutes_per_lesson},
      "requires_completion": false
    }}
  ]
}}

Generate exactly {lessons_per_module} lesson objects in the lessons array.
Each lesson must meet the word count and section count requirements.
Return ONLY the JSON object. Nothing else."""


def extract_json(text: str) -> dict:
    """Extract a JSON object from claude output, handling surrounding text or code fences."""
    text = text.strip()

    # Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip ```json ... ``` or ``` ... ``` fences
    if "```" in text:
        lines = text.splitlines()
        inner: list[str] = []
        in_block = False
        for line in lines:
            if line.startswith("```") and not in_block:
                in_block = True
                continue
            elif line.startswith("```") and in_block:
                break
            elif in_block:
                inner.append(line)
        stripped = "\n".join(inner).strip()
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            pass

    # Find outermost JSON object by brace matching
    start = text.find("{")
    if start == -1:
        raise ValueError("No JSON object found in claude output")
    depth = 0
    end = -1
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end == -1:
        raise ValueError("Unterminated JSON object in claude output")
    return json.loads(text[start : end + 1])


def generate_module_via_claude(claude_bin: str, prompt: str, attempt: int = 1) -> dict:
    log(f"  Running claude (attempt {attempt}/{MAX_RETRIES})...")
    env = dict(os.environ)
    env["PATH"] = f"/home/claudeuser/.local/bin:{env.get('PATH', '')}"

    result = subprocess.run(
        [claude_bin, "--print", "--permission-mode", "bypassPermissions", prompt],
        capture_output=True,
        text=True,
        timeout=1800,
        env=env,
    )

    if result.returncode != 0:
        stderr_snippet = result.stderr[:300] if result.stderr else "(no stderr)"
        raise RuntimeError(f"claude exited {result.returncode}: {stderr_snippet}")

    if not result.stdout.strip():
        raise ValueError("claude returned empty output")

    return extract_json(result.stdout)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a Guidian CE course using Claude Code Max plan",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--title", required=True, help="Course title")
    parser.add_argument(
        "--slug", required=True, help="URL slug (lowercase letters, digits, hyphens)"
    )
    parser.add_argument("--ceu-hours", type=float, required=True, help="Total CEU hours")
    parser.add_argument("--modules", type=int, required=True, help="Number of modules")
    parser.add_argument(
        "--lessons-per-module", type=int, required=True, help="Lessons per module"
    )
    parser.add_argument("--accrediting-body", default="", help="Accrediting body")
    parser.add_argument(
        "--prompt", required=True, help="Course topic and key areas to cover"
    )
    parser.add_argument("--audience", default="", help="Target learners")
    parser.add_argument(
        "--api",
        default=os.environ.get(
            "GUIDIAN_API_BASE", "https://guidian-api.onrender.com/api/v1"
        ),
        help="API base URL (or set GUIDIAN_API_BASE env var)",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("GUIDIAN_TOKEN", ""),
        help="JWT token (or set GUIDIAN_TOKEN env var)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be generated without calling the API",
    )
    parser.add_argument(
        "--job-file",
        default=None,
        help="Path to job status JSON file (updated during run; used by admin API)",
    )
    parser.add_argument(
        "--progress-file",
        default=PROGRESS_FILE_DEFAULT,
        help=f"Resume checkpoint file (default: {PROGRESS_FILE_DEFAULT})",
    )
    parser.add_argument(
        "--config",
        help="JSON config file with any of the above keys (kebab-case)",
    )
    args = parser.parse_args()

    # Merge config file (only fills in unset values)
    if args.config:
        cfg = json.loads(Path(args.config).read_text())
        for k, v in cfg.items():
            k_attr = k.replace("-", "_")
            if hasattr(args, k_attr) and not getattr(args, k_attr):
                setattr(args, k_attr, v)

    if not args.dry_run and not args.token:
        print(
            "ERROR: --token or GUIDIAN_TOKEN env var required (unless --dry-run)",
            file=sys.stderr,
        )
        sys.exit(1)

    clock_minutes_per_lesson = max(
        15,
        int(args.ceu_hours * 60 / args.modules / args.lessons_per_module),
    )

    log("=== Guidian CC Course Generator ===")
    log(f"Title:              {args.title}")
    log(f"Slug:               {args.slug}")
    log(
        f"CEU hours: {args.ceu_hours}  |  "
        f"Modules: {args.modules}  |  "
        f"Lessons/module: {args.lessons_per_module}"
    )
    log(f"Clock min/lesson:   {clock_minutes_per_lesson}")
    log(f"API:                {args.api}")
    if args.dry_run:
        log("*** DRY RUN — no API calls will be made ***")

    claude_bin = find_claude()
    log(f"Claude CLI:         {claude_bin}")

    progress = load_progress(args.progress_file)
    job_state: dict = {
        "status": "running",
        "progress": {"modules_done": 0, "modules_total": args.modules},
        "course_id": progress.get("course_id"),
        "error": None,
    }
    update_job_file(args.job_file, job_state)

    # ── Step 1: create course shell ───────────────────────────────────────────
    course_id: str | None = progress.get("course_id")
    if not course_id:
        if args.dry_run:
            log(
                f"\n[DRY RUN] Would POST /courses: "
                f"title={args.title!r} slug={args.slug!r}"
            )
            course_id = "dry-run-course-id"
        else:
            log("\nCreating course shell...")
            try:
                course = api_request(
                    args.api,
                    args.token,
                    "POST",
                    "/courses",
                    {
                        "title": args.title,
                        "slug": args.slug,
                        "description": args.prompt,
                        "ceu_hours": args.ceu_hours,
                        "accrediting_body": args.accrediting_body or None,
                    },
                )
            except urllib.error.HTTPError as e:
                body = e.read().decode()
                err = f"Course creation failed: {e.code} {body[:300]}"
                print(f"ERROR: {err}", file=sys.stderr)
                job_state.update({"status": "failed", "error": err})
                update_job_file(args.job_file, job_state)
                sys.exit(1)
            course_id = course["id"]
            log(f"Created course: {course_id}")

        progress["course_id"] = course_id
        progress["modules_done"] = []
        save_progress(progress, args.progress_file)
        job_state["course_id"] = course_id
        update_job_file(args.job_file, job_state)
    else:
        log(f"\nResuming course: {course_id}")

    modules_done: set[int] = set(progress.get("modules_done", []))

    # ── Step 2: generate and POST each module ─────────────────────────────────
    for i in range(args.modules):
        if i in modules_done:
            log(f"\nModule {i + 1}/{args.modules}: already done, skipping")
            continue

        log(f"\nGenerating module {i + 1}/{args.modules}...")

        prompt_text = build_module_prompt(
            module_index=i,
            num_modules=args.modules,
            course_title=args.title,
            course_prompt=args.prompt,
            audience=args.audience,
            accrediting_body=args.accrediting_body,
            lessons_per_module=args.lessons_per_module,
            clock_minutes_per_lesson=clock_minutes_per_lesson,
            ceu_hours=args.ceu_hours,
        )

        if args.dry_run:
            preview = prompt_text[:600] + ("..." if len(prompt_text) > 600 else "")
            log(f"[DRY RUN] Prompt preview ({len(prompt_text)} chars):\n{preview}")
            log(f"[DRY RUN] Would POST /courses/{course_id}/modules")
            modules_done.add(i)
            progress["modules_done"] = list(modules_done)
            save_progress(progress, args.progress_file)
            job_state["progress"]["modules_done"] = len(modules_done)
            update_job_file(args.job_file, job_state)
            continue

        # Retry loop
        module_data: dict | None = None
        last_error: str = ""
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                module_data = generate_module_via_claude(claude_bin, prompt_text, attempt)
                break
            except (ValueError, RuntimeError, json.JSONDecodeError) as e:
                last_error = str(e)
                log(f"  Attempt {attempt} failed: {e}")
                if attempt < MAX_RETRIES:
                    time.sleep(5)

        if module_data is None:
            err = f"Module {i + 1} failed after {MAX_RETRIES} attempts: {last_error}"
            log(f"ERROR: {err}")
            job_state.update({"status": "failed", "error": err})
            update_job_file(args.job_file, job_state)
            sys.exit(1)

        # Ensure order_index is correct regardless of what claude returned
        module_data["order_index"] = i

        log(f"  Posting module {i + 1} to API...")
        try:
            api_request(
                args.api,
                args.token,
                "POST",
                f"/courses/{course_id}/modules",
                module_data,
            )
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            err = f"API error posting module {i + 1}: {e.code} {err_body[:200]}"
            log(f"ERROR: {err}")
            job_state.update({"status": "failed", "error": err})
            update_job_file(args.job_file, job_state)
            sys.exit(1)

        log(f"  Module {i + 1} done.")
        modules_done.add(i)
        progress["modules_done"] = list(modules_done)
        save_progress(progress, args.progress_file)
        job_state["progress"]["modules_done"] = len(modules_done)
        update_job_file(args.job_file, job_state)

    log(f"\n=== Done! ===")
    log(f"Course ID: {course_id}")
    # Emit a machine-readable marker for the background runner to parse
    log(f"COURSE_ID:{course_id}")

    job_state.update({"status": "succeeded", "course_id": course_id})
    update_job_file(args.job_file, job_state)


if __name__ == "__main__":
    main()
