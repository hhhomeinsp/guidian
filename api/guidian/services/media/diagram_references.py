"""
Curated reference diagram URLs for home inspection course topics.

Each entry maps a set of topic keywords to a publicly accessible technical
diagram image. These are used as structural references for GPT Image 1's
edit endpoint — the AI recreates the diagram in the course's consistent
visual style while preserving technical accuracy.

Sources: InterNACHI, building science institutions, and open educational resources.
"""
from __future__ import annotations

# keyword → reference image URL
# Keywords are lowercased lesson title fragments or objective keywords.
_REFERENCE_MAP: list[tuple[tuple[str, ...], str]] = [
    # Roofing
    (("flashing", "valley", "step flashing", "wall flashing"),
     "https://www.nachi.org/images/flashing-parts.jpg"),
    (("roof component", "roofing system", "roof covering", "shingle", "underlayment"),
     "https://www.nachi.org/images/roof-diagram.jpg"),
    (("chimney", "chimney flashing", "saddle", "cricket"),
     "https://www.nachi.org/images/chimney-flashing.jpg"),
    (("roof drainage", "gutter", "downspout", "grading", "site drainage"),
     "https://www.nachi.org/images/gutter-diagram.jpg"),

    # Structural
    (("foundation type", "slab", "crawlspace", "basement foundation"),
     "https://www.nachi.org/images/foundation-types.jpg"),
    (("wood framing", "platform framing", "floor joist", "stud wall", "roof framing"),
     "https://www.nachi.org/images/wood-framing.jpg"),
    (("load path", "bearing wall", "structural load", "beam", "post"),
     "https://www.nachi.org/images/load-path.jpg"),
    (("concrete crack", "foundation crack", "masonry", "efflorescence"),
     "https://www.nachi.org/images/foundation-cracks.jpg"),

    # Electrical
    (("electrical panel", "breaker panel", "service panel", "sub-panel"),
     "https://www.nachi.org/images/electrical-panel.jpg"),
    (("gfci", "afci", "arc fault", "ground fault"),
     "https://www.nachi.org/images/gfci-locations.jpg"),
    (("electrical service", "service entrance", "meter base", "service drop"),
     "https://www.nachi.org/images/service-entrance.jpg"),
    (("wiring", "branch circuit", "knob and tube", "aluminum wiring"),
     "https://www.nachi.org/images/wiring-types.jpg"),

    # Plumbing
    (("water heater", "t&p valve", "temperature pressure relief", "water heating"),
     "https://www.nachi.org/images/water-heater.jpg"),
    (("drain waste vent", "dwv", "p-trap", "drain", "vent stack"),
     "https://www.nachi.org/images/dwv-system.jpg"),
    (("water supply", "pipe material", "copper", "pex", "cpvc", "galvanized"),
     "https://www.nachi.org/images/supply-piping.jpg"),

    # HVAC
    (("furnace", "forced air", "heat exchanger", "heat pump"),
     "https://www.nachi.org/images/furnace-diagram.jpg"),
    (("duct system", "ductwork", "supply register", "return air"),
     "https://www.nachi.org/images/duct-system.jpg"),
    (("air conditioning", "condensing unit", "refrigerant", "cooling system"),
     "https://www.nachi.org/images/ac-system.jpg"),
    (("boiler", "hydronic", "radiator", "baseboard heat"),
     "https://www.nachi.org/images/boiler-system.jpg"),

    # Attic & insulation
    (("attic ventilation", "ridge vent", "soffit vent", "net free area"),
     "https://www.nachi.org/images/attic-ventilation.jpg"),
    (("insulation", "r-value", "batt insulation", "blown insulation", "spray foam"),
     "https://www.nachi.org/images/insulation-types.jpg"),
    (("ice dam", "condensation", "vapor barrier", "moisture attic"),
     "https://www.nachi.org/images/ice-dam.jpg"),

    # Crawlspace & basement
    (("crawlspace", "vapor barrier", "crawl space moisture"),
     "https://www.nachi.org/images/crawlspace.jpg"),
    (("sump pump", "waterproofing", "french drain", "hydrostatic"),
     "https://www.nachi.org/images/sump-pump.jpg"),
    (("wood rot", "fungal decay", "wood destroying", "wdo", "termite"),
     "https://www.nachi.org/images/wood-decay.jpg"),

    # Exterior
    (("exterior cladding", "siding", "stucco", "brick veneer", "fiber cement"),
     "https://www.nachi.org/images/cladding-types.jpg"),
    (("deck", "ledger", "deck framing", "guardrail", "deck inspection"),
     "https://www.nachi.org/images/deck-diagram.jpg"),
    (("window flashing", "door flashing", "window installation"),
     "https://www.nachi.org/images/window-flashing.jpg"),

    # Interior
    (("stair", "riser", "tread", "handrail", "guardrail"),
     "https://www.nachi.org/images/stair-diagram.jpg"),
    (("garage door", "fire separation", "garage inspection"),
     "https://www.nachi.org/images/garage-diagram.jpg"),
]


def find_reference_url(title: str, objectives: list[str]) -> str | None:
    """
    Given a lesson title and objectives, return a reference diagram URL
    if a curated match exists. Returns None if no match found.
    """
    search_text = " ".join([title.lower()] + [o.lower() for o in objectives])
    for keywords, url in _REFERENCE_MAP:
        if any(kw in search_text for kw in keywords):
            return url
    return None
