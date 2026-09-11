# Codex Digest Pipeline — Technical Design (v1 / MLP)

**Status:** Draft for build · **Owner:** Abhay · **Date:** 2026-09-09
**Companion to:** the PRD _"Readspace Codex — Product Requirements."_
**Rendered version:** https://claude.ai/code/artifact/1a2c3854-5bc3-46d8-8b66-bfab077872c6

Codex answers one question — _"what did I miss?"_ — for a reader who follows more sources
than any feed view can still make sense of. This document specifies the **generation
pipeline only**: how a `user_id` becomes one stored `codex_digests` row. Continuity
(day-over-day memory) is a future phase, not v1.

---

## 1. What ships

Two layers:

- **Developments** (the product) — articles from several of the reader's sources covering the
  same event, compressed into one synthesized entry that carries its own provenance
  (`12 articles · 8 sources`) and expands to the five best write-ups, strongest first.
  When _nothing_ clusters (≥2 sources) but a genuine top story ran, Phase 1 may promote that
  lone story to a `source_count: 1` development so the main column isn't empty on a
  low-overlap day. This is editorial, not wire-news-only: a landmark essay or a defining
  analysis piece can lead on a quiet news day. Reserved for stories that clearly warrant the
  lead — not quiet-day padding.
- **Worth Reading** (bonus strip) — 2–6 standalone runner-up reads: the next most valuable
  pieces after the Developments, decisively above the rest of the reader's feed, that just
  missed the main column.

A story has exactly one home — it is either a Development or a Worth Reading entry, never both
(Worth Reading only draws from content outside every development).

### Locked decisions

| Decision      | Value                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| Ingest window | 24h, fixed for v1                                                            |
| Ingest cap    | 1000 articles                                                                |
| LLM calls     | 2 (Gemini, existing provider)                                                |
| Execution     | On-demand only — no cron, no fan-out                                         |
| Access        | Metered per user: **Basic 3 / calendar month, Pro 1 / day, Admin unlimited** |
| Continuity    | Future phase (§16)                                                           |

---

## 2. Pipeline at a glance

```
 user_id
   │
   ▼
┌──────────┐   ┌───────────────┐   ┌──────────────┐   ┌────────────┐   ┌────────┐
│ PHASE 0  │──▶│ PHASE 1 · LLM │──▶│  PHASE 1.5   │──▶│ PHASE 2·LLM│──▶│ OUTPUT │
│ Gather   │   │ Triage &      │   │ Fetch full   │   │ Synthesise │   │ digest │
│ dedupe   │   │ cluster       │   │ text (~19)   │   │            │   │ 1 row  │
│ cap      │   │ ~100K in      │   │              │   │ ~65K in    │   │        │
└──────────┘   └───────┬───────┘   └──────▲───────┘   │ ~8K out    │   └────────┘
                       │                  │           └────────────┘
                       └─ clusters choose which texts to fetch ─┘
```

The two calls are not work split in half. **Phase 1 sees everything at low fidelity**
(title + snippet) and decides what matters. **Phase 2 sees only the chosen few at full
fidelity** (extracted body text) and does the editorial writing. You cannot know which
article bodies to fetch until something has clustered — that is the whole reason there are two.

---

## 3. Phase 0 — Gather & pre-process (no LLM)

### Reuse `get_articles`

The candidate set is exactly what the web "All" / "Today" lists show, so Phase 0 calls
`get_articles` (`server/app/crud/article/reader.py`) **directly from the worker** — not through
the router, which would apply the Basic-tier 2h `get_sync_cutoff()` cap. The digest sees the
full 24h regardless of tier.

```python
rows, cursor = [], None
while len(rows) < CODEX_MAX_ARTICLES:
    page = await get_articles(
        db, user_id,
        CursorPaginationParams(limit=200, cursor=cursor),   # MAX_CURSOR_LIMIT
        published_since=now - timedelta(hours=CODEX_INGEST_WINDOW_HOURS),
        published_until=now,
        load_full_content=False,          # title + 300-char description only
    )
    rows += page.items
    if not page.has_more:
        break
    cursor = page.next_cursor
```

