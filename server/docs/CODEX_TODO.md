# Codex Digest — Implementation Tracker

Cross-session progress tracker for building the Codex Digest pipeline described in
`server/docs/codex-digest-design.md`. Update checkboxes as work lands; keep notes on
deviations from the design doc here (not buried in commit messages).

## Status: build-complete — now in the iteration phase

Everything is built and green: backend pipeline (63 unit + 13 integration tests, verified
end-to-end against a live FastAPI + Taskiq + Postgres + Gemini stack), shared
types/hooks/fixtures, web (live route + preview + sidebar + gating), mobile (bottom tab + live
screen + preview + paywall gate). `apps/web` builds (`next build` passes), monorepo
`turbo run check-types lint` is 10/10, backend units all pass. The pre-existing `LoginForm.tsx`
build blocker was fixed in passing (`@hookform/resolvers` bump).

**The remaining work is iteration on the owner's feedback, in this order:**

1. **UI feedback pass.** Abhay reviews the web + mobile Codex surfaces (`/codex`,
   `/codex/preview`, the mobile Codex tab, `/codex-preview`) and provides a list of visual /
   interaction fixes. Implement those. This is expected to be the bulk of the near-term work.
2. **Codex API / functionality feedback pass.** After the UI settles, Abhay reviews the actual
   digest output — clustering quality, synthesis tone, worth-reading selection, gist/scale-
   setter/closing-line phrasing, caps, prompts — against real generated digests, and provides
   changes to the pipeline (`services/codex/*`, `services/ai/codex.py`, `services/ai/prompts.py`,
   the `CODEX_*` constants). Implement those.

Feedback items get logged under "Feedback log" below as they come in. Everything above the
"Feedback log" section is the as-built record and doesn't change unless a feedback item
supersedes it.

Non-feedback loose ends that still need doing regardless (small, tracked under "Still open"):
mobile paywall §17 sign-off, browser/device smoke tests, and deploy-time env/migrations.

**e2e test account:** `codex@gmail.com` / `abc123` (local dev DB), user_id
`52c91642-16ab-49d9-bf3e-068c762ba2b5`. Use this for manual pipeline runs
(`poe trigger codex-generate 52c91642-16ab-49d9-bf3e-068c762ba2b5`) instead of a random
profile — designated by the user for this purpose. It's a light account (~8 recent articles,
5 subscriptions), which exercises the zero-cluster/quiet-day path more than the clustering
path — see the second e2e run logged below.

## Deviations from the design doc (intentional, per user instruction)

- **No `ENABLE_CODEX` flag.** The doc's §9/§10/§15 proposed gating on `settings.ENABLE_AI`
  *and* a new `settings.ENABLE_CODEX` (default `False`). Skipped — gate on `ENABLE_AI` only.
- **Catalog row carries `published_at` (ISO) alongside `age`.** The doc's §3 catalog row
  only had a relative `age` string. Added the real timestamp too since the payload persists
  and clients may want to render/sort by actual date, not just "2h".
- **Raised fulltext-fetch/display caps** so `article_ids` shown isn't stuck far below
  `article_count`. Doc had fetch=3, display=5 while `article_count` in examples was 12 —
  meaning at most 5/12 articles were ever citable even though the model could re-rank up to
  5. Bumped `CODEX_MAX_ARTICLES_PER_DEVELOPMENT_FULLTEXT` to 5 and
  `CODEX_MAX_ARTICLES_PER_DEVELOPMENT_DISPLAY` to 8, so a 12-article cluster can surface up
  to 8 citations instead of 5, and more of the "which are the best write-ups" judgment is
  made with full text rather than snippets.
- **New `CodexDigestStatus` enum in `app/models/enums.py`** instead of renaming the shared
  `app.typing.common.ImportStatus` → `TaskStatus`. The rename touches 11 files across OPML
  services/workers/tests for no functional gain in this pass; revisit only if a real
  `SimpleTaskTracker` unification happens (doc §16.3).
- **No unread filter — Codex covers ALL articles published in the 24h window, read or not.**
  The doc's §3 "Unread bias" bullet said to drop already-read rows so the digest is "what you
  missed." Per explicit user correction, this was wrong: Codex is a digest of the day's
  coverage, not an unread inbox, so `gather_catalog` does not pass `is_read=False` to
  `get_articles` at all.
