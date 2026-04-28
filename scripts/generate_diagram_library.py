#!/usr/bin/env python3
"""
Generate a library of ~50 technical construction diagrams using GPT Image 1
and upload them to Cloudflare R2. Updates diagram_references.py on completion.

Usage:
    OPENAI_API_KEY=... S3_ENDPOINT_URL=... S3_ACCESS_KEY=... S3_SECRET_KEY=... \
    python3 scripts/generate_diagram_library.py
"""
from __future__ import annotations

import base64
import io
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import boto3
import openai

# ── Config ────────────────────────────────────────────────────────────────────
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
S3_ENDPOINT = os.environ.get("S3_ENDPOINT_URL", "")
S3_ACCESS = os.environ.get("S3_ACCESS_KEY", "")
S3_SECRET = os.environ.get("S3_SECRET_KEY", "")
BUCKET = "guidian-courses"
MANIFEST_PATH = Path("/tmp/diagram_manifest.json")
REFS_PATH = (
    Path(__file__).parent.parent
    / "api"
    / "guidian"
    / "services"
    / "media"
    / "diagram_references.py"
)

STYLE_SUFFIX = (
    "Clean technical illustration for a professional home inspection training course. "
    "Line-art style with flat colors. White or light cream background (#FAF7F2). "
    "Primary colors: navy blue (#162D4A) for structural elements, slate gray for secondary components, "
    "soft orange (#E67E22) accent arrows and callout labels. "
    "All components clearly labeled with leader lines and text callouts. "
    "No photorealism. No shadows. No people. Crisp vector-style lines. "
    "Suitable for licensed professional certification material."
)


@dataclass
class Diagram:
    key: str
    keywords: tuple[str, ...]
    r2_key: str
    prompt: str


