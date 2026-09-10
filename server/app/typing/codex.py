"""Codex Digest schemas - LLM structured I/O and HTTP request/response shapes."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import CodexDigestPhase, CodexDigestStatus
from app.typing.common import response_config
from app.typing.entries import EntryListItem

# ================= Phase 1 — Triage & cluster (LLM structured output) =================


class CodexCluster(BaseModel):
    """A group of articles covering the same event/release, as found by Phase 1."""

    label: str = Field(description="Short headline describing the development")
    article_ids: list[int] = Field(description="Catalog ids, strongest write-up first")
    source_count: int = Field(description="Number of distinct sources covering this")
    article_count: int = Field(description="Total number of articles covering this")


class CodexTriageOutput(BaseModel):
    """Phase 1 LLM output: clusters + standalone stand-outs over the whole catalog."""

    headline: str = Field(
        default="",
        description=(
            "A SHORT front-page headline for the whole day — roughly 3-8 words, no trailing "
            "clause. This is the digest's <h1>. All the framing/nuance goes in `gist`, never "
            "here. E.g. 'A model release and a datacenter mega-raise', 'A quiet news day'."
        ),
    )
    gist: str = Field(
        description=(
            "1-2 plain-language sentences framing the shape of the day — the standfirst that "
            "sits UNDER the headline. This carries the nuance the short headline can't; do "
            "not just restate the headline."
        )
    )
    clusters: list[CodexCluster]
    worth_reading_ids: list[int] = Field(description="Catalog ids of standalone stand-outs, not in any cluster")
    themes: list[str] = Field(
        default_factory=list,
        description=(
            "2-4 short, specific topic labels for what dominated the day — search-box "
            "phrases, proper nouns preferred ('AI datacenter financing', 'Postgres 18'), "
            "never vague categories like 'technology'. Ordered by prominence."
        ),
    )


# ================= Phase 2 — Synthesis (LLM structured output) =================


class CodexDevelopment(BaseModel):
    """A synthesised development, ready to resolve article_ids and persist."""

    title: str = Field(
        description=(
            "Short headline for the development — a clean newspaper-style title, roughly "
            "4-9 words, no trailing clauses. Framing and context belong in the synthesis "
            "bullets, not the title."
        )
    )
    synthesis: str = Field(
        description=(
            "Markdown synthesis of the through-line across sources: 3-5 tight bullet "
            "points (`- ` list), digest-style like an article summary — each ONE short "
            "sentence (roughly 8-16 words) leading with the concrete fact, name, number, "
            "or the specific point of agreement/divergence. The first bullet should frame "
            "what happened and why it matters; the rest carry the detail. One idea per "
            "bullet, never two claims stacked. Not a paraphrase of one article. At most one "
            "**bold** anchor per bullet; no headings, no nested bullets."
        )
    )
    source_count: int
    article_count: int
    article_ids: list[int] = Field(description="Catalog ids, strongest write-up first (may be re-ordered)")


class CodexWorthReadingItem(BaseModel):
    """A single standalone worth-reading item."""

    article_id: int
    reason: str = Field(description="One honest sentence on why this stands alone")


class CodexSynthesisOutput(BaseModel):
    """Phase 2 LLM output: the finished digest, with catalog ids not yet resolved."""

    scale_setter: str
    developments: list[CodexDevelopment]
    worth_reading: list[CodexWorthReadingItem]
    closing_line: str


# ================= Persisted payload (ids resolved to EntryListItem) =================


class CodexDevelopmentResolved(BaseModel):
    """A development with catalog ids resolved to full EntryListItem objects."""

    title: str
    """Short headline — framing lives in the synthesis bullets, not here."""
    synthesis: str
    """Markdown — a short `- ` bullet list. Render with a markdown renderer, not as plain text."""
    source_count: int
    article_count: int
    articles: list[EntryListItem] = Field(description="Ordered, index 0 = best write-up")
    hero_image_url: str | None = Field(
        default=None,
        description="Pipeline-selected wide image for the card's hero band; None → text-first card",
    )
    strip_image_urls: list[str] = Field(
        default_factory=list,
        description="Pipeline-selected images for the below-synthesis strip / 2x2 mosaic (hero excluded)",
    )


class CodexWorthReadingResolved(BaseModel):
    """A worth-reading item with its catalog id resolved to a full EntryListItem."""

    article: EntryListItem
    reason: str


class CodexDigestStats(BaseModel):
    """Derived counters shown in the UI — computed in the pipeline, not by the LLM."""

    minutes_condensed: int = Field(
        description="Estimated reading time of the Development source articles Codex folded in"
    )
    articles_condensed: int = Field(description="How many Development write-ups that time is spread across")
    minutes_capped: bool = Field(
        default=False,
        description="True when minutes_condensed hit CODEX_MAX_MINUTES_CONDENSED — render as '~N+ min'",
    )


class CodexDigestPayload(BaseModel):
    """The self-contained, persisted digest payload (Phase 2 output + resolved articles)."""

    headline: str = ""
    """Short front-page headline — the digest <h1>. Empty on pre-headline digests (fall back to gist)."""
    gist: str
    scale_setter: str
    developments: list[CodexDevelopmentResolved]
    worth_reading: list[CodexWorthReadingResolved]
    closing_line: str
    themes: list[str] = Field(default_factory=list, description="Phase 1 'today's keywords' tags")
    stats: CodexDigestStats | None = Field(
        default=None, description="Null on quiet days (nothing condensed) and on pre-stats digests"
    )


# ================= HTTP requests / responses =================


class CodexGenerateRequest(BaseModel):
    """POST /codex/generate body. All fields optional - an empty body falls back to UTC."""

    local_date: date | None = Field(
        default=None,
        description=(
            "The caller's local calendar day (e.g. from `new Date()` client-side). Used only "
            "as the digest's display label ('which day's news is this'); it does NOT affect "
            "the quota, which is a server-clock rolling window. Clamped server-side to "
            "+/-1 day of UTC today."
        ),
    )


class CodexDigestResponse(BaseModel):
    """GET /codex/today response - the latest digest edition for the user, any status."""

    model_config = response_config

    id: UUID
    digest_date: date
    edition: int = 1
    status: CodexDigestStatus
    progress_phase: CodexDigestPhase | None = None
    requested_at: datetime
    generated_at: datetime | None = None
    model: str | None = None
    window_hours: int | None = None
    input_article_count: int | None = None
    input_source_count: int | None = None
    clusters_found: int | None = None
    payload: CodexDigestPayload | None = None
    error: str | None = None


class CodexGenerateResponse(CodexDigestResponse):
    """POST /codex/generate response - same shape as CodexDigestResponse."""


class CodexNotEntitledResponse(BaseModel):
    """Returned instead of a 202 when the user has hit their quota, or AI is disabled."""

    entitled: bool = False
    reason: str
    error_code: str


class CodexPreferencesResponse(BaseModel):
    """GET/PUT /codex/preferences response - the user's digest knobs."""

    model_config = response_config

    excluded_folder_ids: list[UUID] = Field(
        default_factory=list,
        description="Folder ids whose feeds are left out of the daily digest. Empty = every folder is included.",
    )


class CodexPreferencesUpdate(BaseModel):
    """PUT /codex/preferences body. Replaces the excluded-folder set wholesale."""

    excluded_folder_ids: list[UUID] = Field(
        default_factory=list,
        description="The full set of folder ids to exclude. Ids not belonging to the caller are rejected.",
    )
