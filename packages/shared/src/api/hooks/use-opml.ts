import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { ApiClient } from "../client";
import { queryKeys } from "../query-keys";
import type {
  ImportStatus,
  OpmlImportResponse,
  OpmlTaskMetadata,
} from "../types";

export function createOpmlHooks() {
  function useImportOPML(
    options?: UseMutationOptions<OpmlImportResponse, unknown, FormData>,
  ) {
    return useMutation({
      mutationFn: (formData: FormData) =>
        ApiClient.importOPML(formData) as Promise<OpmlImportResponse>,
      ...options,
    });
  }

  function useImportTaskStatus(
    taskId: string | null,
    enabled: boolean = true,
    options?: Omit<
      UseQueryOptions<
        ImportStatus,
        Error,
        ImportStatus,
        ReturnType<typeof queryKeys.opmlImportStatus>
      >,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: queryKeys.opmlImportStatus(taskId),
      queryFn: () =>
        ApiClient.getImportTaskStatus(taskId!) as Promise<ImportStatus>,
      enabled: !!taskId && enabled,
      refetchInterval: 3000, // Poll every 3 seconds
      retry: false, // Don't retry failed status checks
      ...options,
    });
  }

  function useActiveImportTask(
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

  return {
    useImportOPML,
    useImportTaskStatus,
    useActiveImportTask,
  };
}
