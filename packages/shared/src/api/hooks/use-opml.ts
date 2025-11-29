import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiClient } from "../client";
import { queryKeys } from "../query-keys";
import type {
  ImportStatus,
  OpmlImportResponse,
  OpmlTaskMetadata,
  OpmlImportCancelResponse,
  OpmlImportStatusResponse,
} from "../types";

export function useImportOPML(
  options?: UseMutationOptions<OpmlImportResponse, unknown, FormData>,
) {
  return useMutation({
    mutationFn: (formData: FormData) =>
      ApiClient.importOPML(formData) as Promise<OpmlImportResponse>,
    ...options,
  });
}

export function useImportTaskStatus(
  taskId: string | null,
  enabled: boolean = true,
  options?: Omit<
    UseQueryOptions<
      OpmlImportStatusResponse,
      Error,
      OpmlImportStatusResponse,
      ReturnType<typeof queryKeys.opmlImportStatus>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: queryKeys.opmlImportStatus(taskId),
    queryFn: () =>
      ApiClient.getImportTaskStatus(taskId!) as Promise<OpmlImportStatusResponse>,
    enabled: !!taskId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.status !== "in_progress") {
        return false;
      }
      return 3000;
    },
    retry: false, // Don't retry failed status checks
    ...options,
  });
}

export function useActiveImportTask(
  options?: Omit<
    UseQueryOptions<
      OpmlTaskMetadata | null,
      Error,
      OpmlTaskMetadata | null,
      ReturnType<typeof queryKeys.opmlImportTasks>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: queryKeys.opmlImportTasks(),
    queryFn: () => ApiClient.getActiveImportTask(),
    refetchInterval: 5000, // Poll every 5 seconds
    ...options,
  });
}

export function useCancelImportTask(
  options?: UseMutationOptions<OpmlImportCancelResponse, unknown, string>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      ApiClient.cancelImportTask(taskId) as Promise<OpmlImportCancelResponse>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opmlImportTasks() });
    },
    ...options,
  });
}
