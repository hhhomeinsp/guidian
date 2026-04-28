#!/usr/bin/env python3
"""
Generate all 13 modules for the Certified Home Inspector — 100-Hour Professional Course
using the Anthropic Python SDK and POST them to the Guidian API.

Usage:
    ANTHROPIC_API_KEY=<key> python3 scripts/generate_home_inspector_course.py

Optional env vars:
    GUIDIAN_TOKEN    — API JWT (defaults to ADMIN_JWT constant below)
    START_MODULE     — 0-based index to resume from (default 0)
    DRY_RUN=1        — generate and validate but don't POST
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
import urllib.error
from typing import Any

import anthropic

# ── Config ────────────────────────────────────────────────────────────────────

API_BASE = "https://guidian-api.onrender.com"
COURSE_ID = "2c903510-fceb-4937-8517-3380c59c185a"
ADMIN_JWT = (
    "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9"
    ".eyJzdWIiOiAiNTY5YWJhODAtZWYxZC00YmU2LTlhYzYtMmZmM2FmOTA0ODIxIiwgImV4cCI6IDE4MDg3Nzg0NjUsICJ0eXBlIjogImFjY2VzcyJ9"
    ".wDKFNKQgv6BWPM6gCR9CE0jpgLWAA_h0il-hBXuHbr0"
)

MODEL = "claude-opus-4-7"
MAX_TOKENS = 32000

# ── Schema & Prompts ──────────────────────────────────────────────────────────

SCHEMA = """{
  "title": "string",
  "description": "string",
  "lessons": [
    {
      "title": "string",
      "objectives": ["3-5 specific measurable objectives with action verbs"],
      "mdx_content": "string — MINIMUM clock_minutes × 40 words. Full professional lesson content. Use ## headings (minimum clock_minutes ÷ 4 count), ### subheadings, **bold key terms**, > callout blocks, bullet lists, tables, numbered steps, scenario examples.",
      "style_tags": ["visual", "read"],
      "diagrams": [
        {
          "id": "diag-1",
          "mermaid": "flowchart TD\\n    A[Start] --> B[Step]",
          "url": null
        }
      ],
      "quiz": {
        "questions": [
          {
            "id": "q1",
            "type": "single_choice",
            "prompt": "Scenario-based question testing application not recall",
            "choices": ["A", "B", "C", "D"],
            "correct": 0,
            "explanation": "Why this answer is correct"
          }
        ]
      },
      "clock_minutes": 75
    }
  ]
}"""

SYSTEM_PROMPT = f"""You are Guidian's expert lesson content writer for professional certification and continuing education courses. You produce deep, publish-ready content for licensed professional home inspectors preparing for the NHIE exam or state licensure.

ABSOLUTE REQUIREMENTS — every lesson MUST satisfy all of these:

WORD COUNT:
  - Each lesson's mdx_content must contain AT LEAST clock_minutes × 40 words.
  - A 60-min lesson needs ≥ 2,400 words. A 75-min lesson needs ≥ 3,000 words. A 90-min lesson needs ≥ 3,600 words.
  - Write full paragraphs — this is exam-prep certification content, not a bullet outline.
  - Count every word in every paragraph, list item, heading, table cell, and callout.

