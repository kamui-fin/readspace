import type { ArticleSummary } from './articles';

// Codex Digest types — mirror server/app/typing/codex.py and server/app/models/enums.py.
// Keep these in lockstep with the backend; the fixture (fixtures/codex.ts) is typed against
// CodexDigestResponse so it can't silently drift.

/** Terminal + in-flight states of a codex_digests row. Mirrors CodexDigestStatus. */
export enum CodexDigestStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * Which pipeline phase an IN_PROGRESS digest is in. Null before the worker picks the task
 * up, and frozen at its last value once a digest reaches a terminal status. Mirrors
 * CodexDigestPhase.
 */
export enum CodexDigestPhase {
  GATHERING = 'gathering',
  TRIAGING = 'triaging',
  READING = 'reading',
  SYNTHESIZING = 'synthesizing',
}

/** A synthesised development with its catalog ids resolved to full articles. */
export interface CodexDevelopment {
  /** Short headline — framing lives in the first synthesis bullet, not here. */
  title: string;
  /** Markdown — a tight `- ` bullet list; the first bullet frames the development. */
  synthesis: string;
  source_count: number;
  article_count: number;
  /** Ordered, index 0 = best write-up. */
  articles: ArticleSummary[];
  /**
   * Pipeline-selected wide image for the card's hero band (it probes each cited article's
   * image and picks one large enough). Null → render the card text-first. Absent on
   * pre-imagery digests.
   */
  hero_image_url?: string | null;
  /**
   * Pipeline-selected images for the below-synthesis strip / 2×2 mosaic, hero excluded.
   * Empty or absent → no strip.
   */
  strip_image_urls?: string[];
}

/** A standalone piece that never clustered, with its one reason for standing alone. */
export interface CodexWorthReadingItem {
  article: ArticleSummary;
  reason: string;
}

/** Derived counters shown in the UI — computed in the pipeline, not by the LLM. */
export interface CodexDigestStats {
  /** Estimated reading time of the Development source articles Codex folded in. */
  minutes_condensed: number;
  /** How many Development write-ups that time is spread across. */
  articles_condensed: number;
  /** True when minutes_condensed hit the cap — render as "~N+ min". */
  minutes_capped: boolean;
}

/** The self-contained, persisted digest payload (Phase 2 output + resolved articles). */
export interface CodexDigestPayload {
  /**
   * Short front-page headline — the digest's <h1>. Empty or absent on pre-headline digests;
   * fall back to `gist` in that case.
   */
  headline?: string;
  /** One-to-two-sentence framing of the day — the standfirst under the headline. */
  gist: string;
  scale_setter: string;
  developments: CodexDevelopment[];
  worth_reading: CodexWorthReadingItem[];
  closing_line: string;
  /** Phase 1 "today's keywords" tags. Empty when nothing recurred; absent on pre-themes digests. */
  themes: string[];
  /** Null on quiet days (nothing condensed) and on pre-stats digests. */
  stats: CodexDigestStats | null;
}

/** GET /codex/today and POST /codex/generate response — the latest digest edition, any status. */
export interface CodexDigestResponse {
  id: string;
  /** The reader's local calendar day this digest belongs to (quota bucket). */
  digest_date: string;
  /** 1-based edition within `digest_date` — Pro can hold 2, Basic 1. */
  edition: number;
  status: CodexDigestStatus;
  progress_phase: CodexDigestPhase | null;
  requested_at: string;
  generated_at: string | null;
  model: string | null;
  window_hours: number | null;
  input_article_count: number | null;
  input_source_count: number | null;
  clusters_found: number | null;
  payload: CodexDigestPayload | null;
  error: string | null;
}

/** Returned by POST /codex/generate (202) instead of a digest when the user can't generate. */
export interface CodexNotEntitledResponse {
  entitled: false;
  reason: string;
  error_code: string;
}

export type CodexGenerateResult = CodexDigestResponse | CodexNotEntitledResponse;

export function isCodexNotEntitled(
  result: CodexGenerateResult
): result is CodexNotEntitledResponse {
  return (result as CodexNotEntitledResponse).entitled === false;
}

// ── /users/limits codex allowance ────────────────────────────────────────────
// Shape differs by role (see server/app/services/user/resource_limits.py):
//   Basic → { period: "month", limit, used, used_today }  (1 digest/local-day, `limit` COMPLETED/month)
//   Pro   → { period: "day",   limit, used }              (`used` = today's edition count, of `limit`)
//   Admin → { unlimited: true }
// Pass ?local_date=YYYY-MM-DD to /users/limits so `used`/`used_today` reset at the user's midnight.

export interface CodexMeteredUsage {
  period: 'month' | 'day';
  limit: number;
  used: number;
  /** Basic only: whether today's single local-day digest is already spent (0 or 1). */
  used_today?: number;
}

export interface CodexUnlimitedUsage {
  unlimited: true;
}

export type CodexUsage = CodexMeteredUsage | CodexUnlimitedUsage;

/** Basic gets { per_day, per_month }; Pro gets { per_day }; Admin gets {}. */
export interface CodexAllowance {
  per_day?: number;
  per_month?: number;
}

export function isCodexUnlimited(usage: CodexUsage): usage is CodexUnlimitedUsage {
  return (usage as CodexUnlimitedUsage).unlimited === true;
}
