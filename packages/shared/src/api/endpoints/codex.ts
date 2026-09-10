import { ApiClient } from '../core';
import type { CodexDigestResponse, CodexGenerateResult } from '../types/codex';

/** The caller's local calendar day as `YYYY-MM-DD` (used as the Codex per-day quota bucket). */
export function localDayString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const codex = {
  /**
   * Enqueue a digest generation for the caller's local day. Idempotent within that day up to
   * the tier's per-day edition cap — a repeat request past the cap returns the existing row.
   * May return a not-entitled payload (quota hit or AI disabled) with a 202, so callers must
   * narrow with isCodexNotEntitled.
   */
  generateCodexDigest: (localDate: string = localDayString()) =>
    ApiClient.post<CodexGenerateResult>('/api/codex/generate', { local_date: localDate }),
  /** Latest digest row for the user, any status. 404 if none has ever been requested. */
  getCodexToday: () => ApiClient.get<CodexDigestResponse>('/api/codex/today'),
};
