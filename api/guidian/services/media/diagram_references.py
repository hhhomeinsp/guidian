"""
Curated reference diagram URLs for home inspection course topics.

Each entry maps a set of topic keywords to a publicly accessible technical
diagram image. These are used as structural references for GPT Image 1's
edit endpoint — the AI recreates the diagram in the course's consistent
visual style while preserving technical accuracy.

NOTE: External diagram sources (InterNACHI, Wikimedia) block server-side
hotlinking. This map is intentionally empty until self-hosted reference
images are available. All generation falls back to text-only prompts.
"""
from __future__ import annotations

# keyword → reference image URL
_REFERENCE_MAP: list[tuple[tuple[str, ...], str]] = []


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