Each row already carries the `EntryListItem` shape the frontend consumes
(`id, title, link, description, author, feed_id, feed_title, feed_icon, image_url,
source_domain, published_at, tags` + read/saved state). Keep them in a
`dict[int, EntryListItem]` keyed by catalog id for later resolution.

### Cap and dedupe in Python (cheap at ≤1000 rows, avoids new SQL)

- **Per-feed cap** — keep ≤ `CODEX_MAX_PER_FEED` (30) most-recent per `feed_id`.
  (A window-function version already exists: `fetch_recent_article_texts_for_feeds`.)
- **Title dedupe** — normalise (lowercase, collapse whitespace, strip surrounding
  punctuation), drop exact matches. Identical-URL copies are already merged upstream at
  `ArticleContent.content_hash`; this catches syndicated reprints under different URLs. Keep
  the earliest-published copy; remember the sibling count.
- **Unread bias** — drop rows already marked read.
- **Global cap** — truncate to the `CODEX_MAX_ARTICLES` (1000) most recent survivors.

### Build the catalog

```python
{ "id": 1,
  "source": "Stratechery",                 # feed_title (custom_title wins)
  "age": "2h",                             # relative to now
  "title": "The inference cost curve",
  "snippet": "Ben Thompson on why per-token prices keep …" }  # description[:CODEX_SNIPPET_CHAR_CAP]
```

**Output:** catalog (≤1000 rows) + `{total_articles, total_sources}`.

---

## 4. Phase 1 — Triage & cluster (LLM, smart model)

One call. Big input (whole catalog as TOON), small structured output.

### Input

- Catalog as TOON — uniform table of `{id, source, age, title, snippet}`, ~100K tokens for a
  full 1000-row day.
- The two counts.
- System prompt `get_codex_triage_system_prompt()`: act as the reader's section editor over a
  catalog that is often _not_ a newswire. Build the developments in priority order —
  (1) multi-source clusters (≥2 articles from ≥2 distinct sources), ranked by distinct source
  count; (2) a single high-priority story as a `source_count: 1` development when nothing
  clustered around it and it clearly warrants the lead; (3) a standout long-form piece as a
  single-source development on a quiet news day. Order each development's `article_ids`
  strongest-write-up-first. `worth_reading_ids` is the runner-up tier — best standalone reads
  after the developments, _not_ in any development, best-first. Write a short `headline` + a
  1–2 sentence `gist`; be honest about a quiet day and never manufacture a front-page tone.
  `themes` is `[]` unless a topic genuinely recurred across multiple pieces.

### Output — `CodexTriageOutput` via `response.parsed`

```json
{
  "gist": "A heavy day for AI infrastructure — three separate stories on inference cost, a model release, and a datacenter financing round. Quiet elsewhere.",
  "clusters": [
    {
      "label": "Anthropic ships Claude Opus 4.5 with a 1M-token context window",
      "article_ids": [45, 12, 89, 7, 30, 61],
      "source_count": 8,
      "article_count": 12
    },
    {
      "label": "CoreWeave raises a $9B debt facility for GPU buildout",
      "article_ids": [22, 5, 71],
      "source_count": 5,
      "article_count": 6
    },
    {
      "label": "Stratechery's teardown of the new inference cost curve",
      "article_ids": [3],
      "source_count": 1,
      "article_count": 1
    }
  ],
  "worth_reading_ids": [213, 77, 140]
}
```

The third entry is the single-source case: nothing else covered it, but it's a genuine lead,
so it's a development rather than a Worth Reading item.

Backend then trims to the top `CODEX_MAX_DEVELOPMENTS` (5) developments by `source_count`
(single-source ones naturally sort last), keeps `len(clusters)` as `clusters_found` for the
closing line ("31 developments found, 3 shown"), and caps `worth_reading_ids` at
`CODEX_MAX_WORTH_READING` (4), or `CODEX_MAX_WORTH_READING_FALLBACK` (6) only when the
developments list came back empty.

---

## 5. Phase 1.5 — Full-text fetch (no LLM, bounded I/O)

