import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { ApiClient, ApiError } from '../client';
import { queryKeys } from '../query-keys';
import {
  CodexDigestStatus,
  isCodexNotEntitled,
  type CodexDigestResponse,
  type CodexGenerateResult,
  type CodexPreferences,
} from '../types/codex';

const TERMINAL_STATUSES: readonly CodexDigestStatus[] = [
  CodexDigestStatus.COMPLETED,
  CodexDigestStatus.FAILED,
  CodexDigestStatus.SKIPPED,
];

export function isCodexDigestTerminal(status: CodexDigestStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Poll cadence while a digest is in flight. PENDING is a queue state that flips as soon as a
 * worker picks the task up (often <1s, and a "quiet day" can go PENDING → SKIPPED almost
 * immediately), so poll it tightly — otherwise the "Building…" screen lingers for a full
 * interval after the digest is already done. IN_PROGRESS is the real ~1min job; a slower beat
 * is fine there.
 */
const CODEX_POLL_MS: Record<'pending' | 'in_progress', number> = {
  pending: 1200,
  in_progress: 3000,
};

/**
 * Poll the user's latest Codex digest. Polls while the digest is PENDING / IN_PROGRESS (see
 * CODEX_POLL_MS) and stops once it reaches a terminal status (completed/failed/skipped).
 * A 404 (no digest ever requested) resolves to `null` rather than throwing, so callers can
 * render the empty state without a try/catch.
 */
export function useCodexToday(
  options?: Omit<
    UseQueryOptions<
      CodexDigestResponse | null,
      Error,
      CodexDigestResponse | null,
      ReturnType<typeof queryKeys.codexToday>
    >,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.codexToday(),
    queryFn: async () => {
      try {
        return await ApiClient.getCodexToday();
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || isCodexDigestTerminal(data.status)) return false;
      return data.status === CodexDigestStatus.PENDING
        ? CODEX_POLL_MS.pending
        : CODEX_POLL_MS.in_progress;
    },
    // Generation is a ~1min server job — users routinely switch tabs while it runs.
    // Keep polling in a backgrounded tab so they return to a finished digest rather
    // than a frozen "Building…" screen, and re-sync on focus as a backstop.
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: (query) => {
      const data = query.state.data;
      return !!data && !isCodexDigestTerminal(data.status);
    },
    retry: false,
    ...options,
  });
}

/**
 * Kick off a digest generation. Idempotent server-side: within the tier's rolling-window cap
 * a repeat request while one is in flight returns the existing row. On a digest result (not a
 * not-entitled payload) the `codex-today` query is seeded and invalidated so polling picks up
 * the new PENDING row immediately. Pass a `YYYY-MM-DD` string to override the local-day label
 * (defaults to today); it does not affect the quota.
 */
export function useGenerateCodexDigest(
  options?: UseMutationOptions<CodexGenerateResult, Error, string | void>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (localDate?: string | void) =>
      ApiClient.generateCodexDigest(typeof localDate === 'string' ? localDate : undefined),
    onSuccess: (result) => {
      if (!isCodexNotEntitled(result)) {
        queryClient.setQueryData(queryKeys.codexToday(), result);
      }
    },
    onSettled: () => {
      return queryClient.invalidateQueries({ queryKey: queryKeys.codexToday() });
    },
    ...options,
  });
}

/**
 * The caller's digest preferences (the folders excluded from the daily digest). A user who
 * has never saved any gets `{ excluded_folder_ids: [] }`. Long staleTime — this only changes
 * when the user edits it in the settings dialog, which invalidates the query itself.
 */
export function useCodexPreferences(
  options?: Omit<
    UseQueryOptions<
      CodexPreferences,
      Error,
      CodexPreferences,
      ReturnType<typeof queryKeys.codexPreferences>
    >,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.codexPreferences(),
    queryFn: () => ApiClient.getCodexPreferences(),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Replace the excluded-folder set. On success the preferences query is seeded from the
 * server's echo; `onSettled` invalidates both it and `codex-today` (the next generated
 * digest reflects the new exclusions, and any stale digest view should re-check).
 */
export function useUpdateCodexPreferences(
  options?: UseMutationOptions<CodexPreferences, Error, CodexPreferences>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: CodexPreferences) => ApiClient.updateCodexPreferences(prefs),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.codexPreferences(), result);
    },
    onSettled: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.codexPreferences() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.codexToday() }),
      ]);
    },
    ...options,
  });
}