SECTION COUNT (## headings):
  - Each lesson must contain AT LEAST clock_minutes ÷ 4 level-2 (##) headings.
  - A 60-min lesson needs ≥ 15 ## sections. A 75-min lesson needs ≥ 18 ## sections. A 90-min lesson needs ≥ 22 ## sections.
  - Each ## section must contain 2-4 substantive paragraphs PLUS lists or callouts as appropriate.
  - CRITICAL: each ## section becomes one slide in the learner UI — more sections = better pacing.

CONTENT STRUCTURE per ## section:
  - Open with a topic sentence explaining WHY this matters in the field
  - Include 2-4 paragraphs of technical depth
  - Add a > callout block, numbered step list, or table where it aids comprehension
  - Close with a field application note or scenario

OBJECTIVES: Exactly 3-5 per lesson. Use action verbs: identify, inspect, calculate, demonstrate, apply, evaluate, differentiate.

QUIZ: EXACTLY 4 questions per lesson. All must be scenario-based — testing field application, not definition recall.
  - single_choice: 4 choices, correct is integer index 0-3
  - true_false: choices: ["True", "False"], correct is boolean
  - Mix question types within each lesson

DIAGRAMS: Include at least 2 Mermaid diagrams per module (aim for 1 per lesson). Use the most appropriate type:
  - flowchart TD: inspection decision trees, defect assessment flows (Observed Condition → Assess → Report)
  - flowchart LR: system layouts (service entrance → panel → branch circuits → outlets)
  - stateDiagram-v2: component condition states (Serviceable → Deteriorated → Failed)
  - sequenceDiagram: inspection sequences (Inspector → Observes → Documents → Reports)
  Make diagrams technically accurate: show real component relationships specific to home inspection.
  Structural diagrams: load path from roof to foundation. Electrical: service to outlet. Plumbing: supply/DWV separation.
  MERMAID RULES: valid syntax only, max 20 nodes, meaningful node labels, every arrow target must exist as a node.

TECHNICAL ACCURACY: Content must be accurate for home inspection practice. Reference standards generally ("per industry standards", "per IRC guidelines") — do not fabricate specific code section numbers.

TONE: Professional, authoritative, and practical. Write for someone who will be inspecting real homes within months of completing this course.

Return ONLY a single valid JSON object matching this schema. No prose, no markdown fences, no comments outside the JSON:

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
        f"  Lesson {i+1}: \"{l['title']}\" — {l.get('clock_minutes', 75)} min target\n"
        f"    Objectives hint: {'; '.join(l.get('objectives', []))}"
        for i, l in enumerate(lessons_outline)
    )
    prior_text = (
        "\n".join(f"  - {t}" for t in prior_modules)
        if prior_modules
        else "  (this is Module 1 — no prior modules)"
    )

    total_words = sum(l.get("clock_minutes", 75) * 40 for l in lessons_outline)
    total_sections = sum(l.get("clock_minutes", 75) // 4 for l in lessons_outline)

    return f"""Course: {course_title}
Module {module_index + 1} of 13: "{module_title}"
Module description: {module_description}

Lessons to write ({len(lessons_outline)} lessons):
{lessons_text}

WORD COUNT REQUIREMENT FOR THIS MODULE: {total_words:,}+ words across all lessons combined.
SECTION COUNT REQUIREMENT FOR THIS MODULE: {total_sections}+ level-2 ## headings across all lessons combined.

Prior modules already in this course (do not repeat their content):
{prior_text}

Write the complete module JSON now. Every lesson MUST meet the word count and section count requirements. Every lesson MUST have exactly 4 scenario-based quiz questions. Return only valid JSON."""


# ── Anthropic generation ──────────────────────────────────────────────────────

def generate_module(client: anthropic.Anthropic, user_prompt: str) -> dict[str, Any]:
    chunks = []
    with client.messages.stream(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    ) as stream:
        for text in stream.text_stream:
            chunks.append(text)
            if len(chunks) % 500 == 0:
                print(".", end="", flush=True)

    output = "".join(chunks).strip()
    print()  # newline after dots

    # Strip markdown fences if model wrapped JSON anyway
    if output.startswith("```"):
        lines = output.split("\n")
        start = 1
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        output = "\n".join(lines[start:end])

    return json.loads(output)


# ── Validation ────────────────────────────────────────────────────────────────

def validate_module(data: dict) -> list[str]:
    issues = []
    lessons = data.get("lessons", [])
    if not lessons:
        issues.append("No lessons in module")
        return issues

    has_diagram = any(lesson.get("diagrams") for lesson in lessons)
    if not has_diagram:
        issues.append("Module has no Mermaid diagrams")

    for i, lesson in enumerate(lessons):
        prefix = f"Lesson {i+1} ({lesson.get('title', '?')!r})"
        content = lesson.get("mdx_content", "")
        words = len(content.split())
        clock = lesson.get("clock_minutes") or 75
        min_words = clock * 25
        sections = content.count("\n## ")
        min_sections = clock // 6

        if words < min_words:
            issues.append(f"{prefix}: {words} words — need {min_words}+ ({clock}-min lesson)")
        if sections < min_sections:
            issues.append(f"{prefix}: {sections} ## sections — need {min_sections}+ ({clock}-min lesson)")

        objs = lesson.get("objectives", [])
        if len(objs) < 3:
            issues.append(f"{prefix}: only {len(objs)} objectives (need 3-5)")

        quiz = lesson.get("quiz") or {}
        questions = quiz.get("questions", []) if isinstance(quiz, dict) else []
        if len(questions) < 4:
            issues.append(f"{prefix}: only {len(questions)} quiz questions (need 4)")

        if not lesson.get("style_tags"):
            issues.append(f"{prefix}: missing style_tags")
        if not lesson.get("clock_minutes"):
            issues.append(f"{prefix}: missing clock_minutes")

    return issues


# ── Guidian API ───────────────────────────────────────────────────────────────

def api_request(method: str, path: str, token: str, body: dict | None = None) -> dict:
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"API {method} {path} → {e.code}: {e.read().decode()[:500]}") from e


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
                "clock_minutes": lesson.get("clock_minutes", 75),
                "requires_completion": True,
            }
            for idx, lesson in enumerate(module_data.get("lessons", []))
        ],
    }
    return api_request("POST", f"/api/v1/courses/{course_id}/modules", token, payload)


