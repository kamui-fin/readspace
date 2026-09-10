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
 * Poll the user's latest Codex digest. Mirrors useImportTaskStatus's refetch cadence:
 * `false` once the digest reaches a terminal status (completed/failed/skipped), else 3000ms.
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
      if (!data) return false;
      return isCodexDigestTerminal(data.status) ? false : 3000;
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
 * Kick off a digest generation for the caller's local day. Idempotent server-side up to the
 * tier's per-day edition cap. On a digest result (not a not-entitled payload) the
 * `codex-today` query is seeded and invalidated so polling picks up the new PENDING row
 * immediately. Pass a `YYYY-MM-DD` string to override the local day (defaults to today).
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
