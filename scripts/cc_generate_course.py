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
    min_words = min(clock_minutes_per_lesson * 10, 600)
    min_sections = max(4, min(clock_minutes_per_lesson // 8, 7))

    lesson_titles = [f"Lesson {i+1}" for i in range(lessons_per_module)]
    
    return f"""You are writing a module for a professional CE course. CRITICAL: Your response MUST be a single JSON object with these top-level keys: "title", "description", "order_index", "lessons". Output ONLY the JSON object below, filled in with real content. Start your response with {{ and end with }}.

COURSE: {course_title}
TOPIC: {course_prompt}
AUDIENCE: {audience or "professionals"}
MODULE: {module_index + 1} of {num_modules}
LESSONS: {lessons_per_module} lessons, {clock_minutes_per_lesson} minutes each

Write {lessons_per_module} complete lessons. Each lesson needs:
- A specific title (not "Lesson 1")
- 3 learning objectives
- mdx_content: at least {min_words} words of real educational content with {min_sections} ## headings
- 4 quiz questions testing real understanding (scenario-based)
- clock_minutes: {clock_minutes_per_lesson}

The first lesson must include a Mermaid diagram. Others use diagrams: [].

OUTPUT (fill in all fields with real content):
{{
  "title": "Module title here",
  "description": "Module overview here",
  "order_index": {module_index},
  "lessons": [
    {{
      "title": "Specific Lesson Title",
      "objectives": ["Do X", "Understand Y", "Apply Z"],
      "mdx_content": "## Introduction\n\nReal content here...\n\n## Section Two\n\nMore content...",
      "style_tags": ["visual", "read"],
      "diagrams": [{{"id": "d1", "mermaid": "flowchart TD\n  A[Step] --> B[Result]", "url": null}}],
      "quiz": {{
        "questions": [
          {{"id": "q1", "type": "single_choice", "prompt": "Scenario question", "choices": ["A", "B", "C", "D"], "correct": 0, "explanation": "Why A"}},
          {{"id": "q2", "type": "true_false", "prompt": "True/false statement", "choices": ["True", "False"], "correct": true, "explanation": "Why true"}},
          {{"id": "q3", "type": "single_choice", "prompt": "Another scenario", "choices": ["A", "B", "C", "D"], "correct": 2, "explanation": "Why C"}},
          {{"id": "q4", "type": "single_choice", "prompt": "Final question", "choices": ["A", "B", "C", "D"], "correct": 1, "explanation": "Why B"}}
        ]
      }},
      "order_index": 0,
      "clock_minutes": {clock_minutes_per_lesson},
      "requires_completion": false
    }}
  ]
}}

Note: Set order_index to 0, 1, 2, 3 for each lesson. Always set diagrams to empty array [].
Return ONLY the JSON. Nothing before {{ or after }}. Write all {lessons_per_module} lessons with real content."""


def extract_json(text: str) -> dict:
    """Extract a JSON object from claude output. Prefers objects with 'title' and 'lessons' keys (module-level)."""
    text = text.strip()

    def find_all_json_objects(s: str) -> list:
        """Find all valid JSON objects in a string, return them sorted by preference."""
        objects = []
        i = 0
        while i < len(s):
            if s[i] == '{':
                depth = 0
                end = -1
                for j, ch in enumerate(s[i:], i):
                    if ch == '{': depth += 1
                    elif ch == '}':
                        depth -= 1
                        if depth == 0:
                            end = j
                            break
                if end > i:
                    candidate = s[i:end+1]
                    try:
                        obj = json.loads(candidate)
                        objects.append(obj)
                    except:
                        pass
                    i = end + 1
                else:
                    i += 1
            else:
                i += 1
        return objects

    # Try direct parse first
    try:
        obj = json.loads(text)
        if isinstance(obj, dict): return obj
    except json.JSONDecodeError:
        pass

    # Strip code fences
    if "```" in text:
        lines = text.splitlines()
        inner = []
        in_block = False
        for line in lines:
            if line.startswith("```") and not in_block:
                in_block = True; continue
            elif line.startswith("```") and in_block:
                break
            elif in_block:
                inner.append(line)
        stripped = "\n".join(inner).strip()
        try:
            obj = json.loads(stripped)
            if isinstance(obj, dict): return obj
        except json.JSONDecodeError:
            pass

    # Find all JSON objects and prefer the one with 'title' AND 'lessons' (module structure)
    all_objects = find_all_json_objects(text)
    
    # Priority 1: has "title" + "lessons" as a non-empty list, and lacks lesson-level keys
    for obj in all_objects:
        if (isinstance(obj, dict)
                and "title" in obj
                and isinstance(obj.get("lessons"), list)
                and len(obj.get("lessons", [])) > 0
                and "mdx_content" not in obj      # mdx_content means this is a lesson, not a module
                and "objectives" not in obj):     # objectives at top-level = lesson object
            return obj
    
    # Priority 1b: has "title" + "lessons" list (even if empty, still a module shell)
    for obj in all_objects:
        if (isinstance(obj, dict)
                and "title" in obj
                and isinstance(obj.get("lessons"), list)
                and "mdx_content" not in obj):
            return obj
    
    # Priority 2: largest object (most content)
    if all_objects:
        largest = max(all_objects, key=lambda o: len(json.dumps(o)))
        return largest

    raise ValueError("No JSON object found in claude output")

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

        # Ensure each lesson has order_index (required by API)
        # Also normalize style_tags to valid values only
        VALID_STYLE_TAGS = {"visual", "auditory", "read", "kinesthetic"}
        STYLE_TAG_MAP = {
            "practical": "kinesthetic", "hands-on": "kinesthetic", "interactive": "kinesthetic",
            "listening": "auditory", "audio": "auditory", "spoken": "auditory",
            "reading": "read", "text": "read", "written": "read",
            "diagram": "visual", "image": "visual", "chart": "visual"
        }
        for j, lesson in enumerate(module_data.get("lessons", [])):
            if "order_index" not in lesson:
                lesson["order_index"] = j
            # Normalize style_tags
            raw_tags = lesson.get("style_tags", ["visual", "read"])
            normalized = []
            for tag in raw_tags:
                tag_lower = tag.lower().strip()
                if tag_lower in VALID_STYLE_TAGS:
                    normalized.append(tag_lower)
                elif tag_lower in STYLE_TAG_MAP:
                    normalized.append(STYLE_TAG_MAP[tag_lower])
                # Skip invalid tags
            lesson["style_tags"] = normalized if normalized else ["visual", "read"]

        # Pre-validate: module MUST have title and lessons before posting
        if not isinstance(module_data.get("title"), str) or not isinstance(module_data.get("lessons"), list):
            err = f"Module {i+1} missing title or lessons (got keys: {list(module_data.keys())})"
            log(f"ERROR: {err}")
            job_state.update({"status": "failed", "error": err})
            update_job_file(args.job_file, job_state)
            sys.exit(1)

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