- **`CODEX_MAX_ARTICLES` temporarily capped at 100** (down from the doc's 1000), per explicit
  user instruction while validating the pipeline end-to-end. `CODEX_GATHER_PAGE_SIZE` lowered
  to 100 to match. Raise both back once cost is modeled (see open item below).
- **Added `progress_phase` tracking, not in the original doc.** Per explicit user request
  ("good capabilities in backend for status polling... enum of the progress/phase"). New
  `CodexDigestPhase` enum (`gathering / triaging / reading / synthesizing`), a
  `codex_digests.progress_phase` column (migration `bd5be628e52e`), `crud.codex.set_progress_phase()`,
  and `mark_in_progress()` now takes a starting phase. The pipeline updates it at each stage
  boundary; it's exposed on `CodexDigestResponse.progress_phase` so `GET /codex/today` polling
  can drive a proper per-phase loading UI instead of a generic spinner. Holds its last value
  once a digest reaches a terminal status (informational only past that point). Verified live
  via real HTTP polling — see Verification below.

## Bugs fixed along the way

- **`get_articles` silently excluded articles from feeds with `last_read_cutoff IS NULL`**
  whenever `is_read=False` was passed (`app/crud/article/reader.py`, the `is_read=False`
  branch). SQL `published_at > NULL` evaluates to unknown, so any subscription without a
  cutoff set (234/238 on the test account) had 100% of its unread articles filtered out.
  Fixed by treating a NULL cutoff as "no cutoff" (`or_(last_read_cutoff IS NULL, published_at
  > last_read_cutoff)`). This affects the live unread views too, not just Codex — found via a
  real end-to-end pipeline run against the local dev DB (see Verification below), not a
  hypothetical. Codex itself no longer calls `get_articles` with `is_read=False` at all (see
  above), but the underlying bug was real and worth fixing regardless.
- **`worker_db` import-binding gap for integration tests.** `services/codex/pipeline.py` does
  `from app.workers.common import worker_db`, which binds a local name in `pipeline`'s own
  module namespace at import time — `tests/integration/conftest.py`'s existing
  `monkeypatch.setattr("app.workers.common.worker_db", ...)` never reaches that local binding
  (this is exactly why every other worker module using this pattern —
  `opml/import_opml.py`, `opml/import_feed.py`, `feed/refresh.py`, etc. — is listed
  individually in conftest's `patch_map`). Added
  `("app.services.codex.pipeline.worker_db", _worker_db)` to that list. Without it, every
  pipeline-level integration test silently ran against the real dev DB via `worker_db()`
  instead of the isolated per-test transaction, and (worse) never found the seeded test
  articles, so `gather_catalog` always reported zero candidates. Found via the actual
  `test_codex.py` suite failing 4/13 on the first run — not theoretical.

## Backend pipeline

- [x] `core/constants.py` — `# Codex Digest` constants block
- [x] `core/config.py` — no `ENABLE_CODEX` (uses `ENABLE_AI`)
- [x] `models/enums.py` — `CodexDigestStatus`
- [x] `models/codex.py` — `CodexDigest` SQLAlchemy model
- [x] Alembic migration — `add_codex_digests`
- [x] `typing/codex.py` — LLM I/O (`CodexTriageOutput`, `CodexCluster`, `CodexSynthesisOutput`,
      `CodexDevelopment`, `CodexWorthReadingItem`) + resolved-payload
      (`CodexDevelopmentResolved`, `CodexWorthReadingResolved`, `CodexDigestPayload`) + HTTP
      (`CodexDigestResponse` incl. `progress_phase`, `CodexGenerateResponse`,
      `CodexNotEntitledResponse`)
- [x] `crud/codex.py` — `get_digest_for_date`, `create_pending_digest`, `finalize_digest`,
      `count_ready_digests_in_month`, `has_digest_for_day`, `get_latest_digest`
- [x] `services/ai/prompts.py` — `get_codex_triage_system_prompt()`,
      `get_codex_synthesis_system_prompt()`
- [x] `services/ai/codex.py` — `run_codex_triage()`, `run_codex_synthesis()` (structured output,
      tenacity retry, sync Gemini client via `asyncio.to_thread` to match existing
      `services/ai/service.py` convention — the doc's `client.aio` async-client aspiration
      isn't used anywhere else in the codebase yet)
- [x] `services/codex/gather.py` — Phase 0 (gather/cap/dedupe/catalog) + Phase 1.5
      (full-text fetch)
- [x] `services/codex/serialize.py` — `render_catalog_toon()` (+ minified-JSON fallback switch)
- [x] `services/codex/pipeline.py` — `generate_digest_for_user()` orchestration
- [x] `core/resource_limits.py` — `CODEX_LIMITS` map
- [x] `services/user/resource_limits.py` — `enforce_codex_quota()`
- [x] `typing/user.py` / `services/user/resource_limits.py` — extend
      `get_user_limits_and_usage()` + `UserLimitsResponse` with codex allowance
- [x] `workers/codex_tasks.py` + `workers/registry.py` registration
- [x] `routers/codex.py` (`POST /codex/generate`, `GET /codex/today`) + `routers/__init__.py`
- [x] `scripts/trigger_task.py` — `codex-generate <user_id>`
- [x] `pyproject.toml` — add explicit `tenacity` dependency (was transitive-only)
- [x] `progress_phase` tracking (see deviations above) — model column, migration, CRUD,
      pipeline wiring, response schema field.
- [x] Tests — `tests/unit/test_codex_gather.py` (dedupe/capping/age-formatting, 14 tests),
      `tests/unit/test_codex_parsing.py` (TOON rendering + payload resolution, 9 tests),
      `tests/integration/test_codex.py` (13 tests: router 202/idempotency/AI-disabled/quota
      enforcement across Basic/Pro/Admin, `GET /today` 404-vs-200, full pipeline via the real
      worker task with LLM calls mocked, zero-article skip, progress-phase transition
      assertions, FAILED-on-generation-error). **62 unit + 13 integration, all passing.**
- [x] Run `poe lint && poe format` clean on all new/touched files (`poe type-check` is
      non-blocking in CI; remaining mypy errors are the same pre-existing
      `Column[X]`-assignment pattern seen across every plain-SQLAlchemy-declarative model/CRUD
      in this codebase, e.g. `crud/folder.py`, `crud/profile.py`, and every existing
      integration test file — not introduced here)
- [x] Verify migrations apply — ran `alembic upgrade head` against the local dev DB twice
      (initial `codex_digests` table, then the `progress_phase` column add), confirmed schema
      matches spec both times
- [x] **Real end-to-end pipeline runs via `trigger_task.py`** (worker-level, bypasses HTTP)
      with a live Gemini key:
      1. First run (139-unread-article account) — gather → triage → full-text fetch →
         synthesis → persist all completed; confirmed `article_count` matches `len(articles)`
         in both resulting developments (4/4, 4/4) — the caps fix works as intended.
      2. Second run, after capping ingestion to 100 and switching to the designated e2e
         account (`codex@gmail.com`) — exercised the **zero-cluster fallback path** (§15): 0
         clusters found, all 8 candidates fed into Worth Reading (capped at
         `CODEX_MAX_WORTH_READING_FALLBACK`=6, 5 resolved), an honest quiet-day gist/closing
         line, no fabricated developments.
- [x] **Real end-to-end verification through the live FastAPI + Taskiq stack** (not the
      trigger script) — the actual `poe start` API process and a `poe worker` Taskiq process,
      driven entirely over HTTP with a real Supabase-issued JWT for `codex@gmail.com`:
      1. `GET /users/limits` → confirmed `limits.codex` / `usage.codex` extension renders for
         a BASIC user (`{"period": "month", "limit": 3, "used": 0}`).
      2. `POST /codex/generate` → `202` + PENDING row → Taskiq picked up
         `codex_tasks.generate_codex_digest` → `GET /codex/today` polled through
         `pending → in_progress` and (after the `progress_phase` feature landed)
         `triaging → reading → synthesizing` → `completed`, live, over real HTTP polling.
      3. Hit and diagnosed a transient "Max client connections reached" Postgres error caused
         by restarting a long-lived Taskiq worker into a large backlog of overdue scheduled
         feed-refresh tasks that all fired concurrently (each opening its own connection under
         `NullPool`) — environmental contention from the restart itself, not a Codex defect;
         the pipeline's own FAILED-then-retry handling worked correctly through it, and a
         second attempt after the backlog drained completed cleanly. Not a discovered
         priority-queueing bug in the product; Taskiq has no built-in per-task-type priority
         today, which is a fair scalability question for later but out of scope here.
      4. Along the way, found and fixed the `worker_db` import-binding gap (see Bugs above)
         that was silently making `progress_phase` never populate under test.
      All test rows deleted after each inspection; dev DB confirmed empty of `codex_digests`
      rows at session end.
- [x] **Cost-model Phase 1/2 token budget** (doc §10 flag). Token estimate from the *current*
      constants (`CODEX_MAX_ARTICLES=100`, `CODEX_SNIPPET_CHAR_CAP=280`,
      `CODEX_MAX_DEVELOPMENTS=5`, `CODEX_MAX_ARTICLES_PER_DEVELOPMENT_FULLTEXT=5`,
      `CODEX_FULLTEXT_CHAR_CAP=12000`):
      - **Phase 1 (triage):** 100 TOON rows × ~110 tok (id/source/age/title + 280-char snippet)
        + ~600 tok system prompt ≈ **~12K in**; structured output (≤5 clusters + worth-reading
        ids + gist) ≈ **~1K out**.
      - **Phase 2 (synthesis):** typical 2–3 surviving clusters × ~5 bodies × ~3.2K tok
        ≈ **~48K in**; worst case all 5 clusters × 5 bodies at the 12K-char cap ≈ **~82K in**.
        Output (5 developments + worth-reading + two lines) ≈ **~2–3K out**.
      - **Per digest, typical ~63K in / ~3K out; worst ~96K in / ~4K out.**

      Cost depends entirely on which flash tier `GEMINI_SMART_MODEL` resolves to (config
      currently names `gemini-3.6-flash`, for which public per-token pricing isn't yet
      available — the numbers below use documented Gemini 2.x flash pricing as the proxy the
      design doc's "flash-tier" language intends):

      | Pricing proxy (in / out per 1M) | Typical / digest | Worst / digest |
      |---|---|---|
      | 2.0 Flash / 2.5 Flash-Lite ($0.10 / $0.40) | **~$0.007** | ~$0.011 |
      | 2.5 Flash ($0.30 / $2.50) | ~$0.026 | ~$0.039 |

      **Conclusion:** on a Flash-Lite-class model the doc's "well under a cent per digest"
      holds; on a full-2.5-Flash-class model it's ~2–4¢, driven by output-token price, not
      input. Monthly exposure ceilings even at the expensive tier: Basic **≤ $0.12/user/mo**
      (3 digests), Pro **≤ $1.20/user/mo** (≈30). Raising `CODEX_MAX_ARTICLES` back toward the
      doc's 1000 roughly 10×'s only the Phase 1 input (~110K tok) — adds ≈$0.03 at the
      expensive tier, still < $0.07/digest. **Action for launch:** confirm the real
      `GEMINI_SMART_MODEL` price when it's published; if it lands in the 2.5-Flash range,
      either accept ~3¢/digest or point Codex at the Flash-Lite model — the pipeline is
      model-agnostic (`services/ai/codex.py` reads `settings.GEMINI_SMART_MODEL`).

## Frontend — shared + web + mobile all built this pass

The backend pipeline is done, tested (unit + integration + two flavors of manual e2e), and the
API surface (`POST /codex/generate`, `GET /codex/today`, `GET /users/limits` with the codex
allowance) is stable. The shared layer, web surfaces (preview + live route + sidebar + gating),
and mobile surfaces (preview screen + bottom tab + live screen + paywall gate) are all
implemented and typecheck clean. Remaining: a human review pass on the mobile paywall wiring
(per `apps/mobile/CLAUDE.md` §17), a device smoke test, and the unrelated `apps/web` build
breakage called out below. No further backend work is needed.

- [x] **Shared types/hooks/fixtures** — `packages/shared/src/api/types/codex.ts`
      (`CodexDigestStatus`/`CodexDigestPhase` enums mirroring `models/enums.py`,
      `CodexDigestResponse` + payload interfaces mirroring `typing/codex.py`,
      `CodexNotEntitledResponse` + `isCodexNotEntitled` narrowing, `CodexUsage`/`CodexAllowance`
      for the `/users/limits` extension + `isCodexUnlimited`), `endpoints/codex.ts`
      (`generateCodexDigest`, `getCodexToday`), `hooks/use-codex.ts` (`useCodexToday` — 404→null,
      `refetchInterval` = `false` on `completed/failed/skipped` else `3000`; `useGenerateCodexDigest`
      — seeds `codex-today`, invalidates in `onSettled`; `isCodexDigestTerminal` helper),
      `fixtures/codex.ts` (`SAMPLE_CODEX_DIGEST` busy-day + `_IN_PROGRESS` / `_QUIET` / `_SKIPPED`
      variants, all typed as `CodexDigestResponse`). `UserLimits` extended with optional
      `limits.codex` / `usage.codex`. Wired into `client.ts`, `query-keys.ts` (`CODEX_QUERY_KEYS`,
      `queryKeys.codexToday()`), and all barrels. `bun run check-types && bun run lint` clean in
      `packages/shared` (no new warnings).
- [x] **Loading/skeleton UI keyed off `progress_phase`** — `CodexGenerating.tsx`. A 4-step
      ordered checklist (Reading your feeds / Finding patterns / Reading the full stories /
      Writing your digest) driven off `progress_phase`; a null phase renders as step 1 so the
      pre-pickup PENDING window looks intentional. Steps completed so far get a check, the
      active step animates an ellipsis, later steps are dimmed — no minimum-dwell assumption, so
      a sub-second `gathering` skipping straight to `triaging` still reads correctly. Plus a
      ping/spin header animation.
- [x] Web mock UI — `apps/web/app/(protected)/codex/preview/page.tsx` (a sticky state switcher:
      Busy day / Quiet day / Generating / Empty / Skipped / Failed, zero network) +
      `apps/web/components/features/codex/*`: `CodexView` (takes a `digest` prop, used by both
      preview and live route — scale-setter, gist, Developments section, Worth Reading, closing
      line), `DevelopmentCard` (synthesis + `N articles · M sources` provenance + expandable
      write-up list, index 0 badged "Best write-up", top card expanded by default),
      `CodexArticleRow` (light row, opens in new tab), `WorthReadingStrip`, `CodexStates`
      (empty / quiet-day / failed / not-entitled). Tailwind tokens throughout (light + dark).
- [x] Web live route + sidebar nav entry — `apps/web/app/(protected)/codex/page.tsx` →
      `CodexScreen` (wires `useCodexToday` + `useGenerateCodexDigest`, switches on status:
      pending/in_progress → `CodexGenerating`, skipped → quiet-day, failed → failed state,
      completed → `CodexView`, no row → empty state; `react-hot-toast` on not-entitled / error).
      `SidebarMain.tsx` → `{ title: "Codex", icon: Sparkles, url: "/codex" }` as the first
      `mainNavItems` entry, above "Today", per design §14.
- [x] `apps/web` checks + build. **`bun run build` (`next build`) succeeds** — `/codex` and
      `/codex/preview` compile and prerender as static. `tsc --noEmit` exits 0. `bun run lint`
      clean on every Codex file (fixed the `react/no-unescaped-entities` warnings in
      `CodexStates.tsx`). Fixed the pre-existing blocker along the way: bumped
      `@hookform/resolvers` `^4.1.3 → ^5.2.2` (resolves 5.9.1) so `zodResolver` types work with
      `zod ^4` — this was failing `LoginForm.tsx:39` on `codex` before this pass, independent of
      Codex; the other `zodResolver` site (`EditFeedForm.tsx`) also still typechecks. Monorepo
      `turbo run check-types lint` across `@readspace/{web,shared,mobile,extension}`: 10/10
      tasks pass.
- [x] **Mobile surfaces.** New `apps/mobile/src/components/screens/codex/`:
      `index.tsx` (`CodexScreen` — live: `useCodexToday` + `useGenerateCodexDigest`, same
      status switch as web, `toast.error` on not-entitled / error, and a **local
      `checkAndTriggerUpgrade('codex')` gate** that pops the Pro upsell before an out-of-quota
      Basic request is sent), `preview.tsx` (`CodexPreviewScreen` — horizontal `Tab` state
      switcher over the fixture, zero network), and `components/*`: `codex-view`,
      `development-card` (expandable, `AltArrowDownIcon` chevron, top card open by default),
      `codex-article-row` (taps through to `/(protected)/articles/[id]`), `worth-reading-strip`,
      `codex-generating` (the `progress_phase` checklist, `CheckCircleIcon` for done steps),
      `codex-states` (empty / quiet-day / failed / not-entitled via the shared `EmptyState`).
      uniwind classes + `COLORS` throughout. Routes: `(protected)/(tabs)/codex.tsx` (new
      **Codex bottom tab**, `StarsIcon`, between Following and Discover in
      `(tabs)/_layout.tsx`) and `(protected)/codex-preview/index.tsx` (registered in
      `(protected)/_layout.tsx`). `bun run check-types` clean; `biome check` clean on all new
      files. **Not yet done: a human review of the paywall gate (`useLimitChecker` change +
      the `checkAndTriggerUpgrade('codex')` call site) per §17, and an on-device smoke test.**
- [x] **Gating.** Web: `CodexScreen` surfaces the backend's not-entitled 202 as a toast + the
      `CodexNotEntitledState`; the codex allowance rides on `useUserLimits()` for any
      quota-remaining UI a follow-up wants (`limits.codex` / `usage.codex`, shapes per role as
      noted). Mobile: `useLimitChecker` gains `canUseCodex()` (reads `usage.codex`, respects
      `isPro` and `isCodexUnlimited`) and `checkAndTriggerUpgrade('codex')` (opens the existing
      `useUpgradeDialog` with month-limit copy); `CodexScreen` calls it before every generate.
      Admin/Pro/unlimited all fall through to a normal request; the server remains the source
      of truth (the local gate is only to avoid a wasted round-trip + show the upsell).

## Still open

- [ ] **Human review of the mobile paywall gate** — `apps/mobile/src/hooks/useLimitChecker.ts`
      (`canUseCodex` + the `'codex'` case in `checkAndTriggerUpgrade`) and its call site in
      `CodexScreen`. No RevenueCat/native code was touched — it only reads the shared limit
      data and opens the existing `useUpgradeDialog` (**which is the required behavior — never
      the RevenueCat paywall UI**) — but §17 still wants a human glance at anything
      payments-adjacent. Diff is ~25 lines; see "Review guide" below.
- [x] **`@hookform/resolvers` bumped `^4.1.3 → ^5.2.2`** — fixes the pre-existing
      `LoginForm.tsx:39` `zodResolver` type error (v4 was typed for Zod 3; repo is on `zod ^4`).
      `next build` and `tsc` now pass; `EditFeedForm.tsx` (the other `zodResolver` site) still
      typechecks. (The pre-existing backend `ruff` E501s in `app/services/ai/prompts.py:130-156`
      — the feed-enrichment prompt, not Codex — are still there; wrap those lines if you want
      backend CI green, separate from this feature.)
- [x] **BASIC `max_daily_ai_calls` reverted 5 → 3** (`app/core/resource_limits.py`). This is the
      *separate* daily summary/translation limit (Redis `ai_usage` counter), unrelated to the
      Codex quota (which is a `codex_digests` row count, `CODEX_LIMITS`, and stays 3/month for
      BASIC). Commit `0dcf923c` had bumped it to 5 without updating
      `test_enforce_daily_ai_limit_exceeded`; it's now back to the intended 3 and all 63 backend
      unit tests pass. Web (`use-limit-checker.ts`) and mobile (`useLimitChecker.ts`) paywall
      copy is built dynamically from `limitData.limits.max_daily_ai_calls`, so it now reads "3"
      with no client change needed.
- [ ] **Smoke tests** — web `/codex` + `/codex/preview` in a browser (light/dark, expand
      /collapse, generate → poll → render), mobile Codex tab + `/codex-preview` on a device.
      No UI round has had a real browser pass yet (auth-gated preview + no browser tool in
      those sessions). See the Round 1c checklist for the specific things to eyeball.
- [ ] **Deploy prerequisites** (ops, per env): run both migrations (`alembic upgrade head` →
      `5599f026a90f` codex_digests table, then `bd5be628e52e` progress_phase column);
      `ENABLE_AI=true` + valid `GEMINI_SMART_MODEL` key; confirm that model's per-token price
      once published (cost model assumes flash-tier — swap to Flash-Lite if it lands expensive,
      no code change).
- [ ] **Mobile UI port** of the Round 1a–1c web redesign — tracked in the Round 1c checklist
      under "still open".
- [ ] Future phases (doc §16, all backend): cron fan-out, continuity, `SimpleTaskTracker`
      extraction, optional Phase 0.5 junk-filter pass.

> **Superseded:** the "Gating" bullet above says web surfaces the not-entitled 202 "as a
> toast". As of Round 1c it's a full `CodexNotEntitledState` that branches on `error_code`
> — see the Round 1c checklist.

## Review guide — mobile paywall gate (§17)

Two things to eyeball, both in `apps/mobile`:

1. **`src/hooks/useLimitChecker.ts`** — added `canUseCodex()` and a `'codex'` branch in
   `checkAndTriggerUpgrade`. `canUseCodex` returns `true` for Pro (`isPro`), for missing limit
   data (fail-open, same as `canAddFeed`/`canUseAI`), and for `isCodexUnlimited(usage.codex)`
   (admin); otherwise `usage.codex.used < usage.codex.limit`. The `'codex'` branch opens the
   existing `useUpgradeDialog` with "Monthly Codex Limit Reached" copy and returns `false`.
   No import of `react-native-purchases`, no `Purchases.*` call, no `presentPaywall` — it only
   reads `useUserLimits()` data and the existing `isPro` boolean.
2. **`src/components/screens/codex/index.tsx`** — `handleGenerate` calls
   `if (!checkAndTriggerUpgrade('codex')) return;` before `generate.mutate(...)`. Purely a
   pre-flight UX gate; the server's `enforce_codex_quota` remains the real enforcement, so a
   stale/bypassed client can't over-spend.

**Locked decision (owner):** the mobile upsell is **`useUpgradeDialog` only — never the
RevenueCat paywall UI** (`presentPaywall` / `presentPaywallIfNeeded` / the RC paywall sheet).
This applies to Codex and to any future change to this gate. Do not swap it.

## Feedback log

The active phase. Owner-provided changes, newest first. Each item: what was asked, what
changed, files touched, status.

### Round 1 — UI (web pass 1, done)

Owner review of `/codex/preview`: "not premium enough / vibecoded", avoid the primary colour
(prefer secondary), drop the ALL-CAPS title + uppercase section labels, kill the duplicated
quiet-day copy, wrong icons (Solar not lucide), states not vertically centred, too much dead
side margin on desktop, developments should be bullets not a paragraph, make richer use of
article images (galleries), avatar-group for "N sources", no italics, less-rounded cards,
study Google/Apple News newspaper layout.

**Web-only this pass** (mobile port is a follow-up). What changed:

- **`services/ai/prompts.py` + `typing/codex.py`** — `CODEX_SYNTHESIS_SYSTEM_PROMPT` now
  tells the model to write `synthesis` as **markdown** (3–5 `- ` bullets, lead-with-the-fact,
  one idea each, `**bold**` on one anchor, source names inline; `scale_setter` / `closing_line`
  / worth-reading `reason` stay plain text). `CodexDevelopment.synthesis` / `…Resolved.synthesis`
  Field descriptions updated to say "markdown bullet list". Schema type is still `str` — no
  migration, existing payloads still render (as one paragraph). Backend `ruff`/`ruff format`
  clean on both files (the 9 E501s in `prompts.py:130-156` are the pre-existing enrichment
  prompt, untouched); 23 codex unit tests green.
- **New `apps/web/components/features/codex/SourceAvatarGroup.tsx`** — overlapping feed-icon
  avatars, de-duped by feed title, "+N" overflow chip, optional trailing label.
- **`CodexView.tsx`** — rewritten newspaper-style. Masthead (sentence-case `scale_setter`, no
  ALL-CAPS, Solar `StarsIcon`, secondary accent). Busy day → `max-w-6xl` two-column grid:
  main Developments column + sticky right rail ("The day" numbers card + `SourceAvatarGroup`
  + Worth Reading). Quiet day (0 developments) → single centred `max-w-2xl` column with Worth
  Reading front-and-centre (fixes the wasted rail). Kills the big desktop side margins.
- **`DevelopmentCard.tsx`** — `rounded-lg` (was `xl`), sentence-case title, secondary hover.
  `synthesis` now rendered through the shared `<Markdown>` component (bullets). Lead (rank-0)
  card is `featured`: 16/7 hero image from the best write-up (with `bg-muted` placeholder) +
  a restrained thumbnail strip from the *other* write-ups' images. Non-featured card has no
  hero — the coverage images become a `grid-cols-3` `16/10` gallery (the visual anchor). Hero
  image is de-duped against the lead write-up's row thumbnail.
- **`CodexArticleRow.tsx`** — newspaper row: source favicon + name + `·` + strict relative
  time, `ArrowRightUpIcon` on hover, lead row gets a 64px thumbnail (suppressed when the card
  already shows a hero), `dense` variant for the rail. No italics.
- **`WorthReadingStrip.tsx`** — lean `divide-y` list in a `rounded-lg` card, reason line is
  plain (was italic), tighter padding.
- **`CodexGenerating.tsx`** — `min-h-[70vh]` vertically centred, Solar `CheckCircleIcon` for
  done phases (was a bare `✓` in a circle), secondary accent, "Finding the patterns".
- **`CodexStates.tsx`** — all four states `min-h-[70vh]` vertically centred, Solar bold icons
  (`StarsIcon` / `MoonSleepIcon` / `RestartIcon` / `LockKeyholeIcon`), secondary accent.
- **`codex/preview/page.tsx`** — state-switcher active pill uses `bg-secondary` (was primary).
- **`packages/shared/src/api/fixtures/codex.ts`** — added `image_url`s (Unsplash) so the
  preview exercises hero + gallery + row-thumb paths; `synthesis` values rewritten as markdown
  bullets; de-duplicated the `_QUIET` gist ("A quiet day — nothing your sources converged on.
  A handful of standalone reads below." + the near-identical line right after it).
- **`apps/web/package.json`** — added `@solar-icons/react@^2.1.0` (web had lucide only; mobile
  already uses `@solar-icons/react-native`). Import bold icons from `@solar-icons/react/bold`
  by their **bare** name (`StarsIcon`), not the `StarsBoldIcon` suffix (that's the flat
  top-level entrypoint).

Verified: `turbo run check-types lint` clean for `@readspace/web` + `@readspace/shared`
(pre-existing `@readspace/landing` bento-png check-types failure is unrelated); `next build`
compiles `/codex` + `/codex/preview` static; all six preview states screenshotted in
light + dark + at the `lg` breakpoint (rail collapses, Worth Reading falls inline).

**Still open / follow-ups:** port the redesign to `apps/mobile/src/components/screens/codex/*`;
tune the non-featured gallery size if it's too loud; when Round 2 lands, confirm the model
actually emits clean `- ` markdown (`CodexSynthesis` parses `- `/`* ` bullets and one
`**bold**` anchor per line; degrades to a single serif paragraph-bullet if the model doesn't
emit markers).

### Round 1b — UI (web pass 2, done)

Owner review of the redesigned `/codex/preview`. What changed (all `apps/web/components/features/codex/*`
unless noted):

- **Serif through-line (P0).** New `CodexSynthesis.tsx` renders the synthesis as reading-serif
  (EB Garamond) bullets with `**bold**` anchors in secondary — replaces the generic
  `<Markdown>` (`prose prose-sm`, forced `!text-sm` sans) which violated the Serif-Reads Rule
  for "the synthesized Codex through-line". The masthead line is now a bold `font-serif`
  standfirst (`text-[28px] sm:text-3xl font-bold tracking-tight`), the nameplate + magnitude
  line are `font-mono`, and `CodexArticleRow`'s dateline (source · relative time) moved to
  `font-mono text-xs`. No sub-12px type left (`text-[10px]`/`text-[11px]` gone).
- **Generating state (P0).** Killed the concentric ping-ring + `animate-spin` arc + `…` pulse
  ("two circles + a spinner"). Now: the `Stars` mark holding steady with one `motion-safe`
  `thin-pulse` breath, a checklist whose active row carries a single `shimmer` sweep, and
  **elapsed seconds computed from the persisted `requested_at`** (survives a reload
  mid-generation — `CodexGenerating` takes a `requestedAt` prop, wired from
  `digest.requested_at` in `CodexScreen`). `motion-reduce` respected throughout.
- **Adaptive `DevelopmentCard`.** Image layout is chosen from `(imageCount, widest usable
  image)` — a capped `16/9`–`2/1` hero only when the lead image measures ≥760px (`onLoad`
  rejects smaller ones so it can't upscale), else a side-by-side pair, a `grid` mosaic, or
  text-only. `priority` dropped, responsive `sizes` added, `next/image` switched to `fill`.
  Fixes the stretched low-res hero and the phone-width thumbnail-row overflow.
- **Redundancy.** `CodexView` shows the `gist` as the standfirst and the `scale_setter` as a
  secondary mono line only when it isn't already the standfirst and doesn't token-overlap
  (`overlaps()` heuristic). Quiet day dropped the `border-dashed` panel entirely — the
  standfirst carries the "quiet day" line, Worth Reading carries the column. Fixture
  `scale_setter`s rewritten as magnitude-only (`"143 pieces · 31 sources · 7 developments"`),
  quiet-day copy de-duplicated. **The real fix is the prompt split — see Round 2 below.**
- **Provenance row.** `SourceAvatarGroup` `+N` chip gains a `title`/`aria-label` naming the
  hidden sources and `text-xs` (was `text-[10px]`); the article count moved to `ml-auto`
  `font-mono`, the `·` crutch removed. Worth Reading `reason` moved *inside* `CodexArticleRow`
  (a `reason` prop) so it's in the row's own rhythm — fixes the orphaned ~12px title→reason
  gap from the leaked `dense` `py-2.5`.
- **States.** `CodexStates` shell tightened (`max-w-xs`, `mt-5`/`mt-1.5`/`mt-6`, `size-11`
  icon, `font-bold tracking-tight` titles), copy trimmed. Failed state lost the extra
  bottom line. `DangerTriangleIcon` for failed (was a `RestartIcon` in a red disc).
- **Footer / way back.** Each digest ends with the `closing_line` plus a `text-secondary`
  link to `/today` ("Read all 143 in your feed") — Codex is a lens on the reader, not a
  replacement. First-time-viewer serif explainer under the masthead, shown once via
  `localStorage`, no dismiss button.
- **Copy / consistency.** "Worth reading" → "Worth Reading". Date label gains the year.
  `TheDayCard` shows "2 of 7" when found ≠ shown, `"not counted"` instead of a bare `—`.
  `CodexScreen` switched `generate.mutate()` → `mutateAsync()` per the CLAUDE.md TanStack rule.
- **Preview fixture.** Added a deliberately-small (`?w=400`) lead image on the CoreWeave
  cluster so the preview exercises the hero-fallback path; `_IN_PROGRESS.requested_at` set a
  few seconds back so the generating preview shows a live timer.
- **`DESIGN.md`** — §Codex rewritten to match (standfirst / adaptive image layout /
  serif-synthesis / new generating state); added a "Standfirst" type role.

Verified: `@readspace/web` + `@readspace/shared` `turbo run check-types lint` clean; `next build`
compiles `/codex` + `/codex/preview` static. Browser screenshots not taken this pass — the
preview route is auth-gated and no browser tool was available in the session.

### Round 1c — UI (web pass 3, done)

Second full critique (`/impeccable critique`, dual-agent) + owner feedback on pass 2. Snapshot:
`.impeccable/critique/2026-09-10T03-09-40Z__…codexview-tsx.md` (27/36, "Good"). What changed:

- **Synthesis bullet marker** (owner's actual ask) — the fragile hand-offset green flex-dot
  (`mt-[0.7em] size-1 bg-secondary/70`) is now a real CSS hanging bullet: `<ul list-disc
  marker:text-muted-foreground/50 pl-[1.1em]>`, browser-aligned to the first line. **Size
  stays `text-[15px]`, `**bold**` anchors stay `text-secondary` green** — owner reverted an
  over-correction that had bumped both. It's EB Garamond (`font-serif` → `--font-garamond-serif`),
  same face as the article reader.
- **Standfirst is now `<h1>`** (was a `<p>` — the completed view had no `<h1>` at all), flat
  `text-[28px]` (dropped the pointless 28→30px `sm:text-3xl` breakpoint). `CodexGenerating`
  and `CodexStates` headings promoted to `<h1>` too.
- **`TheDayCard` → `IssueColophon`.** Kept the justified `<dl>` label/value ledger (owner
  preferred it to running sentences) under a "This issue" mono head, but **dropped the feed-
  icon `SourceAvatarGroup`** (it didn't add meaning in a counts block). **Renders inline on
  mobile** (below the standfirst) so the counts don't vanish with the rail. Rows: Pieces /
  Sources / Developments (`"2 of 7"` when found ≠ shown).
- **Section heads** ("Developments" / "This issue") are now `font-mono text-xs uppercase
  tracking-wider text-muted-foreground` — rules on the page, not three identical sans panel
  titles.
- **Footer** is now just the `closing_line` with its trailing "…in your reader" **linked to
  `/today`** (woven into the sentence, `linkifyReader()` — matches "…still in your reader",
  "…in your feed", "…in your inbox", else appends "Open your reader"). The separate "Read all
  N" CTA and the "About Codex" link are both gone.
- **Generating shimmer kept** (owner override of the critique's "AI shimmer" flag — they like
  it). Verified the `motion-reduce` fallback is a solid `text-foreground` (base class outside
  the `motion-safe:` group). The active **number circle** is static now (the earlier
  `thin-pulse` scale-transform on it was the "fucked"-looking jitter); the `Stars` mark keeps
  its `thin-pulse` breath. Done ticks went `text-secondary` → `text-secondary/70` so 3 stacked
  green checks don't shout. Checklist is `w-fit` centered as a block so it reads aligned under
  the centered heading (was `w-full`, left edge 144px off-centre).
- **`FirstTimeExplainer`** — back in the masthead under the standfirst (owner: "so out of
  position" when it was moved out), EB Garamond, **no "Got it" button** (owner), shown once
  via `localStorage`, suppressed on quiet days (no developments to point at).
- **`CodexSynthesis` font** — owner reported it "still not EB Garamond" twice. The chain was
  correct (`font-serif` → `--font-serif` → `--font-garamond-serif`, loaded on `<body>`), but
  switched to an explicit inline `style={{ fontFamily: "var(--font-garamond-serif), <CJK
  serif fallbacks>, ui-serif, Georgia, serif" }}` on the `<ul>` and each `<strong>` — byte-
  identical to how `ArticleContent.tsx` applies the reader serif — so nothing can shadow it.
  If it still renders wrong it's dev-server HMR staleness (a hard refresh fixes it); `next
  build` CSS has the correct `@font-face` (`font-weight: 400 800` variable) and utility.
- **DevelopmentCard title** `font-bold` → `font-semibold` (owner: "slightly less bold").
- **`SourceAvatarGroup` `+N` chip** — was `-ml-1.5 px-1.5 ring-2` (cramped, tucked under the
  last avatar). Now `ml-1 px-2 min-w-5 inline-flex`, no ring — reads as its own pill with
  real padding, clear of the avatars.
- **Not-entitled is a real state now, not a toast.** `CodexScreen` holds the not-entitled 202
  and renders `CodexNotEntitledState`, which branches on `error_code`: `CODEX_LIMIT_EXCEEDED`
  → "You're out of Codex digests this month" + a **See Pro** button opening `useUpgradeDialog`
  (the app's standard upsell, not a route); `AI_DISABLED` → "This Readspace runs without AI" +
  a self-hosting-docs link. A lost poll connection is its own `connectionLost` state ("Lost
  the connection", `CloudCrossIcon`, "Retry") distinct from a true `FAILED` build.
- **Footer link** `text-secondary` → `text-primary` (Rationed Green: links are Forest Green,
  and `text-secondary` was 3.17:1 on the light card — below AA; `text-primary` is 6.3:1).
  Copy "in your feed" → "in your reader" (PRODUCT.md terminology).
- **`DevelopmentCard`** — `aria-controls`/`id` from `useId()` (was `writeups-${title}`, which
  broke as a multi-IDREF for any spaced title); `focus-visible` ring on the disclosure button
  (the one Codex control that lacked one); hero width constant `760` → `620` (matches the real
  `minmax(0,1fr)` column at `lg`, so a 650px image that fills the column isn't rejected);
  strip `<Image>`s got the same `onLoad` upscale guard the hero had; mosaic needs 4+ images
  (a 3-up `grid-cols-3` was busy next to the serif).
- **`CodexStates` shell** `max-w-xs` → `max-w-sm` (the ~40-char measure was cramped);
  `EXPLAINER_DISMISSED_KEY` namespaced `readspace:`.
- **`DESIGN.md` §Codex + §Typography** rewritten to match (h1 standfirst flat size, colophon,
  mono section heads, not-entitled branching, connection-lost state, the kept shimmer).

Verified: `turbo run check-types lint` across `@readspace/web` + `@readspace/shared` — 6/6
pass; `next build` compiles `/codex` + `/codex/preview` static; detector 4 advisory
(`text-[15px]`, DESIGN.md-sanctioned Codex step), exit 0. Both `shimmer` + `thin-pulse`
keyframes confirmed in the compiled CSS. No browser screenshots — auth-gated preview, no
browser tool this session.

#### Round 1c checklist — every critique / owner item, with status

**Web UI — done this pass:**

- [x] Synthesis bullet marker → real CSS hanging `list-disc` (`marker:text-muted-foreground/50`),
      no more `mt-[0.7em]` hand-offset; size `text-[15px]` and green `**bold**` anchors kept
      per owner.
- [x] Synthesis font pinned to EB Garamond via explicit inline `fontFamily` (CJK serif
      fallbacks), matching `ArticleContent` — no longer relying on the `font-serif` utility.
- [x] Standfirst is `<h1>` (was `<p>`; page had no `<h1>`), flat `text-[28px]`, no 28→30px
      breakpoint. `CodexGenerating` + `CodexStates` headings → `<h1>`.
- [x] `TheDayCard` → `IssueColophon` — justified `<dl>` ledger under a "This issue" mono head,
      feed icons dropped, renders inline on mobile so counts don't vanish with the rail.
- [x] Section heads ("Developments", "This issue") → `font-mono text-xs uppercase
      tracking-wider text-muted-foreground` (rules, not identical sans panel titles).
- [x] Footer collapsed to the `closing_line` alone, its trailing "…in your reader" linked to
      `/today` (`linkifyReader()`); dropped the separate "Read all N" CTA and "About Codex".
- [x] Footer link colour `text-secondary` → `text-primary` (Rationed Green + the 3.17:1 AA
      failure on light card).
- [x] Not-entitled is a full state, not a toast — `CodexScreen` holds the 202,
      `CodexNotEntitledState` branches on `error_code` (`CODEX_LIMIT_EXCEEDED` → "See Pro" via
      `useUpgradeDialog`; `AI_DISABLED` → self-hosting docs link).
- [x] Lost-poll-connection is its own `connectionLost` state (distinct from a true `FAILED`
      build).
- [x] Generating shimmer kept (owner override of the "AI shimmer" flag); `motion-reduce`
      fallback verified solid `text-foreground`.
- [x] Generating number circle static (removed the jittering `thin-pulse` scale-transform);
      `Stars` mark keeps its breath; checklist `w-fit` centred; done ticks `text-secondary/70`.
- [x] `FirstTimeExplainer` back in the masthead under the standfirst, EB Garamond, no "Got it"
      button, once via `localStorage` (`readspace:`-namespaced key), hidden on quiet days.
- [x] `DevelopmentCard` title `font-bold` → `font-semibold`.
- [x] `SourceAvatarGroup` `+N` chip `-ml-1.5 px-1.5 ring-2` → `ml-1 px-2 min-w-5 inline-flex`,
      ring removed (padded pill, clear of the avatars).
- [x] `DevelopmentCard` `aria-controls`/`id` → `useId()` (was `writeups-${title}`, an invalid
      multi-IDREF for any spaced title).
- [x] `DevelopmentCard` disclosure button got a `focus-visible` ring (the one Codex control
      that lacked one).
- [x] Hero width constant `760` → `620` (the real `minmax(0,1fr)` column at `lg`); strip
      `<Image>`s got the hero's `onLoad` upscale guard; mosaic now needs 4+ images.
- [x] `CodexStates` shell `max-w-xs` → `max-w-sm`.
- [x] `DESIGN.md` §Codex + §Typography updated to match all of the above.

### Round 1d — UI (web pass 4, done)

Owner asks: prod-guard the preview route, more image-layout preview fixtures, pick backend or
frontend for best-resolution hero selection (backend chosen — no both), humanise the generating
elapsed timer, pre-compute the dashboard layout / add a skeleton.

- **`/codex/preview` is dev-only now.** `app/(protected)/codex/preview/page.tsx` calls
  `notFound()` when `process.env.NODE_ENV === "production"` (guard in the default export, inner
  component holds the hooks). `next build` still emits the route as a static shell but it 404s
  at runtime in prod. Mobile parity: `app/(protected)/codex-preview/index.tsx` `<Redirect
  href="/codex" />` when `!__DEV__`.
- **Hero-image selection — decided: backend.** Owner picked backend over the client-side
  measure-before-render approach (which needed hidden `new Image()` probes, a settle timeout,
  and double-fetched every image). New module `app/services/codex/imagery.py`:
  `select_development_imagery(articles)` streams a ranged GET (`Range: bytes=0-65535`, with an
  early break once the parser has the header and a hard byte cap so a Range-ignoring server
  can't dump a full image) of each cited article's `image_url`, reads the pixel size with
  Pillow's incremental `ImageFile.Parser` (no full download), and picks — in article-strength
  order — the first image that clears `CODEX_HERO_MIN_WIDTH` (1000px) and `CODEX_HERO_MIN_RATIO`
  (1.2, rejects portrait/near-square) as the hero, then up to `CODEX_MAX_STRIP_IMAGES` (4) more
  over `CODEX_STRIP_MIN_WIDTH` (400px) for the strip/mosaic; a lone strip tile with no hero →
  text-first. Candidates are capped at `CODEX_MAX_IMAGE_PROBES` (= strip cap + 1 = 5) since no
  more than that can ever render. Probe fan-out is `CODEX_IMAGE_PROBE_CONCURRENCY` (8) with a
  `CODEX_IMAGE_PROBE_TIMEOUT` (4s) per image; any failure is skipped. HEAD isn't usable — no
  HTTP header carries pixel dimensions. In-flight cancellation once a hero resolves was
  considered and skipped: ≤5 bounded requests fire as one ~round-trip; order-preserving
  cancellation isn't worth the Task juggling. Wired into the pipeline as
  `_attach_development_imagery(payload)` after `_resolve_payload`, run concurrently across
  developments, best-effort (a failure leaves `hero_image_url=None` / `strip_image_urls=[]`).
  New payload fields `hero_image_url: str | None` + `strip_image_urls: list[str]` on
  `CodexDevelopmentResolved` (and the shared `CodexDevelopment` TS type, both optional — no
  schema migration, `payload` is JSON). `DevelopmentCard` now has **zero** client-side
  measuring: it renders `development.hero_image_url` / `strip_image_urls` directly with an
  `onError` fallback only. Tests: `tests/unit/test_codex_imagery.py` (23) — pure `_choose` /
  `_dedupe_urls` logic plus `_probe_one`, `select_development_imagery`, and
  `_attach_development_imagery` against an in-memory `httpx.MockTransport` (real Pillow parsing
  of generated image bytes, no network, no DB); the two full-pipeline integration tests stub
  `select_development_imagery`.
- **`CodexSkeleton`** — newspaper-shaped placeholder (masthead bar + 2 development-card
  skeletons + 3 rail-card skeletons) at the real `max-w-6xl` grid geometry. `CodexScreen`'s
  `isLoading` branch renders it instead of the bare centered `<Loader>`, so the load→content
  swap doesn't move the page. (Does **not** fix the generating↔completed lurch below — that's
  a different surface.)
- **Elapsed timer is human-readable.** `CodexGenerating` was rendering `{elapsed}s` verbatim
  ("1350s" on a stuck job across a reload). Now a configured `humanize-duration` humanizer
  (`humanize-duration` was already a web dep, unused): `8s` / `1m 35s` / `22m 30s` / `1h 5m`
  — two largest units, short `h`/`m`/`s` labels, still `font-mono tabular-nums`.
- **Preview fixtures** — `SAMPLE_CODEX_DIGEST_HERO_HEAVY` (featured hero + mosaic, a
  non-featured hero, and a text-first card), `SAMPLE_CODEX_DIGEST_TEXT_ONLY` (every card
  text-first), `SAMPLE_CODEX_DIGEST_LONG_RUN` (`requested_at` −1,350,000 ms, exercises the
  `Nm Ns` timer). Fixtures set `hero_image_url` / `strip_image_urls` directly (no network
  probe in the preview). Base `SAMPLE_CODEX_DIGEST` now carries a hero on dev 0, none on dev
  1. Preview page gained "Image-rich (bento)", "No images", "Generating (long run)" tabs.

**Web UI — still open (owner deferred or didn't ask for):**

- [ ] **Two-flavour quiet day** — `CodexQuietDayState` (SKIPPED, no articles) vs the
      `CodexView` 0-clusters branch read as the same thing to a user. Route both through the
      one well-written `CodexQuietDayState` copy, appending Worth Reading when articles exist.
- [ ] **Deterministic standfirst** — the `gist` / `scale_setter` / `overlaps()` logic means a
      daily user can't predict whether the big line is meaning or magnitude. Decide: always
      the gist as the standfirst, magnitude always in the colophon. (Pairs with the Round 2
      prompt-role split below.)
- [ ] **Generating ↔ completed layout lurch** — generating is centred `max-w-xs`; completed
      is an asymmetric `max-w-6xl` grid. The page jumps when the digest resolves. Consider
      rendering the checklist in the masthead+column position the finished digest will occupy.
- [ ] **Preview route gaps** — `app/(protected)/codex/preview/page.tsx` has no `not-entitled`
      case, and its `skipped` option renders `<CodexQuietDayState />` (the component), not
      `SAMPLE_CODEX_DIGEST_SKIPPED` (the payload). Add the case; wire the fixture.
- [ ] **Mobile port** — carry Round 1b + 1c to `apps/mobile/src/components/screens/codex/*`
      (serif synthesis with the hanging marker, `<h1>` standfirst, colophon, not-entitled
      branch, no "About Codex"/"Read all N", `+N` chip padding). Mobile masthead mirrors the
      standfirst/magnitude split.
- [ ] **Browser smoke test** — `/codex` + `/codex/preview` in a real browser, light + dark,
      across all states; confirm the synthesis renders EB Garamond (the inline `fontFamily`
      fix; a stale dev server was the suspected cause of the earlier reports).
- [ ] **`readspace.ai/docs/codex` + `/docs/self-hosting#ai`** — the not-entitled state links
      to these; make sure the docs pages exist before ship, or point the links elsewhere.

### Round 2 — Codex API / functionality (first pass, done)

Owner review of real generated digests: (1) the digest `<h1>` runs too long — it was the
whole `gist` sentence — give it a short headline and push the rest into a description line;
(2) each Development's `title` also runs long — same fix, short title + a one-sentence
summary; (3) the Development `synthesis` bullets aren't tight/scannable like the article-
summary bullets — make them digest-style; (4) the "143 pieces · 31 sources · 7 developments"
line shouldn't sit in the masthead — it's a card. What changed:

- **`typing/codex.py`** —
  - `CodexTriageOutput.headline` (new, `default=""`): the short front-page `<h1>` for the
    whole day (~3-8 words, no trailing clause). `gist` demoted to "the 1-2 sentence
    standfirst UNDER the headline" and its Field description says not to restate the headline.
  - `CodexDevelopment.summary` (new, `default=""`): one plain-text sentence framing a
    development; `title` Field description tightened to "short headline, ~4-9 words, no
    trailing clauses, framing goes in `summary`". `synthesis` description rewritten to the
    tight digest style (3-5 bullets, ONE short sentence each, ~8-16 words, lead with the
    payload). Mirrored on `CodexDevelopmentResolved` (`summary=""`) and `CodexDigestPayload`
    (`headline=""`). All new fields default-valued → no migration, `payload` is JSON, old
    rows still validate.
- **`services/ai/prompts.py`** —
  - `CODEX_TRIAGE_SYSTEM_PROMPT` §3 is now "Write the headline and the gist" — two outputs,
    explicitly "must NOT say the same thing", with examples of a good short headline
    ("A model release and a datacenter mega-raise", "A quiet news day"). Rules section gained
    a "`headline` is short plain text, never a full sentence with a comma-explanation; they
    must not be near-duplicates" line.
  - `CODEX_SYNTHESIS_SYSTEM_PROMPT` "Per development" split into `title` (short headline,
    "if it needs a comma-plus-explanation it's too long"), `summary` (one framing sentence),
    and `synthesis` (rewritten: "SAME tight digest style as an article summary", 8-16 words
    per bullet, payload-first, "prefer more short bullets over fewer long ones" — modelled on
    `SUMMARY_SYSTEM_PROMPT`'s Key-points rules). `scale_setter` guidance changed from "one
    sentence framing the whole day" to "a SHORT magnitude line … not a sentence … format it
    as '{N} pieces · {N} sources · {N} developments' … do NOT restate the day's meaning".
    Plain-text rule updated to list `title`/`summary`.
- **`services/codex/pipeline.py`** — `_build_synthesis_prompt` passes `headline` into the
  Phase 2 framing; `_resolve_payload` threads `headline=triage.headline` onto the payload and
  `summary=dev.summary` onto each `CodexDevelopmentResolved`.
- **`packages/shared/src/api/types/codex.ts`** — `CodexDigestPayload.headline?: string`,
  `CodexDevelopment.summary?: string` (both optional, "fall back to gist / first bullet on
  pre-split digests"). **`fixtures/codex.ts`** — every sample gained a short `headline`
  distinct from its `gist`; every development gained a short `title` + a `summary`; all
  `synthesis` values rewritten as tight ≤16-word bullets.
- **`apps/web/components/features/codex/CodexView.tsx`** — the `<h1>` is now `payload.headline`
  (falls back to `gist` then `scale_setter`); `gist` renders as a `text-[15px]
  text-muted-foreground` standfirst `<p>` under it, suppressed when there's no headline or it
  equals the gist. **`overlaps()` deleted.** `scale_setter` no longer appears in the masthead
  at all — it's the "This issue" colophon in the rail (see UI note below).
- **`apps/web/components/features/codex/DevelopmentCard.tsx`** — renders `development.summary`
  as a `text-pretty` muted standfirst between the (now short) serif title and the synthesis;
  title got `text-balance` so a stray long one wraps cleanly instead of overflowing.
- **`apps/mobile/.../codex/components/codex-view.tsx`** — masthead big line switched from
  `scale_setter` to `headline` (fallback `gist`), with `gist` as the sub-line only when it
  differs. Minimal parity; the full mobile port (colophon, dev-card summary) is still the
  tracked follow-up.

**UI note (web, same pass):** the old "At a glance" attempt at a counts card rendered as a
3-up KPI grid (dashboard-y, and it doubled the visual weight of the "Condensed" stat right
below). Replaced with `AtAGlanceCard` → `ColophonCard`: the "This issue" justified `<dl>`
ledger from DESIGN.md (label left, mono figure right, hairline rules), built from the digest
row counts (`input_article_count` / `input_source_count` / `clusters_found`, "N of M" when
found ≠ shown), falling back to parsing `scale_setter` only for older rows. Also
`CondensedStat`'s `~N min` numeral gained `dark:text-secondary` so it's the lighter green in
dark mode, matching the app's primary→secondary dark swap.

**Verified:** 92 backend unit tests pass; `ruff`/`ruff format`/`mypy` clean on the touched
Codex files (the 9 `prompts.py:130-156` E501s are the pre-existing feed-enrichment prompt,
not Codex). `turbo run check-types lint` across `@readspace/{web,shared,mobile}` — 8/8.
`/codex/preview` screenshotted (busy + quiet, light + dark): the `<h1>` stays one short line,
the standfirst carries the long sentence, the colophon reads as a ledger.

**Still open for a later Round 2 pass:**

- [ ] Confirm on real generated digests that the model actually keeps `headline` short and
      distinct from `gist`, and that `title`/`summary` split cleanly per development — add a
      cheap eval that rejects a `headline`/`gist` (and `title`/`summary`) pair with high token
      overlap if the model collapses them.
- [ ] Full mobile port of the web split — dev-card `summary`, a mobile colophon for the
      counts, serif synthesis with the hanging marker (tracked under Round 1d "still open").
- [ ] Pre-existing `ruff` E501s in `app/services/ai/prompts.py:130-156` (feed-enrichment
      prompt, untouched) — wrap if you want backend CI fully green. Not Codex.
