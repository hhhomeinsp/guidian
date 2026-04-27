#!/usr/bin/env python3
"""
Download curated home inspection reference diagrams from Wikimedia Commons
and upload them to R2. Updates diagram_references.py with R2 public URLs.

Run once (or re-run to refresh):
    python3 scripts/seed_diagram_references.py

Requires env vars: S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY
"""
from __future__ import annotations

import io
import os
import sys
import time
import urllib.request
import urllib.error
import json
from pathlib import Path

import boto3

# ── Config ────────────────────────────────────────────────────────────────────
S3_ENDPOINT = os.environ.get("S3_ENDPOINT_URL", "")
S3_ACCESS   = os.environ.get("S3_ACCESS_KEY", "")
S3_SECRET   = os.environ.get("S3_SECRET_KEY", "")
BUCKET      = "guidian-courses"
PREFIX      = "reference-diagrams/"
R2_PUBLIC   = os.environ.get("R2_PUBLIC_URL", "")  # optional CDN base URL

# Wikimedia Commons API - fetches direct image URL by filename
WIKIMEDIA_API = "https://commons.wikimedia.org/w/api.php?action=query&titles=File:{filename}&prop=imageinfo&iiprop=url&format=json"

# ── Diagram catalogue ─────────────────────────────────────────────────────────
# (keywords_tuple, wikimedia_filename, r2_key_suffix)
DIAGRAMS: list[tuple[tuple[str, ...], str, str]] = [
    # Electrical
    (("electrical panel", "breaker", "load center", "service panel"),
     "Electrical_panel.jpg", "electrical/panel.jpg"),
    (("gfci", "ground fault", "outlet wiring"),
     "GFCI_receptacle.jpg", "electrical/gfci.jpg"),
    (("electrical wiring", "romex", "wire gauge", "amperage"),
     "Electrical_wire_gauge_ASTM_B258.jpg", "electrical/wire_gauge.jpg"),

    # Roofing
    (("roof flashing", "step flashing", "chimney flashing"),
     "Chimney_flashing.jpg", "roofing/flashing.jpg"),
    (("asphalt shingle", "roof shingle", "shingle installation"),
     "Asphalt_shingles.jpg", "roofing/shingles.jpg"),
    (("roof truss", "rafter", "ridge board"),
     "Roof_framing_plan.jpg", "roofing/truss.jpg"),
    (("valley", "hip", "roof geometry", "roof slope"),
     "Hip_roof_diagram.svg", "roofing/geometry.png"),

    # Plumbing
    (("drain pipe", "p-trap", "drain trap", "plumbing trap"),
     "P-trap_diagram.svg", "plumbing/ptrap.png"),
    (("water heater", "anode rod", "pressure relief valve"),
     "Water_heater_diagram.png", "plumbing/water_heater.png"),
    (("supply line", "shutoff valve", "water supply", "stop valve"),
     "Water_supply_system_diagram.png", "plumbing/supply.png"),
    (("drain vent", "plumbing vent", "stack vent"),
     "Plumbing_rough-in.jpg", "plumbing/vent.jpg"),

    # Foundation & Structure
    (("foundation crack", "concrete crack", "wall crack", "settlement"),
     "Foundation_wall_crack.jpg", "foundation/crack.jpg"),
    (("crawl space", "vapor barrier", "pier", "girder"),
     "Crawlspace_vapor_barrier.jpg", "foundation/crawlspace.jpg"),
    (("floor joist", "beam", "girder", "subfloor"),
     "Floor_joist_diagram.png", "structure/floor_joist.png"),
    (("wood framing", "stud wall", "header", "king stud"),
     "Wood_frame_construction.jpg", "structure/framing.jpg"),

    # HVAC
    (("hvac system", "forced air", "ductwork", "furnace"),
     "Forced_air_heating_system.png", "hvac/forced_air.png"),
    (("heat pump", "refrigerant cycle", "condenser"),
     "Heat_pump_system.png", "hvac/heat_pump.png"),
    (("attic ventilation", "ridge vent", "soffit vent"),
     "Attic_ventilation_diagram.jpg", "hvac/attic_vent.jpg"),

    # Insulation & Moisture
    (("insulation r-value", "batt insulation", "vapor retarder"),
     "Building_insulation_types.jpg", "insulation/types.jpg"),
    (("moisture intrusion", "condensation", "dew point"),
     "Building_envelope_moisture.png", "insulation/moisture.png"),

    # Safety
    (("smoke detector", "co detector", "carbon monoxide"),
     "Smoke_detector_placement.png", "safety/smoke_detector.png"),
    (("egress window", "bedroom egress", "window well"),
     "Egress_window_dimensions.png", "safety/egress.png"),
    (("handrail", "guardrail", "stair safety"),
     "Stair_handrail_code.png", "safety/stairs.png"),
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def wikimedia_direct_url(filename: str) -> str | None:
    """Resolve Wikimedia Commons file → direct image URL via API."""
    url = WIKIMEDIA_API.format(filename=urllib.request.quote(filename))
    req = urllib.request.Request(url, headers={"User-Agent": "GuidianDiagramSeeder/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            info = page.get("imageinfo", [{}])
            if info:
                return info[0].get("url")
    except Exception as e:
        print(f"  ⚠ API lookup failed for {filename}: {e}")
    return None


def download_image(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": "GuidianDiagramSeeder/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read()
    except Exception as e:
        print(f"  ⚠ Download failed: {e}")
        return None


def upload_to_r2(s3, data: bytes, key: str, content_type: str = "image/jpeg") -> str:
    s3.upload_fileobj(
        io.BytesIO(data),
        BUCKET,
        key,
        ExtraArgs={"ContentType": content_type, "CacheControl": "public, max-age=31536000"},
    )
    if R2_PUBLIC:
        return f"{R2_PUBLIC.rstrip('/')}/{key}"
    return f"{S3_ENDPOINT}/{BUCKET}/{key}"


def infer_content_type(filename: str) -> str:
    ext = filename.lower().split(".")[-1]
    return {"png": "image/png", "svg": "image/svg+xml", "jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(ext, "image/jpeg")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not all([S3_ENDPOINT, S3_ACCESS, S3_SECRET]):
        print("ERROR: Set S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY env vars")
        sys.exit(1)

    s3 = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS,
        aws_secret_access_key=S3_SECRET,
        region_name="auto",
    )

    result_map: list[tuple[tuple[str, ...], str]] = []
    failed: list[str] = []

    for keywords, wiki_filename, r2_suffix in DIAGRAMS:
        key = f"{PREFIX}{r2_suffix}"
        print(f"\n→ {wiki_filename}")

        # Check if already uploaded
        try:
            s3.head_object(Bucket=BUCKET, Key=key)
            if R2_PUBLIC:
                r2_url = f"{R2_PUBLIC.rstrip('/')}/{key}"
            else:
                r2_url = f"{S3_ENDPOINT}/{BUCKET}/{key}"
            print(f"  ✓ Already in R2: {r2_url}")
            result_map.append((keywords, r2_url))
            continue
        except Exception:
            pass

        # Resolve Wikimedia URL
        direct_url = wikimedia_direct_url(wiki_filename)
        if not direct_url:
            print(f"  ✗ Could not resolve Wikimedia URL for {wiki_filename}")
            failed.append(wiki_filename)
            continue

        print(f"  ↓ {direct_url[:80]}...")
        data = download_image(direct_url)
        if not data:
            failed.append(wiki_filename)
            continue

        ct = infer_content_type(wiki_filename)
        r2_url = upload_to_r2(s3, data, key, ct)
        print(f"  ✓ Uploaded → {r2_url}")
        result_map.append((keywords, r2_url))
        time.sleep(0.3)  # be polite to Wikimedia

    # ── Write diagram_references.py ──────────────────────────────────────────
    refs_path = Path(__file__).parent.parent / "api" / "guidian" / "services" / "media" / "diagram_references.py"
    lines = [
        '"""',
        "Curated reference diagram URLs for home inspection course topics.",
        "",
        "Each entry maps a set of topic keywords to a self-hosted R2 URL.",
        "Generated by scripts/seed_diagram_references.py — do not edit by hand.",
        '"""',
        "from __future__ import annotations",
        "",
        "# keyword → R2 reference image URL",
        "_REFERENCE_MAP: list[tuple[tuple[str, ...], str]] = [",
    ]
    for keywords, url in result_map:
        kw_repr = repr(keywords)
        lines.append(f"    ({kw_repr}, {repr(url)}),")
    lines += [
        "]",
        "",
        "",
        "def find_reference_url(title: str, objectives: list[str]) -> str | None:",
        '    """',
        "    Given a lesson title and objectives, return a reference diagram URL",
        "    if a curated match exists. Returns None if no match found.",
        '    """',
        '    search_text = " ".join([title.lower()] + [o.lower() for o in objectives])',
        "    for keywords, url in _REFERENCE_MAP:",
        "        if any(kw in search_text for kw in keywords):",
        "            return url",
        "    return None",
        "",
    ]
    refs_path.write_text("\n".join(lines))
    print(f"\n✅ Wrote {len(result_map)} entries to {refs_path}")
    if failed:
        print(f"⚠ Failed to fetch {len(failed)} diagrams: {failed}")
    print("Done.")


if __name__ == "__main__":
    main()
