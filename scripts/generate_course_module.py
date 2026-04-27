#!/usr/bin/env python3
"""
Guidian nightly course module generator.

Calls Claude Code CLI to generate the next module(s) for a course, validates
the output against the Guidian schema, and POSTs the result to the live API.

Usage:
  python3 generate_course_module.py \
    --api-url https://guidian-api.onrender.com \
    --token <admin_jwt> \
    --course-id <uuid> \
    --modules-per-run 2

For the nightly cron, GUIDIAN_TOKEN env var is used if --token is not passed.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
from typing import Any

API_URL = os.environ.get("GUIDIAN_API_URL", "https://guidian-api.onrender.com")

# ── Strict JSON schema embedded for Claude ───────────────────────────────────

SCHEMA = """{
  "title": str,
  "description": str,
  "lessons": [
    {
      "title": str,
      "objectives": ["str (3-5 specific measurable objectives)"],
      "mdx_content": "str — 800-1500 words. Use ## headings, ### subheadings, **bold key terms**, bullet lists, tables where useful. Professional tone for licensed inspectors.",
      "style_tags": ["one or more of: visual, auditory, read, kinesthetic"],
      "diagrams": [
        {
          "id": "str (e.g. diag-1)",
          "mermaid": "str — valid Mermaid syntax: flowchart TD, sequenceDiagram, or stateDiagram-v2",
          "url": null
        }
      ],
      "quiz": {
        "questions": [
          {
            "id": "str (e.g. q1)",
            "type": "single_choice | multiple_choice | true_false",
            "prompt": "str — scenario-based, tests application not recall",
            "choices": ["str", "str", "str", "str"],
            "correct": "int (index) for single_choice | [int,...] for multiple_choice | bool for true_false",
            "explanation": "str — explains why the answer is correct"
          }
        ]
      },
      "clock_minutes": "int — realistic study time 20-90 minutes"
    }
  ]
}"""

SYSTEM_PROMPT = f"""You are Guidian's expert lesson content writer for professional certification and continuing education courses. You produce deep, publish-ready content for licensed professionals.

CRITICAL REQUIREMENTS — every lesson MUST have:

- mdx_content WORD COUNT: at least clock_minutes × 40 words.
  A 45-min lesson needs ≥ 1,800 words. A 75-min lesson needs ≥ 3,000 words. A 90-min lesson needs ≥ 3,600 words.
  Write full paragraphs — this is certification content, not a bullet outline.