Readspace never stores extracted article bodies — `ArticleContent.content` holds only the
feed's own HTML, often a truncated summary. So the "give the model the real text" step must
fetch it.

For the top `CODEX_MAX_ARTICLES_PER_DEVELOPMENT_FULLTEXT` (3) ids of each surviving cluster +
every worth-reading id (~19 articles), call the existing
`extract_full_content(url, title, image_url)` (`server/app/services/articles/scrape.py`) —
already Trafilatura on a thread, 5s timeout, `nh3`-sanitised.

- Run under `asyncio.Semaphore(CODEX_FULLTEXT_FETCH_CONCURRENCY)` — 6.
- On failure/timeout fall back to `ArticleContent.content`, then `description`.
- Truncate each body to `CODEX_FULLTEXT_CHAR_CAP` (12000 chars).

---

## 6. Phase 2 — Synthesis (LLM, smart model)

One call. Full text of chosen articles in, finished digest out.

### Input

JSON framing (nested and small, so not TOON). Per surviving cluster: label, source/article
counts, full/fallback body of its top 3 articles with source names. Per worth-reading item:
full body + source. System prompt `get_codex_synthesis_system_prompt()`: per development write
a 2–4 sentence synthesis that compresses the **through-line** across sources (agreement,
divergence, what's genuinely new) — never a paraphrase of one article; re-order `article_ids`
strongest-first if the full text changes your mind, capped at
`CODEX_MAX_ARTICLES_PER_DEVELOPMENT_DISPLAY` (5); per worth-reading item one honest sentence
on why it stands alone; write the scale-setter and closing line; never inflate a quiet day.

### Output — `CodexSynthesisOutput`

```json
{
  "scale_setter": "143 new pieces from 31 sources — a busy day for AI infrastructure, quiet everywhere else.",
  "developments": [
    {
      "title": "Anthropic ships Claude Opus 4.5 with a 1M-token context window",
      "synthesis": "Opus 4.5 lands with a 1M-token window and lower per-token pricing than 4.1. TechCrunch and The Information both read it as a direct answer to Gemini's long-context lead; Simon Willison's hands-on says recall past ~400K tokens is still uneven. No independent benchmarks yet.",
      "source_count": 8,
      "article_count": 12,
      "article_ids": [45, 12, 89, 7, 30]
    }
  ],
  "worth_reading": [
    {
      "article_id": 213,
      "reason": "The only source on this, and an unusually thorough teardown of the new pricing math."
    }
  ],
  "closing_line": "31 developments found, 3 shown above — 143 pieces total, still in your reader."
}
```

Before persisting, the backend resolves every `article_id` back to its stored `EntryListItem`.
The saved `payload` is then self-contained: `developments[].articles` is an ordered
`EntryListItem[]` (index 0 = best write-up), `worth_reading[].article` is a single
`EntryListItem` + its `reason`. Both frontends render these with the existing `ArticleListItem`
component.

---

## 7. Why two calls — not one, or four

| Shape        | Why not                                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 call**   | Can't choose which bodies to fetch until something clustered; real compression + picking the best write-up needs body text, not a 280-char snippet. A one-shot digest is a digest of summaries.          |
| **2 calls**  | **Chosen.** Phase 1 decides what matters over the whole day at low fidelity; Phase 2 writes over the chosen few at full fidelity. One job per prompt → promptable and testable.                          |
| **3+ calls** | A pre-filter pass is tempting but 1000 snippet rows (~100K TOON tokens) fit a 1M-context model. Premature. Kept as an _optional_ Phase 0.5 on the fast model, only if catalogs routinely exceed the cap. |

**Design principle — let the long context do the work.** No embeddings, no vector store, no
similarity pre-clustering. The problem is not retrieval; it is context budgeting.

---

## 8. Serialization — TOON in, JSON out

[TOON](https://toonformat.dev/) declares field names once then streams rows — exactly the
Phase 1 catalog (uniform array of flat records). ~50% fewer tokens than pretty JSON, ~30% vs
minified. Tabular, not nested, so TOON's deep-structure mis-parse risk doesn't apply.

```
articles[943]{id,source,age,title,snippet}:
  1,Stratechery,2h,"The inference cost curve","Ben Thompson on why per-token …"
  2,Hacker News,1h,"CoreWeave raises $9B","Debt facility and what it signals …"
  …
counts{total_articles,total_sources}: 943,27
```

Everything else stays JSON: Phase 1/2 outputs use schema-constrained decoding (JSON only,
small); the Phase 2 input framing is nested per-cluster. The catalog renderer is one swappable
function (`render_catalog_toon`) with a minified-JSON fallback behind a constant.

---

## 9. Model & call mechanics

New module `server/app/services/ai/codex.py`, beside `service.py` (per-article) and `batch.py`
(Vertex batch). Both Codex calls use `GEMINI_SMART_MODEL` through the **async** client and the
official [structured-output](https://ai.google.dev/gemini-api/docs/structured-output) feature —
never a "return only JSON" instruction.

```python
resp = await client.aio.models.generate_content(
    model=settings.GEMINI_SMART_MODEL,
    contents=triage_prompt,                     # TOON catalog + counts
    config=types.GenerateContentConfig(
        system_instruction=get_codex_triage_system_prompt(),
        response_mime_type="application/json",
        response_schema=CodexTriageOutput,         # Pydantic class, kept shallow
        temperature=0.3,
    ),
)
triage: CodexTriageOutput = resp.parsed           # fallback: json.loads(resp.text) + model_validate
```

- Pass the Pydantic class directly as `response_schema`; read `resp.parsed`. Don't repeat the
  schema in the prompt.
- Keep `CodexTriageOutput` / `CodexSynthesisOutput` **shallow** — Gemini's supported
  JSON-schema subset is limited, deeply nested schemas are rejected. Use `$defs`/`$ref` for
  shared sub-objects; avoid large enums.
- Wrap each call in `tenacity` retry (already a dependency, unused) — 2 attempts, exp backoff.
- Guard on `settings.ENABLE_AI` **and** a new `settings.ENABLE_CODEX` (default `False`),
  returning a no-op like `batch_enrich_feeds`, so `--dev` runs don't break.

`batch.py` uses the REST `responseJsonSchema` variant because it's the Batch API; ours uses
the SDK `response_schema` variant — same feature, different surface.

---

## 10. Caps & constants

New `# Codex Digest` block in `server/app/core/constants.py`, next to the `MAX_AI_*` group.

| Constant                                      | Value | Purpose                                              |
| --------------------------------------------- | ----- | ---------------------------------------------------- |
| `CODEX_INGEST_WINDOW_HOURS`                   | 24    | Fixed window for v1                                  |
| `CODEX_MAX_ARTICLES`                          | 1000  | Phase 1 catalog cap — cost/context safety valve      |
| `CODEX_MAX_PER_FEED`                          | 30    | Stops one hyperactive feed dominating                |
| `CODEX_MAX_DEVELOPMENTS`                      | 5     | Clusters synthesised & shown (model may _find_ more) |
| `CODEX_MAX_ARTICLES_PER_DEVELOPMENT_FULLTEXT` | 3     | Bodies fetched per cluster for Phase 2               |
| `CODEX_MAX_ARTICLES_PER_DEVELOPMENT_DISPLAY`  | 5     | Article refs shown under a Development card          |
| `CODEX_MAX_WORTH_READING`                     | 4     | Standalone strip size                                |
| `CODEX_FULLTEXT_CHAR_CAP`                     | 12000 | Per-article body truncation for Phase 2              |
| `CODEX_FULLTEXT_FETCH_CONCURRENCY`            | 6     | `asyncio.Semaphore` bound on Phase 1.5               |
| `CODEX_SNIPPET_CHAR_CAP`                      | 280   | Phase 1 snippet length                               |

**Budget per digest:** 2 flash-tier calls; ~100K tokens into Phase 1, ~65K into Phase 2, ~8K
out total. Cost-model against current Gemini flash pricing before launch — should land well
under a cent per digest, but confirm.

Also new: `server/app/core/config.py` → `ENABLE_CODEX: bool = False`.

---

## 11. Persistence — `codex_digests`

New model `server/app/models/codex.py` + Alembic migration. One row per user per UTC day.

| Column                                                          | Notes                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                            | uuid, pk                                                                                                                                                                                                                                                  |
| `user_id`                                                       | uuid, fk `profiles(id)` on delete cascade                                                                                                                                                                                                                 |
| `digest_date`                                                   | date — UTC day covered; `UNIQUE (user_id, digest_date)`                                                                                                                                                                                                   |
| `status`                                                        | reuse `app.typing.common.ImportStatus` (`PENDING/IN_PROGRESS/COMPLETED/FAILED/CANCELLED/UNKNOWN` — already generic); rename it `TaskStatus` with `ImportStatus` kept as a deprecated alias. Fallback: dedicated `CodexDigestStatus` in `models/enums.py`. |
| `requested_at` / `generated_at`                                 | timestamptz                                                                                                                                                                                                                                               |
| `model` / `window_hours`                                        | provenance                                                                                                                                                                                                                                                |
| `input_article_count` / `input_source_count` / `clusters_found` | int — feed the scale-setter, closing line, audit                                                                                                                                                                                                          |
| `payload`                                                       | jsonb — Phase 2 output with every id resolved to `EntryListItem`                                                                                                                                                                                          |
| `error`                                                         | text, on failure                                                                                                                                                                                                                                          |
| `created_at` / `updated_at`                                     | timestamptz                                                                                                                                                                                                                                               |

CRUD `server/app/crud/codex.py`: `get_digest_for_date`, `create_pending_digest`,
`finalize_digest(status, payload|error)`, `count_ready_digests_in_month`, `has_digest_for_day`.

---

## 12. Entitlements — `enforce_codex_quota(db, profile)`

Metered per user, not tier-gated, not from the shared `ai_usage` counter. Enforcement is a DB
row count — exact, durable, mirrors `enforce_subscription_limit`. Numbers in a new
`CODEX_LIMITS` map in `server/app/core/resource_limits.py`.

| Role      | Rule                                                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN`   | Always allowed.                                                                                                                               |
| `PRO`     | Allowed if no `COMPLETED/PENDING/IN_PROGRESS` row for `(user_id, today_utc)`. A repeat request the same day returns the existing row → 1/day. |
| `BASIC`   | Allowed if `count_ready_digests_in_month(user_id) < 3`. Only `COMPLETED` rows count — `SKIPPED`/`FAILED` never burn an allowance.             |
| otherwise | `raise ResourceLimitError("CODEX_LIMIT_EXCEEDED")` — Pro → daily reset, Basic → upgrade.                                                      |

Extend `get_user_limits_and_usage` + `UserLimitsResponse` with the Codex allowance so both
clients can show "2 of 3 digests left this month" / "next digest tomorrow".

---

## 13. Execution & task management

**On-demand only.** No cron, no fan-out in v1. Shape mirrors OPML import — enqueue, poll,
render per status.

- `POST /api/codex/generate` (auth): `enforce_codex_quota` → if `PENDING/IN_PROGRESS` row for
  today exists, return it (double-click dedupe) → if `COMPLETED` row for today exists, return
  it (no re-spend) → else `create_pending_digest`, `await generate_codex_digest_task.kiq(user_id)`,
  return the row. Mirrors OPML `POST /import/` → `202` + task handle.
- `server/app/workers/codex_tasks.py` — thin
  `@broker.task(task_name="codex_tasks.generate_codex_digest", retry_on_error=True, max_retries=1, timeout=300)`
  wrapper → `ensure_uuid` → `services/codex/pipeline.py::generate_digest_for_user`. Register in
  `workers/registry.py`. Reuses `worker_db` / `worker_db_factory` / `ensure_uuid` exactly like
  `opml_tasks.py`. Short DB sessions for gather + finalize; LLM/fetch work outside any
  transaction. On exception → `finalize_digest(FAILED, error=…)` then re-raise for the one
  retry. Phase 0 yields 0 articles → `finalize_digest(SKIPPED)`, no LLM spend, no quota.
- `GET /api/codex/today` (auth) → latest row for the user, any status. Frontend polls with the
  **exact `refetchInterval` pattern from `useImportTaskStatus`**: `false` on
  `completed/failed/skipped`, else `3000`ms.
- `server/scripts/trigger_task.py` — add `codex-generate <user_id>` for manual runs.

**Deliberately NOT reused from OPML:** the `OpmlImportTracker` Redis tracker and the
`TaskRepository` ownership map. OPML needs them because an import has no durable home row and
fans out to N per-feed subtasks aggregated in Redis. A digest has a durable home
(`codex_digests`, unique per user per day) and is a single task — so the `status` column _is_
the progress state and the auth-scoped endpoint gives ownership for free. A generic
`SimpleTaskTracker` is worth extracting later if sub-step progress
("clustering… synthesising…") is ever wanted — OPML could adopt it then too.

### API schemas — `server/app/typing/codex.py`

LLM I/O (kept shallow for `response_schema`): `CodexTriageOutput`, `CodexCluster`,
`CodexSynthesisOutput`, `CodexDevelopment`, `CodexWorthReadingItem`.
HTTP: `CodexDigestResponse` (`status` + resolved `payload` with
`developments[].articles: EntryListItem[]`, `worth_reading[].article: EntryListItem`),
`CodexGenerateResponse`. Router `server/app/routers/codex.py`, included in
`server/app/routers/__init__.py` with prefix `/codex`.

---

## 14. Surfaces

| Client | Where                               | Treatment                                                                                                                                                                                                                                                                                              |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| web    | `SidebarMain.tsx` → `mainNavItems`  | **Codex**, `Sparkles` icon, first item — above "Today".                                                                                                                                                                                                                                                |
| mobile | `header-tabs.tsx` → `buttonConfigs` | **Daily Digest**, existing `Sparkle` SVG, 4th segment — after "Saved". "Saved" is a header segment on the Following screen (not a bottom tab); that screen branches to render `<CodexView>` when the segment is active. Alternative: a real 4th bottom tab if the digest view feels too unlike a list. |

Both clients share one hook (`packages/shared/src/api/hooks/use-codex.ts`) and one fixture
(`fixtures/codex.ts → SAMPLE_CODEX_DIGEST`, typed as the real response). Presentational
components: `CodexView` (takes a `digest` prop — used by both the live route and the mock),
`ScaleSetter`, `DevelopmentCard` (synthesis + `12 articles · 8 sources` provenance +
expandable `ArticleListItem` list, index 0 styled as best write-up), `WorthReadingStrip`,
`ClosingLine`, + empty / generating / quiet-day / not-entitled states. Finite by construction:
hard caps, no infinite scroll, a visible end.

**Mock, shipping now:** web `app/(protected)/codex/preview/page.tsx` renders
`<CodexView digest={SAMPLE_CODEX_DIGEST} />` with zero network; the mobile preview screen does
the same. The live hook-driven route is scaffolded but may land in a follow-up.

**Gating:** web via `useUserRole()` + the Codex allowance from `/users/limits`; mobile via
`useRevenueCat().isPro` + `useLimitChecker()` extended with `canUseCodex()` /
`checkAndTriggerUpgrade('codex')`. Per `apps/mobile/CLAUDE.md` §17, the paywall wiring gets
human review.

---

## 15. Failure modes

| Condition                                                         | Behaviour                                                                                                                                                                  |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zero candidate articles                                           | `SKIPPED`, quiet-day state, no spend, no allowance consumed.                                                                                                               |
| Phase 1 finds no multi-source cluster but a genuine top story ran | That story leads as a `source_count: 1` development; Worth Reading cap stays at 4.                                                                                         |
| Phase 1 finds no cluster _and_ no story worth leading             | `clusters` empty, everything flows to Worth Reading (cap raised to `CODEX_MAX_WORTH_READING_FALLBACK` ≈ 6), Developments empty with an honest headline/gist, `themes: []`. |
| A cluster's top article won't extract                             | Fall back to feed HTML, then `description`. If every fetch in a cluster fails, synthesise from snippets and tell the prompt confidence is lower.                           |
| Malformed model output after retries                              | `FAILED`, error stored, one task retry, then a "couldn't build your digest, try again" state that does _not_ consume the allowance.                                        |
| `ENABLE_AI` / `ENABLE_CODEX` false                                | Endpoint returns a disabled response; task no-ops.                                                                                                                         |
| Prompt injection in article text                                  | Outputs are plain text rendered as text — no model HTML passthrough. Article HTML already `nh3`-sanitised by `extract_full_content`.                                       |

---

## 16. Future phases (not built)

1. **Cron fan-out** — scheduled morning generation for active users once open rates justify
   the compute. Needs `get_users_for_codex` + a per-user `timezone` column or bucketed crons.
   Shape = `schedule_all_feeds`: a `schedule=[{"cron": …}]` wrapper selects rows, loops `.kiq`.
2. **Continuity** — the most compelling extension. Persist cluster labels + a fingerprint per
   digest; on the next run, match today's clusters against the last few days (title similarity
   or a tiny fast-model call) and feed the matched prior synthesis into Phase 2 for
   "developing — previously reported, here's what changed" framing. `codex_digests.payload`
   already retains what's needed; add `codex_digest_clusters` or index into the JSONB. Tracks
   the state of the topics, not the user — philosophically clean.
3. **Sub-step progress** — extract the generic `SimpleTaskTracker`, migrate OPML onto it.
4. Optional Phase 0.5 junk-filter pass; per-section scheduling; email delivery.

---

## 17. File inventory

### New — server

`server/docs/codex-digest-design.md` · `models/codex.py` · `typing/codex.py` ·
`services/ai/codex.py` · `services/codex/{pipeline.py, gather.py}` · `crud/codex.py` ·
`routers/codex.py` · `workers/codex_tasks.py` · `alembic/versions/*_add_codex_digests.py` ·
prompt builders in `services/ai/prompts.py` · `tests/unit/test_codex_{gather,parsing}.py` ·
`tests/integration/test_codex.py`

### New — JS

`packages/shared/src/api/{endpoints,hooks,types}/codex.ts` ·
`packages/shared/src/api/fixtures/codex.ts` ·
`apps/web/app/(protected)/codex/{page.tsx, client.tsx, preview/page.tsx}` ·
`apps/web/components/features/codex/*` ·
`apps/mobile/src/app/(protected)/codex-preview/index.tsx` ·
`apps/mobile/src/components/screens/{codex, codex-preview}/*`

### Touched — server

`core/constants.py` · `core/config.py` · `core/resource_limits.py` ·
`typing/common.py` (`ImportStatus` → `TaskStatus` alias) ·
`services/user/resource_limits.py` · `workers/registry.py` · `routers/__init__.py` ·
`routers/users.py` + `typing/user.py` · `scripts/trigger_task.py`

### Touched — JS

`packages/shared/src/api/{query-keys.ts, core.ts, index.ts, hooks/index.ts, types/index.ts}` ·
`apps/web/components/features/navigation/SidebarMain.tsx` ·
`apps/mobile/src/components/navigation/header/ui/header-tabs.tsx` ·
`apps/mobile/src/stores/following.ts` ·
`apps/mobile/src/components/screens/following/index.tsx` ·
`apps/mobile/src/hooks/useLimitChecker.ts`

---

## 18. Verification

1. **Mock UI** — `bun run --filter web dev` → `/codex/preview` renders the sample digest with
   working expand/collapse, light + dark, no network calls. Mobile preview screen renders the
   same fixture. `turbo run check-types lint` clean for touched JS.
2. **Traceability** — every PRD requirement maps to a stage: Developments (Phase 1 cluster +
   Phase 2 synthesis + expandable article list, best first), Worth Reading (Phase 1
   `worth_reading_ids`, non-overlapping by construction), scale-setter + closing line (Phase 2
   - `clusters_found`), visible provenance (`source_count`/`article_count`), finite output.
3. **Backend end-to-end** — `poe trigger codex-generate <user_id>` → inspect the
   `codex_digests` row; `GET /api/codex/today` with a Pro token returns the payload;
   `poe test-integration -k codex`.
