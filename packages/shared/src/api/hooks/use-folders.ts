import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { ApiClient } from '../client';
import { RSS_QUERY_KEYS, mutationKeys, queryKeys } from '../query-keys';
import type { Folder } from '../types';

export function useCreateFolder(options?: UseMutationOptions<Folder, unknown, { name: string }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.createFolder(),
    mutationFn: (folder: { name: string }) => ApiClient.createFolder(folder),
    onSettled: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.folders() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.feeds() }),
      ]);
    },
    ...options,
  });
}

export function useUpdateFolder(
  options?: UseMutationOptions<Folder, unknown, { folderId: string; name: string }, unknown>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.updateFolder(),
    mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
      ApiClient.updateFolder(folderId, { name }),
    onSettled: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.folders() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.feeds() }),
      ]);
    },
    ...options,
  });
}

export function useDeleteFolder(options?: UseMutationOptions<void, unknown, string, unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.deleteFolder(),
    mutationFn: (folderId: string) => ApiClient.deleteFolder(folderId),
    // No manual cache surgery — see useUpdateFeed in use-feeds.ts for why. A plain
    // awaited invalidate means the mutation doesn't resolve until the UI is guaranteed
    // to reflect the server's actual state, instead of a hand-reshaped guess at it.
    onSettled: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.folders() }),
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS, 'list'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() }),
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] }),
      ]);
    },
    ...options,
  });
}

export function useMarkFolderAllRead(
  options?: UseMutationOptions<
    { message: string; folder_id: string; updated_subscriptions: number },
    unknown,
    string
  >
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
