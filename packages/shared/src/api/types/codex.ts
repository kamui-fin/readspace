import type { ArticleSummary } from './articles';

// Codex Digest types — mirror server/app/typing/codex.py and server/app/models/enums.py.
// Keep these in lockstep with the backend.

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
  /** The reader's local calendar day this digest is labelled for — display only, not a quota key. */
  digest_date: string;
  /** 1-based edition within `digest_date`. */
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

/**
 * GET/PUT /codex/preferences — the user's digest knobs. `excluded_folder_ids` are the folders
 * whose feeds are left out of the daily digest; an empty array means every folder is included.
 * Changes take effect on the next digest generation, not retroactively.
 */
export interface CodexPreferences {
  excluded_folder_ids: string[];
}

// ── /users/limits codex allowance ────────────────────────────────────────────
// The generation cap is a SERVER-CLOCK ROLLING WINDOW (`window_hours`, a little under a day),
// not a calendar day — it can't be moved by changing the device clock/timezone, and it resets
// continuously as old generations age out of the window. Shape differs by role
// (server/app/services/user/resource_limits.py):
//   Basic → { period: "month", limit, used, used_in_window, window_hours }
//           (`used` = COMPLETED this calendar month of `limit`; `used_in_window` = 0 or 1)
//   Pro   → { period: "window", window_hours, limit, used }
//           (`used` = generations in the trailing `window_hours`, of `limit`)
//   Admin → { unlimited: true }

export interface CodexMeteredUsage {
  period: 'month' | 'window';
  limit: number;
  used: number;
  /** Length of the rolling generation window, in hours. */
  window_hours?: number;
  /** Basic only: whether this window's single generation is already spent (0 or 1). */
  used_in_window?: number;
}

export interface CodexUnlimitedUsage {
  unlimited: true;
}

export type CodexUsage = CodexMeteredUsage | CodexUnlimitedUsage;

/** Basic gets { per_window, per_month }; Pro gets { per_window }; Admin gets {}. */
export interface CodexAllowance {
  per_window?: number;
  per_month?: number;
}

export function isCodexUnlimited(usage: CodexUsage): usage is CodexUnlimitedUsage {
  return (usage as CodexUnlimitedUsage).unlimited === true;
}