- mdx_content SECTION COUNT: at least clock_minutes ÷ 4 level-2 (##) headings.
  A 45-min lesson needs ≥ 11 ## sections. A 75-min lesson needs ≥ 18 ## sections. A 90-min lesson needs ≥ 22 ## sections.
  Each ## section must contain 1-3 substantive paragraphs PLUS bullets or callouts as appropriate.
  IMPORTANT: each ## section becomes one slide in the learner UI — more sections = more slides = appropriate pacing.
- Use ## headings, ### subheadings, **bold key terms**, > callout blocks, bullet lists, tables where useful.
- objectives: exactly 3-5 specific measurable objectives (action verbs: identify, calculate, inspect, demonstrate, apply)
- quiz.questions: EXACTLY 3-4 questions per lesson. Scenario-based. NOT trivial recall.
  - single_choice: choices array with 4 options, correct is integer index (0-3)
  - true_false: choices: ["True", "False"], correct is boolean
- style_tags: at least 2 tags from [visual, auditory, read, kinesthetic]
- clock_minutes: integer matching the target time provided in the lesson outline

DIAGRAM REQUIREMENT: Include at least 1 Mermaid diagram in the module (can be in any lesson). Use flowchart TD, sequenceDiagram, or stateDiagram-v2. Must be syntactically valid.

Do NOT hallucinate regulation citations. Reference standards generally (e.g. "per standard industry practice", "per IRC guidelines").

Return ONLY a single valid JSON object matching this schema exactly. No prose, no markdown fences, no comments:

{SCHEMA}"""


def build_user_prompt(
    course_title: str,
    module_index: int,
    module_title: str,
    module_description: str,
    lessons_outline: list[dict],
    prior_modules: list[str],
) -> str:
    lessons_text = "\n".join(
        f"  Lesson {i+1}: {l['title']} ({l.get('clock_minutes', 30)} min target)\n"
        f"    Objectives hint: {'; '.join(l.get('objectives', []))}"
        for i, l in enumerate(lessons_outline)
    )
    prior_text = (
        "\n".join(f"  - {t}" for t in prior_modules)
        if prior_modules
        else "  (this is the first module — no prior content)"
    )

    return f"""Course: {course_title}
Module {module_index + 1}: "{module_title}"
Module description: {module_description}

Lessons to write:
{lessons_text}

Prior modules already in the course (do not repeat their content):
{prior_text}

Write the complete module JSON now. Every lesson MUST have quiz.questions (3-4 questions each) and all required fields."""


# ── Claude Code invocation ────────────────────────────────────────────────────

def run_claude(prompt: str, system: str) -> dict[str, Any]:
    full_prompt = f"SYSTEM:\n{system}\n\nUSER:\n{prompt}"
    result = subprocess.run(
        ["claude", "--print", "--permission-mode", "bypassPermissions"],
        input=full_prompt,
        capture_output=True,
        text=True,
        timeout=300,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Claude exited {result.returncode}: {result.stderr[:500]}")

    output = result.stdout.strip()

    # Strip markdown fences if Claude wrapped the JSON anyway
    if output.startswith("```"):
        lines = output.split("\n")
        output = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    return json.loads(output)


# ── Validation ────────────────────────────────────────────────────────────────

def validate_module(data: dict) -> list[str]:
    issues = []
    lessons = data.get("lessons", [])
    if not lessons:
        issues.append("No lessons in module")
        return issues

    for i, lesson in enumerate(lessons):
        prefix = f"Lesson {i+1} ({lesson.get('title', '?')})"
        words = len(lesson.get("mdx_content", "").split())
        clock = lesson.get("clock_minutes") or 30
        min_words = clock * 40
        sections = lesson.get("mdx_content", "").count("\n## ")
        min_sections = clock // 4
        if words < min_words:
            issues.append(f"{prefix}: mdx_content too short ({words} words, need {min_words}+ for {clock}-min lesson)")
        if sections < min_sections:
            issues.append(f"{prefix}: only {sections} ## sections, need {min_sections}+ for {clock}-min lesson")
        objs = lesson.get("objectives", [])
        if len(objs) < 3:
            issues.append(f"{prefix}: only {len(objs)} objectives (need 3-5)")
        quiz = lesson.get("quiz") or {}
        questions = quiz.get("questions", []) if isinstance(quiz, dict) else []
        if len(questions) < 3:
            issues.append(f"{prefix}: only {len(questions)} quiz questions (need 3-4)")
        if not lesson.get("style_tags"):
            issues.append(f"{prefix}: missing style_tags")
        if not lesson.get("clock_minutes"):
            issues.append(f"{prefix}: missing clock_minutes")

    return issues


# ── Guidian API calls ─────────────────────────────────────────────────────────

def api_request(method: str, path: str, token: str, body: dict | None = None) -> dict:
    url = f"{API_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"API {method} {path} → {e.code}: {e.read().decode()[:300]}") from e


def get_course(course_id: str, token: str) -> dict:
    return api_request("GET", f"/api/v1/courses/{course_id}", token)


def post_module(course_id: str, module_data: dict, order_index: int, token: str) -> dict:
    payload = {
        "title": module_data["title"],
        "description": module_data.get("description"),
        "order_index": order_index,
        "lessons": [
            {
                "title": lesson["title"],
                "order_index": idx,
                "objectives": lesson.get("objectives", []),
                "mdx_content": lesson.get("mdx_content", ""),
                "style_tags": lesson.get("style_tags", []),
                "diagrams": lesson.get("diagrams", []),
                "quiz": lesson.get("quiz") or {"questions": []},
                "clock_minutes": lesson.get("clock_minutes", 30),
                "requires_completion": True,
            }
            for idx, lesson in enumerate(module_data.get("lessons", []))
        ],
    }
    return api_request("POST", f"/api/v1/courses/{course_id}/modules", token, payload)


# ── Home inspector course definition ─────────────────────────────────────────

HOME_INSPECTOR_COURSE = {
    "title": "Certified Home Inspector — 100-Hour Professional Course",
    "modules": [
        {
            "title": "Foundations of Home Inspection — Scope, Standards, and Professional Practice",
            "description": "Defines the legal and professional scope of a home inspection, covers Standards of Practice, ethics, and the inspection workflow.",
            "lessons": [
                {"title": "Defining the Home Inspection: Scope, Purpose, and Limitations", "clock_minutes": 75, "objectives": ["Define home inspection legally and professionally", "Identify systems within standard scope", "Explain inherent limitations to clients", "Distinguish material defects from cosmetic issues"]},
                {"title": "Standards of Practice and the Regulatory Landscape", "clock_minutes": 90, "objectives": ["Identify major Standards of Practice (ASHI, InterNACHI)", "Explain state licensing requirements", "Apply SoP language to field decisions"]},
                {"title": "Professional Ethics, Conflicts of Interest, and Liability", "clock_minutes": 75, "objectives": ["Identify ethical obligations under professional codes", "Recognize and manage conflicts of interest", "Apply risk management principles to practice"]},
                {"title": "The Inspection Workflow: From Engagement to Report Delivery", "clock_minutes": 90, "objectives": ["Describe the pre-inspection agreement process", "Sequence the on-site inspection workflow", "Apply best practices for report delivery and client communication"]},
            ],
        },
        {
            "title": "Structural Systems — Foundations, Framing, and Load Paths",
            "description": "Covers foundation types, structural framing systems, load distribution, and common deficiencies inspectors must identify.",
            "lessons": [
                {"title": "Foundation Types: Slab, Crawlspace, and Basement", "clock_minutes": 90, "objectives": ["Identify foundation types by visual characteristics", "Describe drainage and moisture management requirements per type", "Recognize signs of foundation movement or failure"]},
                {"title": "Inspecting Concrete and Masonry Foundations", "clock_minutes": 75, "objectives": ["Distinguish cosmetic from structural cracking", "Identify efflorescence, spalling, and deterioration", "Recommend appropriate specialist referrals"]},
                {"title": "Wood Framing Systems: Platform, Balloon, and Post-and-Beam", "clock_minutes": 90, "objectives": ["Identify framing system types from accessible evidence", "Recognize notching, boring, and modification deficiencies", "Assess roof framing for structural adequacy"]},
                {"title": "Load Paths, Bearing Walls, and Structural Modifications", "clock_minutes": 75, "objectives": ["Trace load paths from roof to foundation", "Identify unauthorized structural modifications", "Determine when engineering referral is warranted"]},
            ],
        },
        {
            "title": "Roofing Systems — Materials, Drainage, and Flashings",
            "description": "Comprehensive coverage of roof coverings, drainage design, flashing details, and roof-related deficiencies.",
            "lessons": [
                {"title": "Roof Covering Materials: Asphalt, Tile, Metal, and Flat Roofs", "clock_minutes": 90, "objectives": ["Identify roof covering types and their expected service life", "Assess condition and remaining useful life", "Recognize installation deficiencies by material type"]},
                {"title": "Roof Drainage: Gutters, Downspouts, and Grading", "clock_minutes": 60, "objectives": ["Evaluate gutter and downspout adequacy", "Assess site grading for water management", "Identify conditions contributing to foundation water intrusion"]},
                {"title": "Flashing Fundamentals: Valleys, Penetrations, and Wall Intersections", "clock_minutes": 90, "objectives": ["Identify flashing types and their applications", "Recognize improper flashing installation", "Prioritize flashing deficiencies by severity"]},
                {"title": "Chimneys, Skylights, and Roof Penetrations", "clock_minutes": 75, "objectives": ["Inspect chimney components from the exterior", "Evaluate skylight installation and condition", "Identify common penetration flashing failures"]},
            ],
        },
        {
            "title": "Electrical Systems — Service, Panels, and Branch Circuits",
            "description": "Covers residential electrical systems from service entrance through branch circuits, devices, and safety components.",
            "lessons": [
                {"title": "Electrical Service: Entrance, Meter Base, and Service Drop", "clock_minutes": 75, "objectives": ["Identify service entrance conductor types", "Assess clearance requirements for service drop", "Recognize service entrance deficiencies"]},
                {"title": "Panel Inspection: Main and Sub-Panels", "clock_minutes": 90, "objectives": ["Inspect panel labeling, breaker sizing, and wiring methods", "Identify double-tapping, improper breakers, and fire hazards", "Recognize panels with known safety histories (FPE, Zinsco)"]},
                {"title": "Branch Circuits, Devices, and Wiring Methods", "clock_minutes": 75, "objectives": ["Identify wiring methods: NM, conduit, knob-and-tube, aluminum", "Test devices for proper operation and grounding", "Recognize common branch circuit deficiencies"]},
                {"title": "GFCI, AFCI, and Smoke/CO Protection", "clock_minutes": 60, "objectives": ["Identify required GFCI locations per current standards", "Test GFCI and AFCI protection", "Assess smoke and CO detector placement and function"]},
            ],
        },
        {
            "title": "Plumbing Systems — Supply, Drain, and Water Heating",
            "description": "Inspection of water supply distribution, drain/waste/vent systems, fixtures, and water heating equipment.",
            "lessons": [
                {"title": "Water Supply Systems: Piping Materials and Pressure", "clock_minutes": 75, "objectives": ["Identify pipe materials: copper, CPVC, PEX, galvanized, lead", "Assess water pressure and flow adequacy", "Recognize supply system deficiencies and age-related concerns"]},
                {"title": "Drain, Waste, and Vent Systems", "clock_minutes": 90, "objectives": ["Identify DWV pipe materials and configurations", "Test drain function and assess for leaks and slow drains", "Recognize venting deficiencies and sewer gas risks"]},
                {"title": "Water Heaters: Tank and Tankless Systems", "clock_minutes": 75, "objectives": ["Inspect water heater installation: clearances, connections, venting", "Assess T&P valve and discharge pipe configuration", "Estimate remaining service life and identify replacement triggers"]},
                {"title": "Fixtures, Hose Bibs, and Fuel Gas Systems", "clock_minutes": 60, "objectives": ["Inspect fixtures for leaks, operation, and securing", "Assess hose bibs for backflow prevention", "Identify gas supply components and recognize leak indicators"]},
            ],
        },
        {
            "title": "HVAC Systems — Heating, Cooling, and Ventilation",
            "description": "Evaluation of heating and cooling equipment, distribution systems, controls, and ventilation requirements.",
            "lessons": [
                {"title": "Forced Air Heating: Furnaces and Heat Pumps", "clock_minutes": 90, "objectives": ["Inspect furnace components: heat exchanger, burner, controls", "Evaluate heat pump operation in heating and cooling modes", "Identify safety and efficiency concerns in heating equipment"]},
                {"title": "Hydronic Heating: Boilers, Radiators, and Radiant Systems", "clock_minutes": 75, "objectives": ["Identify hydronic system types and components", "Inspect boiler safety controls and expansion tank", "Assess distribution and terminal equipment"]},
                {"title": "Cooling Systems: Central Air and Ductless Mini-Splits", "clock_minutes": 75, "objectives": ["Inspect condensing unit and air handler components", "Assess refrigerant line insulation and condensate drainage", "Identify common cooling system deficiencies"]},
                {"title": "Duct Systems, Ventilation, and Air Quality", "clock_minutes": 75, "objectives": ["Assess duct installation, insulation, and sealing", "Evaluate mechanical ventilation for bathrooms, kitchens, and crawlspaces", "Identify indoor air quality concerns within scope"]},
            ],
        },
        {
            "title": "Interior Inspection — Walls, Ceilings, Floors, and Stairs",
            "description": "Interior systems inspection covering finished surfaces, stairs, windows, doors, and built-in components.",
            "lessons": [
                {"title": "Walls, Ceilings, and Floors: Deficiency Recognition", "clock_minutes": 75, "objectives": ["Distinguish cosmetic from structural deficiencies in interior surfaces", "Identify moisture indicators: staining, efflorescence, mold growth", "Assess floor deflection, squeaking, and surface condition"]},
                {"title": "Stairs, Railings, and Balconies", "clock_minutes": 60, "objectives": ["Inspect stair geometry: rise, run, headroom", "Assess guardrail and handrail height, spacing, and graspability", "Identify balcony structural and waterproofing concerns"]},
                {"title": "Windows and Doors: Operation, Sealing, and Safety Glazing", "clock_minutes": 75, "objectives": ["Test windows and doors for operation and latching", "Identify failed insulated glass units", "Recognize locations requiring safety glazing and assess compliance"]},
                {"title": "Garage Inspection: Structure, Door Systems, and Fire Separation", "clock_minutes": 75, "objectives": ["Inspect garage structure and slab condition", "Test automatic door opener safety features", "Assess fire separation between garage and living space"]},
            ],
        },
        {
            "title": "Attic and Insulation — Thermal Performance and Moisture Control",
            "description": "Attic access, inspection protocols, insulation types and R-values, ventilation requirements, and moisture management.",
            "lessons": [
                {"title": "Attic Access and Inspection Protocol", "clock_minutes": 60, "objectives": ["Determine appropriate entry conditions for attic inspection", "Identify attic insulation type and estimate R-value", "Assess structural framing in attic space"]},
                {"title": "Attic Ventilation: Passive and Active Systems", "clock_minutes": 75, "objectives": ["Calculate net free area requirements for balanced ventilation", "Identify ventilation deficiencies and their consequences", "Recognize powered attic ventilators and their limitations"]},
                {"title": "Insulation Types, R-Values, and Thermal Bridging", "clock_minutes": 75, "objectives": ["Identify batt, blown, rigid, and spray foam insulation", "Estimate R-values from observed depth and material", "Recognize thermal bridging conditions and their energy impact"]},
                {"title": "Moisture Intrusion in Attics: Ice Dams, Condensation, and Mold", "clock_minutes": 75, "objectives": ["Explain ice dam formation and prevention", "Identify condensation pathways and vapor barrier deficiencies", "Recognize mold conditions and appropriate reporting language"]},
            ],
        },
        {
            "title": "Crawlspace and Basement Inspection",
            "description": "Entry protocols, moisture management, structural assessment, and mechanical systems in below-grade and crawlspace environments.",
            "lessons": [
                {"title": "Crawlspace Entry, Safety, and Inspection Protocol", "clock_minutes": 60, "objectives": ["Determine safe entry conditions for crawlspace", "Identify vapor barrier installation and condition", "Assess crawlspace ventilation adequacy"]},
                {"title": "Moisture Management Below Grade: Drainage and Waterproofing", "clock_minutes": 90, "objectives": ["Identify active and passive waterproofing systems", "Assess sump pump installation and operation", "Recognize hydrostatic pressure indicators and water intrusion patterns"]},
                {"title": "Wood Deterioration: Rot, Fungal Growth, and Wood-Destroying Insects", "clock_minutes": 75, "objectives": ["Distinguish fungal decay from mechanical damage", "Identify conditions conducive to wood-destroying organism activity", "Apply appropriate reporting language and referral thresholds"]},
                {"title": "Mechanical Systems in Crawlspace and Basement Environments", "clock_minutes": 60, "objectives": ["Inspect mechanicals in below-grade environments for clearance and moisture exposure", "Assess duct and pipe insulation in unconditioned spaces", "Identify code-referenced installation concerns for mechanicals below grade"]},
            ],
        },
        {
            "title": "Exterior Inspection — Cladding, Grading, and Drainage",
            "description": "Comprehensive exterior inspection covering cladding systems, flashings, grading, drainage, and exterior components.",
            "lessons": [
                {"title": "Exterior Cladding: Wood, Vinyl, Fiber Cement, Stucco, and Brick", "clock_minutes": 90, "objectives": ["Identify cladding material types and their inspection protocols", "Recognize material-specific failure modes", "Assess installation quality and condition for each cladding type"]},
                {"title": "Exterior Flashings and Moisture Management at Wall Penetrations", "clock_minutes": 75, "objectives": ["Identify window and door flashing configurations", "Recognize improper or missing flashing at penetrations", "Prioritize exterior moisture deficiencies by risk level"]},
                {"title": "Grading, Drainage, Walkways, and Driveways", "clock_minutes": 60, "objectives": ["Assess site grading for positive drainage away from structure", "Inspect walkways, driveways, and steps for trip hazards and drainage", "Identify drainage conditions contributing to foundation moisture"]},
                {"title": "Decks, Porches, and Attached Structures", "clock_minutes": 75, "objectives": ["Inspect deck ledger connections and fastening", "Assess post bases, beams, and joists for deterioration", "Identify guardrail and stair deficiencies on exterior structures"]},
            ],
        },
        {
            "title": "Report Writing and Documentation",
            "description": "Report structure, language, photographs, and communication standards for professional home inspection reports.",
            "lessons": [
                {"title": "Report Structure: Narrative vs. Checkbox Formats", "clock_minutes": 60, "objectives": ["Compare report format types and their liability implications", "Apply consistent deficiency severity language", "Structure a report for clarity and defensibility"]},
                {"title": "Effective Deficiency Descriptions and Recommendations", "clock_minutes": 75, "objectives": ["Write deficiency descriptions that are specific, accurate, and actionable", "Match recommendation language to deficiency severity", "Avoid ambiguous language that increases liability exposure"]},
                {"title": "Photography Standards and Annotation", "clock_minutes": 60, "objectives": ["Apply photography standards for home inspection reports", "Select representative images for each deficiency", "Annotate photographs for maximum client comprehension"]},
                {"title": "Communicating Report Findings to Clients and Agents", "clock_minutes": 75, "objectives": ["Explain the post-inspection consultation process", "Triage findings for client priority action", "Manage expectations about report limitations in client communication"]},
            ],
        },
        {
            "title": "Specialty Systems and Ancillary Services",
            "description": "Swimming pools, sprinkler systems, solar, EV charging, and ancillary service offerings within and beyond standard scope.",
            "lessons": [
                {"title": "Swimming Pools and Spas: Scope and Inspection Protocol", "clock_minutes": 75, "objectives": ["Identify pool and spa components within inspection scope", "Inspect safety barriers, drain covers, and GFCI protection", "Recognize mechanical and structural deficiencies in pool systems"]},
                {"title": "Solar Photovoltaic and Battery Storage Systems", "clock_minutes": 75, "objectives": ["Identify PV system components and their inspection scope", "Assess roof penetrations and mounting for solar installations", "Recognize safety concerns in battery storage installations"]},
                {"title": "EV Charging, Smart Home, and Emerging Technology", "clock_minutes": 60, "objectives": ["Identify Level 1 and Level 2 EV charging installations", "Assess electrical capacity for EV charging adequacy", "Apply inspection scope boundaries to smart home and emerging systems"]},
                {"title": "Ancillary Services: Radon, Mold, Sewer Scope, and WDO", "clock_minutes": 75, "objectives": ["Define the scope boundaries between general inspection and ancillary services", "Communicate when ancillary services are recommended", "Understand liability and certification requirements for ancillary offerings"]},
            ],
        },
        {
            "title": "Business, Legal, and Risk Management",
            "description": "Business operations, contracts, insurance, complaint handling, and continuing education for professional home inspectors.",
            "lessons": [
                {"title": "Business Formation, Licensing, and Insurance Requirements", "clock_minutes": 75, "objectives": ["Identify business structure options and their liability implications", "Describe E&O and general liability insurance requirements", "Navigate state licensing maintenance and renewal obligations"]},
                {"title": "Pre-Inspection Agreements and Limitation of Liability", "clock_minutes": 90, "objectives": ["Analyze pre-inspection agreement components and their enforceability", "Apply appropriate limitation of liability clauses", "Identify clauses that may be unenforceable in specific jurisdictions"]},
                {"title": "Complaint Handling, Mediation, and Claims Response", "clock_minutes": 75, "objectives": ["Apply a structured complaint response process", "Recognize when to involve E&O carrier before responding", "Document complaint communications to protect against escalation"]},
                {"title": "Continuing Education, Professional Development, and Specializations", "clock_minutes": 60, "objectives": ["Identify CE requirements for license maintenance in major states", "Evaluate specialty certification pathways (commercial, infrared, pool)", "Apply a professional development plan to long-term career goals"]},
            ],
        },
    ],
}


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Guidian course modules via Claude Code")
    parser.add_argument("--api-url", default=API_URL)
    parser.add_argument("--token", default=os.environ.get("GUIDIAN_TOKEN"))
    parser.add_argument("--course-id", default=os.environ.get("GUIDIAN_COURSE_ID"), help="Existing course UUID to add modules to")
    parser.add_argument("--start-module", type=int, default=0, help="Module index to start from (0-based)")
    parser.add_argument("--modules-per-run", type=int, default=2)
    parser.add_argument("--dry-run", action="store_true", help="Generate and validate but do not POST to API")
    args = parser.parse_args()

    if args.api_url != API_URL:
        os.environ["GUIDIAN_API_URL"] = args.api_url

    if not args.token and not args.dry_run:
        print("ERROR: --token or GUIDIAN_TOKEN env var required", file=sys.stderr)
        sys.exit(1)

    course_def = HOME_INSPECTOR_COURSE
    total_modules = len(course_def["modules"])
    end_module = min(args.start_module + args.modules_per_run, total_modules)

    print(f"Generating modules {args.start_module + 1}–{end_module} of {total_modules}")
    print(f"Course: {course_def['title']}")
    print(f"Dry run: {args.dry_run}")
    print()

    generated_results = []

    for module_idx in range(args.start_module, end_module):
        module_def = course_def["modules"][module_idx]
        prior_titles = [course_def["modules"][i]["title"] for i in range(module_idx)]

        print(f"[{module_idx + 1}/{total_modules}] Generating: {module_def['title']}")

        user_prompt = build_user_prompt(
            course_title=course_def["title"],
            module_index=module_idx,
            module_title=module_def["title"],
            module_description=module_def["description"],
            lessons_outline=module_def["lessons"],
            prior_modules=prior_titles,
        )

        for attempt in range(2):
            try:
                data = run_claude(user_prompt, SYSTEM_PROMPT)
            except (json.JSONDecodeError, RuntimeError) as e:
                print(f"  Claude error (attempt {attempt + 1}): {e}")
                if attempt == 1:
                    print("  Skipping module after 2 failed attempts")
                    break
                time.sleep(5)
                continue

            issues = validate_module(data)
            if issues:
                print(f"  Validation issues (attempt {attempt + 1}):")
                for issue in issues:
                    print(f"    - {issue}")
                if attempt == 0:
                    print("  Retrying with stricter prompt...")
                    # Inject feedback into next attempt by appending to user prompt
                    user_prompt += "\n\nPREVIOUS ATTEMPT FAILED THESE CHECKS — fix all of them:\n" + "\n".join(f"- {i}" for i in issues)
                    time.sleep(3)
                    continue
                else:
                    print("  Publishing with remaining issues (non-blocking)")

            lessons_count = len(data.get("lessons", []))
            words = sum(len(l.get("mdx_content", "").split()) for l in data.get("lessons", []))
            print(f"  OK: {lessons_count} lessons, ~{words} words total")

            if not args.dry_run and args.course_id:
                try:
                    result = post_module(args.course_id, data, module_idx, args.token)
                    print(f"  Posted → module ID: {result.get('id', '?')}")
                except RuntimeError as e:
                    print(f"  API error: {e}")

            generated_results.append(data)
            break

        # Save output regardless of dry-run
        out_path = f"/tmp/guidian_module_{module_idx + 1}.json"
        with open(out_path, "w") as f:
            json.dump(data if generated_results and generated_results[-1] is data else {}, f, indent=2)
        print(f"  Saved → {out_path}")
        print()

    print(f"Done. Generated {len(generated_results)} module(s).")


if __name__ == "__main__":
    main()
