"""Codex Digest catalog serialization - TOON in, with a minified-JSON fallback switch.

TOON (https://toonformat.dev/) declares field names once and streams rows, which fits the
Phase 1 catalog well: a uniform array of flat records. Everything else in the pipeline stays
plain JSON (Phase 2's nested per-cluster input, and both LLM structured outputs).
"""

import json
from typing import Any

# Flip to True only if the catalog renderer needs to fall back off TOON (e.g. a parsing
# regression is suspected). Kept as a single switch per the design doc rather than deleted,
# so the fallback is one flag away without a redeploy of new code.
USE_TOON_CATALOG = True


def _toon_escape(value: str) -> str:
    """Quote a TOON field value if it contains the delimiter, quotes, or a newline."""
    if any(ch in value for ch in (",", '"', "\n")):
        return '"' + value.replace('"', '""') + '"'
    return value


def render_catalog_toon(catalog: list[dict[str, Any]], counts: dict[str, int]) -> str:
    """Render the Phase 1 catalog as TOON, or minified JSON if USE_TOON_CATALOG is False."""
    if not USE_TOON_CATALOG:
        return json.dumps({"articles": catalog, "counts": counts}, separators=(",", ":"))

    fields = ["id", "source", "age", "published_at", "title", "snippet"]
    lines = [f"articles[{len(catalog)}]{{{','.join(fields)}}}:"]
    for row in catalog:
        values = [_toon_escape(str(row.get(f, ""))) for f in fields]
        lines.append("  " + ",".join(values))

    count_fields = list(counts.keys())
    count_values = ",".join(str(counts[f]) for f in count_fields)
    lines.append(f"counts{{{','.join(count_fields)}}}: {count_values}")

    return "\n".join(lines)