DIAGRAMS: list[Diagram] = [
    # ── Structural ─────────────────────────────────────────────────────────────
    Diagram(
        key="wall_framing",
        keywords=("wood framing", "stud wall", "header", "king stud", "wall framing", "cripple stud"),
        r2_key="diagrams/structural/wall-framing.png",
        prompt=(
            "Technical diagram of wood wall framing showing: double top plate, bottom plate, king studs, "
            "trimmer studs, headers over door and window openings, cripple studs above and below openings, "
            "regular studs at 16 inches on center, subfloor, and rough opening dimensions labeled. "
            "Show both door and window rough openings. Label all components with leader lines."
        ),
    ),
    Diagram(
        key="floor_joist_system",
        keywords=("floor joist", "floor framing", "subfloor", "sill plate", "floor beam"),
        r2_key="diagrams/structural/floor-joist-system.png",
        prompt=(
            "Cross-section diagram of floor framing showing: sill plate on foundation, floor joists spanning "
            "between beams, blocking between joists, subfloor sheathing on top, beam/girder support in center, "
            "post and pier support below. Label all components."
        ),
    ),
    Diagram(
        key="roof_rafter_framing",
        keywords=("rafter", "ridge board", "bird mouth", "collar tie", "roof framing", "rafter tail"),
        r2_key="diagrams/structural/roof-rafter-framing.png",
        prompt=(
            "Roof framing diagram showing: ridge board at peak, common rafters, bird mouth cut at wall plate, "
            "rafter tail/overhang, ceiling joists, collar ties, wall top plate. "
            "Show proper angles and label all components."
        ),
    ),
    Diagram(
        key="load_path_diagram",
        keywords=("load path", "gravity load", "structural load", "force transfer", "load bearing"),
        r2_key="diagrams/structural/load-path.png",
        prompt=(
            "Vertical cross-section of a house showing gravity load path: roof load → rafters → wall top plate "
            "→ wall studs → floor system → foundation → soil. Use arrows to show force transfer at each "
            "connection point. Label each structural element."
        ),
    ),
    Diagram(
        key="foundation_types",
        keywords=("foundation type", "slab on grade", "crawlspace foundation", "basement foundation", "stem wall"),
        r2_key="diagrams/structural/foundation-types.png",
        prompt=(
            "Three side-by-side diagrams comparing: (1) slab-on-grade foundation with thickened edge, "
            "(2) crawlspace with stem wall and pier, (3) full basement with footer. "
            "Label key components of each."
        ),
    ),
    Diagram(
        key="crawlspace_anatomy",
        keywords=("crawl space", "crawlspace", "vapor barrier", "pier", "girder", "crawlspace ventilation"),
        r2_key="diagrams/structural/crawlspace-anatomy.png",
        prompt=(
            "Cross-section of crawlspace showing: exterior stem wall, interior piers, girder beam, floor joists, "
            "subfloor, vapor barrier on ground, ventilation openings in stem wall, access door. "
            "Label all components and show moisture problems location."
        ),
    ),
    Diagram(
        key="beam_connections",
        keywords=("beam connection", "post beam", "beam to post", "structural connection", "hold down"),
        r2_key="diagrams/structural/beam-connections.png",
        prompt=(
            "Detail diagrams of structural connections: (1) wood beam bearing on wood post with post cap hardware, "
            "(2) beam-to-column bolted connection with through bolts, (3) beam pocket in foundation wall. "
            "Label bearing surfaces, fasteners, and minimum bearing lengths."
        ),
    ),
    Diagram(
        key="cantilever_framing",
        keywords=("cantilever", "cantilevered floor", "bay window framing", "cantilever joist"),
        r2_key="diagrams/structural/cantilever-framing.png",
        prompt=(
            "Cross-section diagram of cantilevered floor framing showing: interior bearing wall, double rim joist, "
            "cantilevered floor joists extending beyond bearing, lookout framing, maximum cantilever length labeled. "
            "Show correct perpendicular cantilever framing direction. Label all components."
        ),
    ),

    # ── Roofing ────────────────────────────────────────────────────────────────
    Diagram(
        key="roof_shingle_layers",
        keywords=("asphalt shingle", "shingle installation", "roof shingle", "underlayment", "ice and water shield"),
        r2_key="diagrams/roofing/roof-shingle-layers.png",
        prompt=(
            "Exploded cross-section diagram of asphalt shingle roof assembly showing layers from bottom to top: "
            "roof deck/sheathing, ice and water shield at eave, felt underlayment, starter strip, first course "
            "shingles, overlapping shingle courses, ridge cap. Label each layer with arrows."
        ),
    ),
    Diagram(
        key="step_flashing_detail",
        keywords=("step flashing", "roof to wall", "sidewall flashing", "counterflashing"),
        r2_key="diagrams/roofing/step-flashing-detail.png",
        prompt=(
            "Close-up detail drawing of step flashing at roof-to-wall intersection showing: individual L-shaped "
            "step flashing pieces alternating with shingles, counter flashing over step flashing, wall sheathing, "
            "proper overlap. Label all components."
        ),
    ),
    Diagram(
        key="valley_flashing_types",
        keywords=("roof valley", "valley flashing", "open valley", "closed valley", "woven valley"),
        r2_key="diagrams/roofing/valley-flashing-types.png",
        prompt=(
            "Two diagrams side by side: (1) open valley with metal valley flashing exposed, (2) closed/woven "
            "valley with shingles overlapping. Show water flow direction with arrows. "
            "Label each type and key components."
        ),
    ),
    Diagram(
        key="chimney_flashing_detail",
        keywords=("chimney flashing", "chimney cricket", "saddle flashing", "chimney counterflashing"),
        r2_key="diagrams/roofing/chimney-flashing-detail.png",
        prompt=(
            "Isometric view of chimney flashing showing: base flashing, step flashing up sides, saddle/cricket "
            "behind chimney, counter flashing embedded in mortar joints, caulking locations. "
            "Label all components."
        ),
    ),
    Diagram(
        key="roof_drainage_hierarchy",
        keywords=("roof drainage", "gutter downspout", "roof runoff", "drainage path", "splash block"),
        r2_key="diagrams/roofing/roof-drainage-hierarchy.png",
        prompt=(
            "Diagram of roof showing water drainage path: rain hits field of roof → flows to eave → into gutter "
            "→ down downspout → away from foundation via splash block or underground drain. "
            "Label each component."
        ),
    ),
    Diagram(
        key="gutter_installation",
        keywords=("gutter installation", "gutter slope", "drip edge", "gutter hanger", "fascia gutter"),
        r2_key="diagrams/roofing/gutter-installation.png",
        prompt=(
            "Cross-section of eave and gutter showing: fascia board, gutter hanger, gutter slope direction "
            "(1/4 inch per 10 feet), downspout outlet, drip edge overlapping gutter, shingle extending over "
            "drip edge. Label all components."
        ),
    ),
    Diagram(
        key="ice_dam_formation",
        keywords=("ice dam", "ice damming", "roof ice", "freeze thaw roof", "eave ice"),
        r2_key="diagrams/roofing/ice-dam-formation.png",
        prompt=(
            "Cross-section diagram showing ice dam formation at eave: warm attic above, heat loss through roof "
            "deck melting snow, water refreezing at cold eave overhang, ice dam blocking drainage, water backing "
            "up under shingles. Show arrows for heat flow and water infiltration path into structure. "
            "Label all components."
        ),
    ),
    Diagram(
        key="roof_ventilation_types",
        keywords=("roof vent", "ridge vent", "power vent", "turbine vent", "box vent", "roof ventilation type"),
        r2_key="diagrams/roofing/roof-ventilation-types.png",
        prompt=(
            "Three side-by-side diagrams comparing roof ventilation types: (1) ridge vent running along peak, "
            "(2) box/static vent near ridge, (3) powered attic ventilator. Show airflow arrows for each type. "
            "Label each type name and key components."
        ),
    ),
    Diagram(
        key="fascia_soffit_detail",
        keywords=("fascia", "soffit", "frieze board", "eave detail", "soffit vent"),
        r2_key="diagrams/roofing/fascia-soffit-detail.png",
        prompt=(
            "Cross-section detail of eave assembly showing: rafter tail, lookout, fascia board, soffit panel, "
            "soffit continuous vent strip, frieze board at wall, bed molding, gutter attachment. "
            "Label all components with leader lines."
        ),
    ),

    # ── Electrical ─────────────────────────────────────────────────────────────
    Diagram(
        key="service_entrance_panel",
        keywords=("service entrance", "service drop", "weatherhead", "meter socket", "service conductor"),
        r2_key="diagrams/electrical/service-entrance-panel.png",
        prompt=(
            "Labeled diagram of residential electrical service showing: service drop wires from utility pole, "
            "weatherhead/service entrance, meter socket, service entrance conductors, main disconnect breaker, "
            "main panel box, hot bus bars, neutral bus bar, ground bus bar, individual circuit breakers. "
            "Label all components."
        ),
    ),
    Diagram(
        key="circuit_breaker_panel",
        keywords=("electrical panel", "breaker panel", "load center", "circuit breaker", "service panel", "bus bar"),
        r2_key="diagrams/electrical/circuit-breaker-panel.png",
        prompt=(
            "Front view of open electrical panel showing: main breaker at top, two hot bus bars, double-pole "
            "breakers for 240V circuits, single-pole breakers for 120V circuits, neutral/ground bus bar, "
            "panel schedule area. Label all components."
        ),
    ),
    Diagram(
        key="gfci_outlet_wiring",
        keywords=("gfci", "ground fault", "gfci outlet", "gfci wiring", "gfci protection", "load terminal"),
        r2_key="diagrams/electrical/gfci-outlet-wiring.png",
        prompt=(
            "Diagram of GFCI outlet showing: LINE terminals (from panel), LOAD terminals (to downstream outlets), "
            "ground terminal, test and reset buttons. Second diagram shows GFCI protecting multiple downstream "
            "outlets. Label all connections."
        ),
    ),
    Diagram(
        key="branch_circuit_diagram",
        keywords=("branch circuit", "circuit wiring", "wire color", "hot neutral ground", "circuit path"),
        r2_key="diagrams/electrical/branch-circuit-diagram.png",
        prompt=(
            "Diagram showing how branch circuit runs from panel: circuit breaker → hot wire → outlet/switch/fixture "
            "→ neutral wire back to panel → ground wire to ground bus. Show proper wire colors (black hot, white "
            "neutral, green/bare ground). Label all."
        ),
    ),
    Diagram(
        key="electrical_defects_checklist",
        keywords=(
            "electrical defect",
            "double tapped",
            "aluminum wiring hazard",
            "ungrounded outlet",
            "reversed polarity",
            "electrical hazard",
        ),
        r2_key="diagrams/electrical/electrical-defects-checklist.png",
        prompt=(
            "Inspection checklist diagram showing common electrical defects as labeled callouts: double-tapped "
            "breakers, aluminum wiring, ungrounded outlets, missing knockouts, improper wire gauge, reversed "
            "polarity. Use warning symbols."
        ),
    ),
    Diagram(
        key="aluminum_wiring_identification",
        keywords=("aluminum wiring", "AL wiring", "aluminum conductor", "aluminum wire hazard"),
        r2_key="diagrams/electrical/aluminum-wiring-identification.png",
        prompt=(
            "Identification diagram for aluminum branch circuit wiring: copper wire cross-section vs aluminum "
            "wire cross-section, label 'AL' marking on wire jacket, oxidation at connections, correct anti-oxidant "
            "compound application, CO/ALR rated device vs standard device. Label all identification markers."
        ),
    ),
    Diagram(
        key="whole_house_grounding",
        keywords=("grounding electrode", "ground rod", "water pipe ground", "grounding system", "GEC"),
        r2_key="diagrams/electrical/whole-house-grounding.png",
        prompt=(
            "Diagram of residential grounding electrode system showing: main panel, grounding electrode conductor "
            "(GEC), ground rods (minimum 8 feet deep), water pipe connection, bonding jumper. "
            "Show bond between all grounding electrodes. Label conductor sizes and components."
        ),
    ),
    Diagram(
        key="knob_tube_wiring",
        keywords=("knob and tube", "knob tube", "old wiring", "ceramic knob", "ceramic tube", "cloth wiring"),
        r2_key="diagrams/electrical/knob-tube-wiring.png",
        prompt=(
            "Diagram of knob-and-tube wiring system in joist bay showing: ceramic knob insulators holding wire "
            "away from wood, ceramic tube through drilled hole, open air wiring (no conduit or sheathing), "
            "separate hot and neutral conductors. Label components and note age/hazard considerations."
        ),
    ),

    # ── Plumbing ───────────────────────────────────────────────────────────────
    Diagram(
        key="dwv_system_diagram",
        keywords=("drain waste vent", "DWV", "plumbing vent", "soil stack", "branch drain", "cleanout"),
        r2_key="diagrams/plumbing/dwv-system.png",
        prompt=(
            "Diagram of drain-waste-vent (DWV) plumbing system in a house cross-section showing: soil stack "
            "running vertically, branch drains connecting at angles, vent stack extending through roof, P-traps "
            "at each fixture, cleanout access points, connection to sewer at foundation. Label all components."
        ),
    ),
    Diagram(
        key="p_trap_function",
        keywords=("p trap", "drain trap", "trap seal", "trap arm", "sewer gas", "plumbing trap"),
        r2_key="diagrams/plumbing/p-trap-function.png",
        prompt=(
            "Cross-section diagram of P-trap under sink showing: tailpiece from sink drain, P-trap water seal "
            "(label water level), trap arm to wall drain, vent connection above trap arm. Show sewer gas being "
            "blocked by water seal. Label all components."
        ),
    ),
    Diagram(
        key="water_heater_anatomy",
        keywords=("water heater", "anode rod", "dip tube", "T&P valve", "water heater components", "gas water heater"),
        r2_key="diagrams/plumbing/water-heater-anatomy.png",
        prompt=(
            "Labeled diagram of gas water heater showing: cold water inlet (top), hot water outlet (top), anode "
            "rod, dip tube, thermostat, gas burner, flue/vent, temperature and pressure relief valve (T&P valve) "
            "with discharge pipe to floor, drain valve at bottom. Label all."
        ),
    ),
    Diagram(
        key="supply_system_diagram",
        keywords=("water supply", "supply system", "pressure reducing valve", "main shutoff", "water distribution"),
        r2_key="diagrams/plumbing/supply-system.png",
        prompt=(
            "Diagram of residential water supply system showing: water meter, main shutoff valve, pressure "
            "reducing valve, water heater branch, cold water distribution, hot water distribution, individual "
            "fixture shutoffs. Show proper pipe flow direction with arrows."
        ),
    ),
    Diagram(
        key="water_heater_tpr_valve",
        keywords=("T&P valve", "temperature pressure relief", "relief valve", "TPR valve", "water heater safety"),
        r2_key="diagrams/plumbing/water-heater-tpr-valve.png",
        prompt=(
            "Detail diagram of T&P relief valve installation showing: valve mounted in top or side of water "
            "heater, discharge pipe running full-size to within 6 inches of floor or pan, no threads on end of "
            "discharge pipe, proper downward pitch. Label code requirements."
        ),
    ),
    Diagram(
        key="water_meter_shutoff",
        keywords=("water meter", "main shutoff valve", "water service", "curb stop", "ball valve shutoff"),
        r2_key="diagrams/plumbing/water-meter-shutoff.png",
        prompt=(
            "Diagram of water service entry showing: street main, curb stop valve box at property line, water "
            "service pipe running underground, water meter at house, main house shutoff valve, pressure reducing "
            "valve, expansion tank. Label all components and flow direction."
        ),
    ),
    Diagram(
        key="drain_slope_requirements",
        keywords=("drain slope", "pipe slope", "drain pitch", "1/4 inch per foot", "horizontal drain grade"),
        r2_key="diagrams/plumbing/drain-slope-requirements.png",
        prompt=(
            "Diagram illustrating proper horizontal drain pipe slope requirements: pipe shown at correct 1/4 inch "
            "per foot fall for 3-inch and smaller pipes, 1/8 inch per foot for 4-inch pipes. Show side view with "
            "slope exaggerated for clarity. Label slope ratios and pipe sizes."
        ),
    ),
    Diagram(
        key="plumbing_vent_types",
        keywords=("air admittance valve", "AAV", "wet vent", "plumbing vent types", "island vent", "vent stack"),
        r2_key="diagrams/plumbing/plumbing-vent-types.png",
        prompt=(
            "Three side-by-side diagrams comparing plumbing vent configurations: (1) individual vent pipe through "
            "roof, (2) wet vent serving multiple fixtures on one drain/vent, (3) air admittance valve (AAV) under "
            "sink. Label each type, show fixtures connected, and note code limitations."
        ),
    ),

    # ── HVAC ───────────────────────────────────────────────────────────────────
    Diagram(
        key="forced_air_system",
        keywords=("forced air", "hvac ductwork", "supply duct", "return air", "furnace", "air handler"),
        r2_key="diagrams/hvac/forced-air-system.png",
        prompt=(
            "Diagram of forced air heating/cooling system showing: furnace/air handler in mechanical room, supply "
            "air plenum, supply ducts to each room, supply registers, return air grilles, return ducts back to air "
            "handler, filter location, thermostat. Show airflow direction with arrows."
        ),
    ),
    Diagram(
        key="heat_pump_refrigerant_cycle",
        keywords=("heat pump", "refrigerant cycle", "compressor", "condenser", "evaporator", "heat pump cycle"),
        r2_key="diagrams/hvac/heat-pump-refrigerant-cycle.png",
        prompt=(
            "Diagram of heat pump refrigerant cycle showing: compressor, condenser coil (outside unit), expansion "
            "valve, evaporator coil (inside air handler). Show refrigerant flow direction and label where heat is "
            "absorbed vs. rejected. Label heating mode vs. cooling mode."
        ),
    ),
    Diagram(
        key="combustion_air_requirements",
        keywords=("combustion air", "confined space", "gas appliance", "combustion air opening", "direct vent"),
        r2_key="diagrams/hvac/combustion-air-requirements.png",
        prompt=(
            "Diagram showing combustion air requirements for gas appliances: confined space with two vents (one "
            "high, one low), unconfined space (house itself provides air), direct vent appliance with sealed "
            "combustion. Label minimum opening sizes and locations."
        ),
    ),
    Diagram(
        key="attic_ventilation_diagram",
        keywords=("attic ventilation", "soffit vent", "ridge vent", "attic airflow", "net free area"),
        r2_key="diagrams/hvac/attic-ventilation.png",
        prompt=(
            "Cross-section of attic showing balanced ventilation: soffit/eave vents at low point allowing air "
            "intake, ridge vent or roof vents at high point for exhaust, airflow path from soffit through baffles "
            "over insulation to ridge. Label components and airflow direction."
        ),
    ),
    Diagram(
        key="air_handler_components",
        keywords=("air handler", "blower motor", "evaporator coil", "heat strip", "air handler components", "furnace components"),
        r2_key="diagrams/hvac/air-handler-components.png",
        prompt=(
            "Cutaway diagram of residential air handler unit showing: return air plenum, air filter, blower motor "
            "and fan, evaporator coil, condensate drain pan and trap, supply air plenum, electric heat strips. "
            "Label each component with leader lines."
        ),
    ),
    Diagram(
        key="duct_system_types",
        keywords=("duct system", "flex duct", "sheet metal duct", "duct board", "duct leakage", "duct type"),
        r2_key="diagrams/hvac/duct-system-types.png",
        prompt=(
            "Three cross-section diagrams comparing duct types: (1) sheet metal rectangular duct with mastic "
            "sealant at joints, (2) round sheet metal duct with sheet metal screws, (3) flexible duct with inner "
            "liner, insulation, and outer jacket. Label materials, sealing method, and note R-value of each."
        ),
    ),

    # ── Moisture & Insulation ──────────────────────────────────────────────────
    Diagram(
        key="vapor_barrier_placement",
        keywords=("vapor barrier", "vapor retarder", "vapor barrier placement", "climate zone insulation", "wall vapor"),
        r2_key="diagrams/moisture/vapor-barrier-placement.png",
        prompt=(
            "Wall cross-section diagram showing correct and incorrect vapor barrier placement in different climate "
            "zones: warm climate (vapor retarder on exterior side), cold climate (vapor retarder on interior/warm "
            "side), mixed climate. Label each scenario."
        ),
    ),
    Diagram(
        key="insulation_types_comparison",
        keywords=("insulation type", "batt insulation", "blown insulation", "rigid foam", "spray foam", "R-value comparison"),
        r2_key="diagrams/moisture/insulation-types-comparison.png",
        prompt=(
            "Three side-by-side cross-sections showing: (1) batt insulation between studs, (2) blown/loose-fill "
            "insulation in attic, (3) rigid foam insulation on exterior. Label R-value location, thermal bridging "
            "through studs, and proper installation details."
        ),
    ),
    Diagram(
        key="moisture_intrusion_paths",
        keywords=("moisture intrusion", "water infiltration", "moisture path", "building envelope moisture", "water entry"),
        r2_key="diagrams/moisture/moisture-intrusion-paths.png",
        prompt=(
            "House cross-section showing common moisture intrusion pathways with warning callouts: roof flashing "
            "failure, window pan flashing, wall cladding gap at grade, foundation crack, crawlspace vapor, "
            "bathroom exhaust into attic. Label each pathway."
        ),
    ),
    Diagram(
        key="window_installation_flashing",
        keywords=("window flashing", "window rough opening", "pan flashing", "WRB", "window installation detail"),
        r2_key="diagrams/moisture/window-installation-flashing.png",
        prompt=(
            "Exploded view of window rough opening with flashing details: sill pan flashing sloped to drain, "
            "flexible flashing tape at jambs and head, housewrap/WRB integration, weep holes at sill, "
            "backer rod and sealant at perimeter. Label all components and installation sequence."
        ),
    ),
    Diagram(
        key="deck_ledger_connection",
        keywords=("deck ledger", "ledger board", "deck attachment", "ledger flashing", "deck to house connection"),
        r2_key="diagrams/moisture/deck-ledger-connection.png",
        prompt=(
            "Cross-section detail of deck ledger attached to house showing: proper flashing over ledger to "
            "prevent water infiltration, through-bolts or structural screws at pattern spacing, standoff "
            "spacers between ledger and sheathing for drainage, joist hanger connections, ledger to rim joist. "
            "Label all components."
        ),
    ),

    # ── Safety ─────────────────────────────────────────────────────────────────
    Diagram(
        key="smoke_co_detector_placement",
        keywords=("smoke detector", "CO detector", "carbon monoxide", "smoke alarm placement", "detector location"),
        r2_key="diagrams/safety/smoke-co-detector-placement.png",
        prompt=(
            "Floor plan view of two-story house showing required smoke detector locations: each bedroom, outside "
            "each sleeping area, each level of home including basement. Also show CO detector placement: each "
            "level, outside each sleeping area. Use different symbols for each type."
        ),
    ),
    Diagram(
        key="egress_window_requirements",
        keywords=("egress window", "bedroom egress", "window egress", "egress opening", "egress requirements"),
        r2_key="diagrams/safety/egress-window-requirements.png",
        prompt=(
            "Cross-section diagram of bedroom egress window showing minimum requirements: 5.7 sq ft net clear "
            "opening, minimum 24 inches clear height, minimum 20 inches clear width, maximum 44 inch sill height "
            "from floor. Label all dimensions."
        ),
    ),
    Diagram(
        key="stair_requirements",
        keywords=("stair code", "riser height", "tread depth", "handrail", "stair requirements", "stairway"),
        r2_key="diagrams/safety/stair-requirements.png",
        prompt=(
            "Side-view diagram of stairs showing code requirements: maximum 8.25 inch riser height, minimum 9 "
            "inch tread depth, continuous graspable handrail, 36 inch minimum clear width, headroom clearance. "
            "Label all dimensions."
        ),
    ),
    Diagram(
        key="deck_guardrail_code",
        keywords=("deck guardrail", "baluster spacing", "guardrail height", "deck railing", "guardrail code"),
        r2_key="diagrams/safety/deck-guardrail-code.png",
        prompt=(
            "Side and detail view of deck guardrail showing code requirements: minimum 36-inch height (42-inch "
            "for decks over 30 inches high), maximum 4-inch baluster spacing (sphere test), graspable top rail, "
            "post to framing connection at deck frame. Label all dimensions and code references."
        ),
    ),
    Diagram(
        key="garage_fire_separation",
        keywords=("garage fire separation", "garage to house", "fire wall garage", "garage door rating", "attached garage"),
        r2_key="diagrams/safety/garage-fire-separation.png",
        prompt=(
            "Cross-section diagram of attached garage showing required fire separation: 5/8-inch Type X drywall "
            "on garage side of common wall, solid-core or 20-minute fire-rated door with self-closer, sill raised "
            "4 inches at house entry. Label code requirements and dimensions."
        ),
    ),
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def r2_key_exists(s3, key: str) -> bool:
    try:
        s3.head_object(Bucket=BUCKET, Key=key)
        return True
    except Exception:
        return False


def generate_image(client: openai.OpenAI, prompt: str) -> bytes:
    full_prompt = f"{prompt} {STYLE_SUFFIX}"
    response = client.images.generate(
        model="gpt-image-1",
        prompt=full_prompt,
        size="1024x1024",
        quality="medium",
        n=1,
    )
    return base64.b64decode(response.data[0].b64_json)


def upload_to_r2(s3, data: bytes, key: str) -> str:
    s3.upload_fileobj(
        io.BytesIO(data),
        BUCKET,
        key,
        ExtraArgs={"ContentType": "image/png", "CacheControl": "public, max-age=31536000"},
    )
    return f"{S3_ENDPOINT}/{BUCKET}/{key}"


def write_diagram_references(result_map: list[tuple[tuple[str, ...], str]]) -> None:
    lines = [
        '"""',
        "Curated reference diagram URLs for home inspection course topics.",
        "",
        "Each entry maps a set of topic keywords to a self-hosted R2 URL.",
        "Generated by scripts/generate_diagram_library.py — do not edit by hand.",
        '"""',
        "from __future__ import annotations",
        "",
        "# keyword → R2 reference image URL",
        "_REFERENCE_MAP: list[tuple[tuple[str, ...], str]] = [",
    ]
    for keywords, url in result_map:
        lines.append(f"    ({repr(keywords)}, {repr(url)}),")
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
    REFS_PATH.write_text("\n".join(lines))
    print(f"\n✅ Wrote {len(result_map)} entries to {REFS_PATH}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    if not OPENAI_API_KEY:
        print("ERROR: OPENAI_API_KEY not set")
        sys.exit(1)
    if not all([S3_ENDPOINT, S3_ACCESS, S3_SECRET]):
        print("ERROR: Set S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY env vars")
        sys.exit(1)

    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    s3 = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS,
        aws_secret_access_key=S3_SECRET,
        region_name="auto",
    )

    manifest: list[dict] = []
    result_map: list[tuple[tuple[str, ...], str]] = []
    failed: list[str] = []

    total = len(DIAGRAMS)
    for i, diagram in enumerate(DIAGRAMS, 1):
        print(f"\n[{i}/{total}] {diagram.key}")
        r2_url = f"{S3_ENDPOINT}/{BUCKET}/{diagram.r2_key}"

        if r2_key_exists(s3, diagram.r2_key):
            print("  ✓ Already in R2 — skipping")
            manifest.append({"key": diagram.key, "r2_key": diagram.r2_key, "url": r2_url, "status": "skipped"})
            result_map.append((diagram.keywords, r2_url))
            continue

        try:
            print("  → Generating with GPT Image 1...")
            image_bytes = generate_image(client, diagram.prompt)
            uploaded_url = upload_to_r2(s3, image_bytes, diagram.r2_key)
            print(f"  ✓ Uploaded → {uploaded_url}")
            manifest.append({"key": diagram.key, "r2_key": diagram.r2_key, "url": uploaded_url, "status": "generated"})
            result_map.append((diagram.keywords, uploaded_url))
            time.sleep(0.5)
        except Exception as exc:
            print(f"  ✗ Failed: {exc}")
            failed.append(diagram.key)
            manifest.append({"key": diagram.key, "r2_key": diagram.r2_key, "url": "", "status": f"failed: {exc}"})

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))
    print(f"\n📄 Manifest written to {MANIFEST_PATH}")

    if result_map:
        write_diagram_references(result_map)

    if failed:
        print(f"\n⚠  Failed: {len(failed)} diagrams: {failed}")
    else:
        print(f"\n✅ All {len(result_map)} diagrams complete.")


if __name__ == "__main__":
    main()
