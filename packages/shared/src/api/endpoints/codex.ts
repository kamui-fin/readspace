import { ApiClient } from '../core';
import type { CodexDigestResponse, CodexGenerateResult, CodexPreferences } from '../types/codex';

/**
 * The caller's local calendar day as `YYYY-MM-DD`. Sent on generate so the digest gets the
 * right "which day's news" label; it does NOT drive the quota (that's a server-clock rolling
 * window — see server/app/services/user/resource_limits.py).
 */
export function localDayString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const codex = {
  /**
   * Enqueue a digest generation. The allowance is a rolling server-clock window (a little
   * under 24h) — a repeat request while one is in flight, or once the window cap is hit,
   * returns the existing row. May return a not-entitled payload (quota hit or AI disabled)
   * with a 202, so callers must narrow with isCodexNotEntitled.
   */
  generateCodexDigest: (localDate: string = localDayString()) =>
    ApiClient.post<CodexGenerateResult>('/api/codex/generate', { local_date: localDate }),
  /** Latest digest row for the user, any status. 404 if none has ever been requested. */
  getCodexToday: () => ApiClient.get<CodexDigestResponse>('/api/codex/today'),
  /** The caller's digest preferences (excluded folders). Defaults to an empty set. */
  getCodexPreferences: () => ApiClient.get<CodexPreferences>('/api/codex/preferences'),
  /**
   * Replace the caller's excluded-folder set wholesale. Ids must belong to the caller.
   * Takes effect on the next digest generation.
   */
  updateCodexPreferences: (data: CodexPreferences) =>
    ApiClient.put<CodexPreferences>('/api/codex/preferences', data),
};
