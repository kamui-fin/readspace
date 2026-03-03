import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { ApiClient } from "../client";
import { RSS_QUERY_KEYS, mutationKeys, queryKeys } from "../query-keys";
import type { Folder, FeedsResponse } from "../types";

export function useCreateFolder(
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.feeds(),
      });
    },
    ...options,
  });
}

export function useUpdateFolder(
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.feeds(),
      });
    },
    ...options,
  });
}

export function useDeleteFolder(
  options?: UseMutationOptions<void, unknown, string, unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.deleteFolder(),
    mutationFn: async (folderId: string) => {
      const response = await ApiClient.deleteFolder(folderId);
      return response;
    },
    onSuccess: (_, folderId) => {
      console.log('useDeleteFolder onSuccess TRIGGERED for:', folderId);
      queryClient.setQueriesData<FeedsResponse>(
        { queryKey: [RSS_QUERY_KEYS.FEEDS] },
        (old) => {
          console.log('Updating feeds data, old is:', !!old);
          if (!old) return old;
          return {
            ...old,
            folders: old.folders.filter((f) => f.id !== folderId),
            subscriptions: old.subscriptions.filter(
              (s) => s.folder?.id !== folderId,
            ),
          };
        },
      );
      queryClient.setQueriesData<Folder[]>(
        { queryKey: queryKeys.folders() },
        (old) => {
          console.log('Updating folders data, old is:', !!old);
          if (!old) return old;
          return old.filter((f) => f.id !== folderId);
        },
      );
    },
    onSettled: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.folders() });
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
        queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
      }, 300);
    },
    ...options,
  });
}

export function useMarkFolderAllRead(
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
