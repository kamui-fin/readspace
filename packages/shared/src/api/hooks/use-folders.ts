import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { ApiClient } from "../client";
import { RSS_QUERY_KEYS, mutationKeys, queryKeys } from "../query-keys";
import type { Folder, Subscription } from "../types";

export function createFolderHooks() {
  function useFolders(
    options?: Omit<
      UseQueryOptions<
        Folder[],
        Error,
        Folder[],
        ReturnType<typeof queryKeys.folders>
      >,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: queryKeys.folders(),
      queryFn: () => ApiClient.getFolders() as Promise<Folder[]>,
      ...options,
    });
  }

  function useCreateFolder(
    options?: UseMutationOptions<Folder, unknown, { name: string }>,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationKey: mutationKeys.createFolder(),
      mutationFn: (folder: { name: string }) => ApiClient.createFolder(folder),
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.folders(),
        });
      },
      ...options,
    });
  }

  function useUpdateFolder(
    options?: UseMutationOptions<
      Folder,
      unknown,
      { folderId: string; name: string },
      unknown
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationKey: mutationKeys.updateFolder(),
      mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
        ApiClient.updateFolder(folderId, { name }),
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.folders(),
        });
      },
      ...options,
    });
  }

  function useDeleteFolder(
    options?: UseMutationOptions<void, unknown, string, unknown>,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationKey: mutationKeys.deleteFolder(),
      mutationFn: async (folderId: string) => {
        const response = await ApiClient.deleteFolder(folderId);
        return response;
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.folders() });
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
        queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
      },
      ...options,
    });
  }

  function useMarkFolderAllRead(
    options?: UseMutationOptions<
      { message: string; folder_id: string; updated_subscriptions: number },
      unknown,
      string
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationKey: mutationKeys.markFolderAllRead(),
      mutationFn: (folderId: string) => ApiClient.markFolderAllRead(folderId),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
        queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
      },
      ...options,
    });
  }

  return {
    useFolders,
    useCreateFolder,
    useUpdateFolder,
    useDeleteFolder,
    useMarkFolderAllRead,
  };
}