# ── Course definition ─────────────────────────────────────────────────────────

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
    token = os.environ.get("GUIDIAN_TOKEN", ADMIN_JWT)
    start_module = int(os.environ.get("START_MODULE", "0"))
    dry_run = os.environ.get("DRY_RUN", "").lower() in ("1", "true", "yes")

    course = HOME_INSPECTOR_COURSE
    modules = course["modules"]
    total = len(modules)

    print(f"Course: {course['title']}")
    print(f"Modules: {total} total, starting from module {start_module + 1}")
    print(f"Model: {MODEL}  |  Max tokens: {MAX_TOKENS}")
    print(f"Dry run: {dry_run}")
    print()

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    succeeded = 0
    failed = 0

    for idx in range(start_module, total):
        mod_def = modules[idx]
        prior_titles = [modules[i]["title"] for i in range(idx)]

        print(f"[{idx+1}/{total}] Generating: {mod_def['title']}")
        print(f"  Lessons: {len(mod_def['lessons'])} — ", end="", flush=True)
        print(", ".join(f"{l['title'][:30]}… ({l['clock_minutes']}min)" for l in mod_def["lessons"]))

        user_prompt = build_user_prompt(
            course_title=course["title"],
            module_index=idx,
            module_title=mod_def["title"],
            module_description=mod_def["description"],
            lessons_outline=mod_def["lessons"],
            prior_modules=prior_titles,
        )

        data = None
        for attempt in range(1, 4):
            try:
                print(f"  Calling Claude (attempt {attempt})...", flush=True)
                t0 = time.time()
                data = generate_module(client, user_prompt)
                elapsed = time.time() - t0
                print(f"  Generated in {elapsed:.1f}s", flush=True)
            except json.JSONDecodeError as e:
                print(f"  JSON parse error (attempt {attempt}): {e}")
                if attempt < 3:
                    time.sleep(5)
                    continue
                print("  Skipping module after 3 failed parse attempts")
                break
            except Exception as e:
                print(f"  API error (attempt {attempt}): {e}")
                if attempt < 3:
                    time.sleep(10)
                    continue
                print("  Skipping module after 3 API errors")
                break

            issues = validate_module(data)
            if issues:
                print(f"  Validation issues ({len(issues)}):")
                for issue in issues[:8]:
                    print(f"    - {issue}")
                if attempt < 3:
                    print("  Retrying with feedback appended...")
                    user_prompt += (
                        "\n\nPREVIOUS ATTEMPT FAILED THESE QUALITY CHECKS — fix ALL of them in this response:\n"
                        + "\n".join(f"- {i}" for i in issues)
                    )
                    time.sleep(3)
                    continue
                else:
                    print("  Publishing with remaining issues (non-blocking)")

            # Report stats
            lessons = data.get("lessons", [])
            total_words = sum(len(l.get("mdx_content", "").split()) for l in lessons)
            total_sections = sum(l.get("mdx_content", "").count("\n## ") for l in lessons)
            print(f"  Stats: {len(lessons)} lessons | {total_words:,} words | {total_sections} ## sections")

            # Save to /tmp
            out_path = f"/tmp/guidian_module_{idx+1}.json"
            with open(out_path, "w") as f:
                json.dump(data, f, indent=2)
            print(f"  Saved → {out_path}")

            if not dry_run:
                try:
                    result = post_module(COURSE_ID, data, idx, token)
                    module_id = result.get("id", "?")
                    print(f"  Posted → module ID: {module_id}")
                    succeeded += 1
                except RuntimeError as e:
                    print(f"  API POST error: {e}")
                    failed += 1
            else:
                print("  (dry-run — not posting)")
                succeeded += 1

            print()
            break
        else:
            failed += 1
            print()

    print("=" * 60)
    print(f"DONE: {succeeded}/{total} modules succeeded, {failed} failed")

    # Verify via live API
    if not dry_run and succeeded > 0:
        print("\nVerifying via GET /api/v1/courses/...")
        try:
            course_data = api_request("GET", f"/api/v1/courses/{COURSE_ID}", token)
            live_modules = course_data.get("modules", [])
            print(f"Live course now has {len(live_modules)} module(s)")
        except Exception as e:
            print(f"Verification error: {e}")


if __name__ == "__main__":
    main()
