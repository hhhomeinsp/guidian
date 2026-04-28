"""
Curated reference diagram URLs for home inspection course topics.

This map is intentionally empty. Diagrams are sourced and uploaded manually
by the course author to ensure technical accuracy. AI-generated diagrams
were removed due to inaccuracy.

To add a diagram:
1. Upload the SVG/PNG to R2 under guidian-courses/diagrams/<category>/<name>.png
2. Add an entry to _REFERENCE_MAP below: (keywords_tuple, r2_public_url)
"""
from __future__ import annotations

# keyword → R2 reference image URL (populated manually by course author)
_REFERENCE_MAP: list[tuple[tuple[str, ...], str]] = []


def find_reference_url(title: str, objectives: list[str]) -> str | None:
    """Return a reference diagram URL if a curated match exists."""
    search_text = " ".join([title.lower()] + [o.lower() for o in objectives])
    for keywords, url in _REFERENCE_MAP:
        if any(kw in search_text for kw in keywords):
            return url
    return None
