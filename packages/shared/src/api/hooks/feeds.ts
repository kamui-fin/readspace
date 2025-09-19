import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryFunctionContext,
  type UseInfiniteQueryOptions,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { ClientProvider } from "../client-provider";
import { RSS_QUERY_KEYS } from "../query-keys";
import type {
  Article,
  Feed,
  Folder,
  ImportTaskStatus,
  OPMLImportResponse,
  PaginatedResponse,
  SidebarData,
  UnreadCounts,
} from "../types";

// Configuration interface for platform-specific callbacks
export interface FeedHooksConfig {
  // Toast/notification callbacks
  showSuccess?: (message: string) => void;
  showError?: (message: string) => void;

  // Platform-specific delays
  deletionDelay?: number;
  refreshDelay?: number;
}

// Default configuration
const defaultConfig: FeedHooksConfig = {
  showSuccess: () => {}, // No-op by default
  showError: () => {}, // No-op by default
  deletionDelay: 150,
  refreshDelay: 200,
};

// Hook factory function
function createFeedHooks(userConfig: FeedHooksConfig = {}) {
  const config = { ...defaultConfig, ...userConfig };

  // OPML Import hooks
  function useImportOPML(
    options?: UseMutationOptions<OPMLImportResponse, unknown, FormData>,
  ) {
    return useMutation({
      mutationFn: (formData: FormData) =>
        ClientProvider.getClient().rss.importOPML(formData) as Promise<OPMLImportResponse>,
      onSuccess: () => {
        // All imports are background now - queries will be invalidated when task completes
        // No immediate invalidation needed
      },
      ...options,
    });
  }

  function useImportTaskStatus(
    taskId: string | null,
    enabled: boolean = true,
    options?: Omit<
      UseQueryOptions<
        ImportTaskStatus,
        Error,
        ImportTaskStatus,
        [string, string | null]
      >,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.OPML_IMPORT_STATUS, taskId],
      queryFn: () =>
        ClientProvider.getClient().rss.getImportTaskStatus(taskId!) as Promise<ImportTaskStatus>,
      enabled: !!taskId && enabled,
      refetchInterval: 3000, // Poll every 3 seconds
      retry: false, // Don't retry failed status checks
      ...options,
    });
  }

  // Folder hooks
  function useFolders(
    options?: Omit<
      UseQueryOptions<Folder[], Error, Folder[], [string]>,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.FOLDERS],
      queryFn: () => ClientProvider.getClient().rss.getFolders() as Promise<Folder[]>,
      ...options,
    });
  }

  function useCreateFolder(
    options?: UseMutationOptions<
      Folder,
      unknown,
      { name: string },
      { previousFolders: Folder[] | undefined }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (folder: { name: string }) =>
        ClientProvider.getClient().rss.createFolder(folder),
      onMutate: async () => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FOLDERS],
        });

        // Snapshot the previous value
        const previousFolders = queryClient.getQueryData<Folder[]>([
          RSS_QUERY_KEYS.FOLDERS,
        ]);

        // Don't do optimistic updates for folders to avoid "not found" errors
        // The UI will update when the server responds

        // Return a context object with the snapshotted value
        return { previousFolders };
      },
      onError: (_, __, context) => {
        // If the mutation fails, use the context returned from onMutate to roll back
        if (context?.previousFolders) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FOLDERS],
            context.previousFolders,
          );
        }
        config.showError?.("Failed to create folder");
      },
      onSuccess: () => {
        config.showSuccess?.("Folder created successfully");
      },
      onSettled: () => {
        // Only invalidate specific queries, don't remove cache to avoid skeleton reloading
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FOLDERS],
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
      {
        previousFolders: Folder[] | undefined;
        previousSidebarData: SidebarData | undefined;
        folderId: string;
        name: string;
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
        ClientProvider.getClient().rss.updateFolder(folderId, { name }),
      onMutate: async ({ folderId, name }) => {
        // Cancel any outgoing refetches to prevent conflicts
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FOLDERS],
        });
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
        });

        // Snapshot the previous values
        const previousFolders = queryClient.getQueryData<Folder[]>([
          RSS_QUERY_KEYS.FOLDERS,
        ]);
        const previousSidebarData = queryClient.getQueryData<SidebarData>([
          RSS_QUERY_KEYS.SIDEBAR_DATA,
        ]);

        // Optimistically update the folder name in folders cache
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FOLDERS],
          (old: Folder[] | undefined) => {
            if (!old) return old;
            return old.map((folder: Folder) =>
              folder.id === folderId ? { ...folder, name } : folder,
            );
          },
        );

        // Optimistically update the folder name in sidebar data
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.SIDEBAR_DATA],
          (old: SidebarData | undefined) => {
            if (!old) return old;
            return {
              ...old,
              folders: old.folders
                ? old.folders.map((folder: Folder) =>
                    folder.id === folderId ? { ...folder, name } : folder,
                  )
                : [],
            };
          },
        );

        return { previousFolders, previousSidebarData, folderId, name };
      },
      onError: (_, __, context) => {
        // Rollback on error
        if (context?.previousFolders) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FOLDERS],
            context.previousFolders,
          );
        }
        if (context?.previousSidebarData) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.SIDEBAR_DATA],
            context.previousSidebarData,
          );
        }
        config.showError?.("Failed to rename folder");
      },
      onSuccess: () => {
        config.showSuccess?.("Folder renamed successfully");
      },
      ...options,
    });
  }

  function useDeleteFolder(
    options?: UseMutationOptions<
      void,
      unknown,
      string,
      {
        previousFolders: Folder[] | undefined;
        previousSidebarData: SidebarData | undefined;
        previousFeeds: Feed[] | undefined;
        previousUnreadCounts: UnreadCounts | undefined;
        folderId: string;
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (folderId: string) => {
        // Add a small delay for more natural feel
        await new Promise((resolve) =>
          setTimeout(resolve, config.deletionDelay),
        );
        const response = await ClientProvider.getClient().rss.deleteFolder(folderId);
        return response;
      },
      onMutate: async (folderId) => {
        // Cancel any outgoing refetches to prevent conflicts
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FOLDERS],
        });
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
        });
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });

        // Snapshot the previous values
        const previousFolders = queryClient.getQueryData<Folder[]>([
          RSS_QUERY_KEYS.FOLDERS,
        ]);
        const previousSidebarData = queryClient.getQueryData<SidebarData>([
          RSS_QUERY_KEYS.SIDEBAR_DATA,
        ]);
        const previousFeeds = queryClient.getQueryData<Feed[]>([
          RSS_QUERY_KEYS.FEEDS,
        ]);
        const previousUnreadCounts = queryClient.getQueryData<UnreadCounts>([
          RSS_QUERY_KEYS.UNREAD_COUNTS,
        ]);

        // Optimistically remove the folder from all caches
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FOLDERS],
          (old: Folder[] | undefined) => {
            if (!old) return [];
            return old.filter((folder: Folder) => folder.id !== folderId);
          },
        );

        // Remove folder and its feeds from sidebar data
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.SIDEBAR_DATA],
          (old: SidebarData | undefined) => {
            if (!old) return old;
            return {
              ...old,
              folders: old.folders
                ? old.folders.filter((folder: Folder) => folder.id !== folderId)
                : [],
              feeds: old.feeds
                ? old.feeds.filter((feed: Feed) => feed.folder_id !== folderId)
                : [],
            };
          },
        );

        // Remove feeds from the folder from feeds cache
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FEEDS],
          (old: Feed[] | undefined) => {
            if (!old) return [];
            return old.filter((feed: Feed) => feed.folder_id !== folderId);
          },
        );

        // Update unread counts to remove counts for this folder
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.UNREAD_COUNTS],
          (old: UnreadCounts | undefined) => {
            if (!old) return old;
            // Remove folder-specific unread counts
            const newCounts = { ...old };
            if (
              newCounts.unread_by_folder &&
              Array.isArray(newCounts.unread_by_folder)
            ) {
              newCounts.unread_by_folder = newCounts.unread_by_folder.filter(
                (item: { folder_id: string; unread_count: number }) =>
                  item.folder_id !== folderId,
              );
            }
            return newCounts;
          },
        );

        return {
          previousFolders,
          previousSidebarData,
          previousFeeds,
          previousUnreadCounts,
          folderId,
        };
      },
      onError: (_, __, context) => {
        // Rollback on error
        if (context?.previousFolders) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FOLDERS],
            context.previousFolders,
          );
        }
        if (context?.previousSidebarData) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.SIDEBAR_DATA],
            context.previousSidebarData,
          );
        }
        if (context?.previousFeeds) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS],
            context.previousFeeds,
          );
        }
        if (context?.previousUnreadCounts) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.UNREAD_COUNTS],
            context.previousUnreadCounts,
          );
        }
        config.showError?.("Failed to delete folder");
      },
      onSuccess: () => {
        config.showSuccess?.("Folder deleted successfully");
      },
      onSettled: () => {
        // Invalidate unread counts to ensure they're refreshed
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
        // Invalidate articles to refetch current view
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });
        // Invalidate folders to ensure sidebar updates
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FOLDERS],
        });
        // Invalidate feeds to ensure sidebar updates
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
      },
      ...options,
    });
  }

  // Feed hooks
  function useFeeds(
    params?: {
      folderId?: string;
      tagNames?: string[];
      isFavorite?: boolean;
      searchQuery?: string;
    },
    options?: Omit<
      UseQueryOptions<Feed[], Error, Feed[], [string, typeof params]>,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.FEEDS, params],
      queryFn: () =>
        ClientProvider.getClient().rss.getFeeds({
          folder_id: params?.folderId,
          tag_names: params?.tagNames,
          is_favorite: params?.isFavorite,
          search_query: params?.searchQuery,
        }) as Promise<Feed[]>,
      ...options,
    });
  }

  function useFeed(
    feedId: string,
    options?: Omit<
      UseQueryOptions<Feed, Error, Feed, [string, string]>,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
      queryFn: () => ClientProvider.getClient().rss.getFeed(feedId),
      enabled: !!feedId,
      ...options,
    });
  }

  function useCreateFeed(
    options?: UseMutationOptions<
      Feed,
      unknown,
      {
        url: string;
        folder_id?: string;
        silent?: boolean;
      },
      { previousFeeds: Feed[] | undefined }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (feed: {
        url: string;
        folder_id?: string;
        silent?: boolean;
      }) => ClientProvider.getClient().rss.createFeed(feed),
      onMutate: async () => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });

        // Snapshot the previous value
        const previousFeeds = queryClient.getQueryData<Feed[]>([
          RSS_QUERY_KEYS.FEEDS,
        ]);

        // Don't do optimistic updates for feeds to avoid issues with fast clicking
        // The UI will update when the server responds

        // Return a context object with the snapshotted value
        return { previousFeeds };
      },
      onError: (_, __, context) => {
        // If the mutation fails, use the context returned from onMutate to roll back
        if (context?.previousFeeds) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS],
            context.previousFeeds,
          );
        }
        // Error toast is handled elsewhere - keep it configurable
      },
      onSuccess: () => {
        // Success toast is handled by the component or can be configured
      },
      onSettled: () => {
        // Only invalidate specific queries, don't remove cache to avoid skeleton reloading
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
        });
      },
      ...options,
    });
  }

  function useUpdateFeed(
    options?: UseMutationOptions<
      Feed,
      unknown,
      {
        feedId: string;
        data: {
          folder_id?: string;
          is_favorite?: boolean;
          title?: string;
        };
        silent?: boolean;
      },
      {
        previousFeeds: Feed[] | undefined;
        previousFeed: Feed | undefined;
        previousUnreadCounts: UnreadCounts | undefined;
        feedId: string;
        data: {
          folder_id?: string;
          is_favorite?: boolean;
          title?: string;
        };
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({
        feedId,
        data,
      }: {
        feedId: string;
        data: {
          folder_id?: string;
          is_favorite?: boolean;
          title?: string;
        };
        silent?: boolean;
      }) => ClientProvider.getClient().rss.updateFeed(feedId, data),
      onMutate: async ({ feedId, data }) => {
        // Cancel any outgoing refetches to prevent conflicts
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
        });
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });

        // Snapshot the previous values
        const previousFeeds = queryClient.getQueryData<Feed[]>([
          RSS_QUERY_KEYS.FEEDS,
        ]);
        const previousFeed = queryClient.getQueryData<Feed>([
          RSS_QUERY_KEYS.FEEDS,
          feedId,
        ]);
        const previousUnreadCounts = queryClient.getQueryData<UnreadCounts>([
          RSS_QUERY_KEYS.UNREAD_COUNTS,
        ]);

        // Optimistically update the feed in feeds cache
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FEEDS],
          (old: Feed[] | undefined) => {
            if (!old) return old;
            return old.map((feed: Feed) =>
              feed.id === feedId ? { ...feed, ...data } : feed,
            );
          },
        );

        // Optimistically update individual feed cache
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FEEDS, feedId],
          (old: Feed | undefined) => {
            if (!old) return old;
            return { ...old, ...data };
          },
        );

        return {
          previousFeeds,
          previousFeed,
          previousUnreadCounts,
          feedId,
          data,
        };
      },
      onError: (_, __, context) => {
        // Rollback on error
        if (context?.previousFeeds) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS],
            context.previousFeeds,
          );
        }
        if (context?.previousFeed) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS, context.feedId],
            context.previousFeed,
          );
        }
        if (context?.previousUnreadCounts) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.UNREAD_COUNTS],
            context.previousUnreadCounts,
          );
        }
        config.showError?.("Failed to update feed");
      },
      onSuccess: (_, { data, silent }) => {
        if (!silent) {
          if (data.title) {
            config.showSuccess?.("Feed renamed successfully");
          } else {
            config.showSuccess?.("Feed updated successfully");
          }
        }
      },
      onSettled: () => {
        // Invalidate all relevant queries to ensure sidebar and manage page stay in sync
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FOLDERS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
      },
      ...options,
    });
  }

  function useRefreshFeed(
    options?: UseMutationOptions<
      void,
      unknown,
      {
        feedId: string;
        forceRefetch?: boolean;
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({
        feedId,
        forceRefetch = false,
      }: {
        feedId: string;
        forceRefetch?: boolean;
      }) => {
        await ClientProvider.getClient().rss.refreshFeed(feedId, forceRefetch);
      },
      onSuccess: (_, { feedId }) => {
        config.showSuccess?.(
          `Feed '${feedId.substring(0, 8)}...' refresh initiated.`,
        );
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS, feedId],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
      },
      onError: (error: unknown, { feedId }) => {
        const errorMessage =
          (error as { response?: { data?: { detail?: string } } })?.response
            ?.data?.detail ||
          `Failed to refresh feed '${feedId.substring(0, 8)}...'.`;
        config.showError?.(errorMessage);
      },
      ...options,
    });
  }

  function useRefreshFolderFeeds(
    options?: UseMutationOptions<unknown, unknown, string>,
  ) {
    return useMutation({
      mutationFn: (folderId: string) =>
        ClientProvider.getClient().rss.refreshFolderFeeds(folderId),
      onSuccess: (data) => {
        config.showSuccess?.(
          "Folder refresh started! Check status for progress.",
        );
        return data;
      },
      onError: (error: unknown) => {
        const errorMessage =
          (error as { response?: { data?: { detail?: string } } })?.response
            ?.data?.detail || "Failed to start folder refresh.";
        config.showError?.(errorMessage);
      },
      ...options,
    });
  }

  function useRefreshAllFeeds(
    options?: UseMutationOptions<unknown, unknown, void>,
  ) {
    return useMutation({
      mutationFn: () => ClientProvider.getClient().rss.refreshAllFeeds(),
      onSuccess: (data) => {
        config.showSuccess?.(
          "All feeds refresh started! Check status for progress.",
        );
        return data;
      },
      onError: (error: unknown) => {
        const errorMessage =
          (error as { response?: { data?: { detail?: string } } })?.response
            ?.data?.detail || "Failed to start all feeds refresh.";
        config.showError?.(errorMessage);
      },
      ...options,
    });
  }

  function useRefreshStatus(
    taskId: string | null,
    enabled: boolean = true,
    options?: Omit<
      UseQueryOptions<unknown, Error, unknown, [string, string | null]>,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.REFRESH_STATUS, taskId],
      queryFn: () =>
        ClientProvider.getClient().rss.getRefreshStatus(taskId!) as Promise<unknown>,
      enabled: enabled && !!taskId,
      refetchInterval: 2000, // Poll every 2 seconds
      refetchIntervalInBackground: false,
      ...options,
    });
  }

  function useDeleteFeed(
    options?: UseMutationOptions<
      { feedId: string; silent: boolean },
      unknown,
      {
        feedId: string;
        silent?: boolean;
      },
      {
        previousFeeds: Feed[] | undefined;
        previousUnreadCounts: UnreadCounts | undefined;
        feedId: string;
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({
        feedId,
        silent = false,
      }: {
        feedId: string;
        silent?: boolean;
      }) => {
        // Add a small delay for more natural feel
        await new Promise((resolve) =>
          setTimeout(resolve, config.deletionDelay),
        );
        await ClientProvider.getClient().rss.deleteFeed(feedId);
        return { feedId, silent };
      },
      onMutate: async ({ feedId }) => {
        // Cancel any outgoing refetches to prevent conflicts
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
        await queryClient.cancelQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });

        // Snapshot the previous values
        const previousFeeds = queryClient.getQueryData<Feed[]>([
          RSS_QUERY_KEYS.FEEDS,
        ]);
        const previousUnreadCounts = queryClient.getQueryData<UnreadCounts>([
          RSS_QUERY_KEYS.UNREAD_COUNTS,
        ]);

        // Optimistically remove the feed from feeds list
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.FEEDS],
          (old: Feed[] | undefined) => {
            if (!old) return [];
            return old.filter((feed: Feed) => feed.id !== feedId);
          },
        );

        // Get the feed being deleted to remove its unread count
        const feedBeingDeleted = Array.isArray(previousFeeds)
          ? (previousFeeds as Feed[]).find((feed: Feed) => feed.id === feedId)
          : (null as Feed | null);

        // Optimistically update unread counts
        queryClient.setQueryData(
          [RSS_QUERY_KEYS.UNREAD_COUNTS],
          (old: UnreadCounts | undefined) => {
            if (!old || !feedBeingDeleted) return old;

            const updatedCounts = { ...old };

            // Reduce total unread count
            if (updatedCounts.total_unread && feedBeingDeleted.unread_count) {
              updatedCounts.total_unread = Math.max(
                0,
                updatedCounts.total_unread - feedBeingDeleted.unread_count,
              );
            }

            // Reduce folder unread count if the feed was in a folder
            if (
              updatedCounts.unread_by_folder &&
              feedBeingDeleted.folder_id &&
              feedBeingDeleted.unread_count
            ) {
              updatedCounts.unread_by_folder =
                updatedCounts.unread_by_folder.map(
                  (folder: { folder_id: string; unread_count: number }) => {
                    if (folder.folder_id === feedBeingDeleted.folder_id) {
                      return {
                        ...folder,
                        unread_count: Math.max(
                          0,
                          folder.unread_count - feedBeingDeleted.unread_count,
                        ),
                      };
                    }
                    return folder;
                  },
                );
            }

            return updatedCounts;
          },
        );

        return { previousFeeds, previousUnreadCounts, feedId };
      },
      onError: (_, { silent }, context) => {
        // Rollback on error
        if (context?.previousFeeds) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.FEEDS],
            context.previousFeeds,
          );
        }
        if (context?.previousUnreadCounts) {
          queryClient.setQueryData(
            [RSS_QUERY_KEYS.UNREAD_COUNTS],
            context.previousUnreadCounts,
          );
        }
        if (!silent) {
          config.showError?.("Failed to remove feed");
        }
      },
      onSuccess: (_, { silent }) => {
        if (!silent) {
          config.showSuccess?.("Feed removed successfully");
        }
      },
      onSettled: () => {
        // Invalidate unread counts to ensure they're refreshed
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
        // Invalidate articles to refetch current view
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLES],
        });
        // Invalidate sidebar data to ensure instant updates
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FEEDS],
        });
      },
      ...options,
    });
  }

  // Article hooks
  function useArticles(
    params: {
      feedIds?: string[];
      folderId?: string;
      isRead?: boolean;
      isReadLater?: boolean;
      isFavorite?: boolean;
      feedIsFavorite?: boolean;
      publishedSince?: string;
      publishedUntil?: string;
      searchQuery?: string;
      sortBy?: string;
      sortOrder?: string;
      page?: number;
      size?: number;
      viewType?: string; // Add viewType for better cache distinction
      viewId?: string; // Add viewId for unique identification
    },
    options?: Omit<
      UseQueryOptions<
        PaginatedResponse<Article>,
        Error,
        PaginatedResponse<Article>,
        [string, typeof params]
      >,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, params],
      queryFn: () =>
        ClientProvider.getClient().rss.getArticles({
          feed_ids: params.feedIds,
          folder_id: params.folderId,
          is_read: params.isRead,
          is_read_later: params.isReadLater,
          is_favorite: params.isFavorite,
          feed_is_favorite: params.feedIsFavorite,
          published_since: params.publishedSince,
          published_until: params.publishedUntil,
          search_query: params.searchQuery,
          sort_by: params.sortBy,
          sort_order: params.sortOrder,
          page: params.page,
          size: params.size,
        }) as Promise<PaginatedResponse<Article>>,
      ...options,
    });
  }

  function useRecentlyReadArticles(
    params: { page?: number; size?: number } = {},
    options?: Omit<
      UseQueryOptions<
        PaginatedResponse<Article>,
        Error,
        PaginatedResponse<Article>,
        [string, string, typeof params]
      >,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, "recently_read", params],
      queryFn: () =>
        ClientProvider.getClient().rss.getRecentlyReadArticles(
          params.page,
          params.size,
        ) as Promise<PaginatedResponse<Article>>,
      ...options,
    });
  }

  function useReadLaterArticles(
    params: { page?: number; size?: number } = {},
    options?: Omit<
      UseQueryOptions<
        PaginatedResponse<Article>,
        Error,
        PaginatedResponse<Article>,
        [string, string, typeof params]
      >,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, "read_later", params],
      queryFn: () =>
        ClientProvider.getClient().rss.getReadLaterArticles(params.page, params.size) as Promise<
          PaginatedResponse<Article>
        >,
      ...options,
    });
  }

  function useUnreadCounts(
    folderId?: string,
    options?: Omit<
      UseQueryOptions<
        UnreadCounts,
        Error,
        UnreadCounts,
        [string, string | undefined]
      >,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS, folderId],
      queryFn: () =>
        ClientProvider.getClient().rss.getUnreadCounts(folderId) as Promise<UnreadCounts>,
      ...options,
    });
  }

  function useArticle(
    articleId: string,
    options?: Omit<
      UseQueryOptions<Article, Error, Article, [string, string]>,
      "queryKey" | "queryFn"
    >,
  ) {
    return useQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLE, articleId],
      queryFn: () => ClientProvider.getClient().rss.getArticle(articleId) as Promise<Article>,
      enabled: !!articleId,
      ...options,
    });
  }

  function useSubscribeToFeed(
    options?: UseMutationOptions<
      void,
      unknown,
      {
        feedId: string;
        folderId: string;
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({
        feedId,
        folderId,
      }: {
        feedId: string;
        folderId: string;
      }): Promise<void> => {
        await ClientProvider.getClient().rss.subscribeToFeed(feedId, { folder_id: folderId });
      },
      onSuccess: () => {
        // Invalidate and refetch feeds and unread counts
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.FOLDERS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
        });
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA],
        });
      },
      onError: (error: unknown) => {
        let errorMessage = "Failed to subscribe to feed";
        const err = error as {
          message?: string;
          detail?: string;
          response?: { data?: { detail?: string; message?: string } };
        };
        if (err?.message) {
          errorMessage = err.message;
        } else if (err?.detail) {
          errorMessage = err.detail;
        } else if (typeof error === "string") {
          errorMessage = error;
        } else if (err?.response?.data?.detail) {
          errorMessage = err.response.data.detail;
        } else if (err?.response?.data?.message) {
          errorMessage = err.response.data.message;
        }
        config.showError?.(errorMessage);
      },
      ...options,
    });
  }

  function useUpdateArticle(
    options?: UseMutationOptions<
      void,
      unknown,
      {
        articleId: string;
        data: {
          is_read?: boolean;
          read_at?: string;
          is_read_later?: boolean;
          is_favorite?: boolean;
        };
        articleType?: "feed" | "clipped";
      }
    >,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({
        articleId,
        data,
        articleType = "feed",
      }: {
        articleId: string;
        data: {
          is_read?: boolean;
          read_at?: string;
          is_read_later?: boolean;
          is_favorite?: boolean;
        };
        articleType?: "feed" | "clipped";
      }): Promise<void> => {
        await ClientProvider.getClient().rss.updateArticle(articleId, data, articleType);
      },
      onSuccess: (_, { articleId }) => {
        // Only invalidate the specific article, not all articles
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.ARTICLE, articleId],
        });
        // Only invalidate unread counts, not all articles to prevent infinite loops
        queryClient.invalidateQueries({
          queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS],
          refetchType: "active",
        });
      },
      ...options,
    });
  }

  // Infinite Query Hooks
  function useInfiniteArticles(
    params: {
      feedIds?: string[];
      folderId?: string;
      isRead?: boolean;
      isReadLater?: boolean;
      isFavorite?: boolean;
      feedIsFavorite?: boolean;
      publishedSince?: string;
      publishedUntil?: string;
      searchQuery?: string;
      sortBy?: string;
      sortOrder?: string;
      size?: number;
      viewType?: string;
      viewId?: string;
    },
    options?: UseInfiniteQueryOptions<
      PaginatedResponse<Article>,
      Error,
      PaginatedResponse<Article>,
      [string, string, typeof params],
      number
    >,
  ) {
    return useInfiniteQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite", params],
      queryFn: ({
        pageParam,
      }: QueryFunctionContext<[string, string, typeof params], number>) =>
        ClientProvider.getClient().rss.getArticles({
          feed_ids: params.feedIds,
          folder_id: params.folderId,
          is_read: params.isRead,
          is_read_later: params.isReadLater,
          is_favorite: params.isFavorite,
          feed_is_favorite: params.feedIsFavorite,
          published_since: params.publishedSince,
          published_until: params.publishedUntil,
          search_query: params.searchQuery,
          sort_by: params.sortBy,
          sort_order: params.sortOrder,
          page: pageParam,
          size: params.size || 25,
        }) as Promise<PaginatedResponse<Article>>,
      getNextPageParam: (lastPage: PaginatedResponse<Article>) => {
        const currentPage = lastPage.page || 1;
        const totalPages = lastPage.pages || 1;
        return currentPage < totalPages ? currentPage + 1 : undefined;
      },
      initialPageParam: 1,
      ...options,
    });
  }

  function useInfiniteRecentlyReadArticles(
    params: { size?: number } = {},
    options?: UseInfiniteQueryOptions<
      PaginatedResponse<Article>,
      Error,
      PaginatedResponse<Article>,
      [string, string, string, typeof params],
      number
    >,
  ) {
    return useInfiniteQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite", "recently_read", params],
      queryFn: ({
        pageParam,
      }: QueryFunctionContext<
        [string, string, string, typeof params],
        number
      >) =>
        ClientProvider.getClient().rss.getRecentlyReadArticles(
          pageParam,
          params.size || 25,
        ) as Promise<PaginatedResponse<Article>>,
      getNextPageParam: (lastPage: PaginatedResponse<Article>) => {
        const page = lastPage as {
          page?: number;
          pages?: number;
          total_pages?: number;
        };
        const currentPage = page.page || 1;
        const totalPages = page.pages || page.total_pages || 1;
        return currentPage < totalPages ? currentPage + 1 : undefined;
      },
      initialPageParam: 1,
      ...options,
    });
  }

  function useInfiniteReadLaterArticles(
    params: { size?: number } = {},
    options?: UseInfiniteQueryOptions<
      PaginatedResponse<Article>,
      Error,
      PaginatedResponse<Article>,
      [string, string, string, typeof params],
      number
    >,
  ) {
    return useInfiniteQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite", "read_later", params],
      queryFn: ({
        pageParam,
      }: QueryFunctionContext<
        [string, string, string, typeof params],
        number
      >) =>
        ClientProvider.getClient().rss.getReadLaterArticles(
          pageParam,
          params.size || 25,
        ) as Promise<PaginatedResponse<Article>>,
      getNextPageParam: (lastPage: PaginatedResponse<Article>) => {
        const page = lastPage as {
          page?: number;
          pages?: number;
          total_pages?: number;
        };
        const currentPage = page.page || 1;
        const totalPages = page.pages || page.total_pages || 1;
        return currentPage < totalPages ? currentPage + 1 : undefined;
      },
      initialPageParam: 1,
      ...options,
    });
  }

  function useInfiniteTodayArticles(
    params?: { size?: number },
    options?: UseInfiniteQueryOptions<
      PaginatedResponse<Article>,
      Error,
      PaginatedResponse<Article>,
      [string, string, string, typeof params],
      number
    >,
  ) {
    return useInfiniteQuery({
      queryKey: [RSS_QUERY_KEYS.ARTICLES, "infinite", "today", params],
      queryFn: ({
        pageParam,
      }: QueryFunctionContext<
        [string, string, string, typeof params],
        number
      >) =>
        ClientProvider.getClient().rss.getTodaysArticles({
          page: pageParam,
          size: params?.size || 25,
        }) as Promise<PaginatedResponse<Article>>,
      getNextPageParam: (lastPage: PaginatedResponse<Article>) => {
        const page = lastPage as {
          page?: number;
          pages?: number;
          total_pages?: number;
        };
        const currentPage = page.page || 1;
        const totalPages = page.pages || page.total_pages || 1;
        return currentPage < totalPages ? currentPage + 1 : undefined;
      },
      initialPageParam: 1,
      ...options,
    });
  }

  // Return all hooks as an object
  return {
    // OPML hooks
    useImportOPML,
    useImportTaskStatus,

    // Folder hooks
    useFolders,
    useCreateFolder,
    useUpdateFolder,
    useDeleteFolder,

    // Feed hooks
    useFeeds,
    useFeed,
    useCreateFeed,
    useUpdateFeed,
    useRefreshFeed,
    useRefreshFolderFeeds,
    useRefreshAllFeeds,
    useRefreshStatus,
    useDeleteFeed,

    // Article hooks
    useArticles,
    useRecentlyReadArticles,
    useReadLaterArticles,
    useUnreadCounts,
    useArticle,
    useSubscribeToFeed,
    useUpdateArticle,

    // Infinite query hooks
    useInfiniteArticles,
    useInfiniteRecentlyReadArticles,
    useInfiniteReadLaterArticles,
    useInfiniteTodayArticles,
  };
}

// Export individual hooks using default configuration for backward compatibility
const defaultHooks = createFeedHooks();
export const {
  // OPML hooks
  useImportOPML,
  useImportTaskStatus,

  // Folder hooks
  useFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,

  // Feed hooks
  useFeeds,
  useFeed,
  useCreateFeed,
  useUpdateFeed,
  useRefreshFeed,
  useRefreshFolderFeeds,
  useRefreshAllFeeds,
  useRefreshStatus,
  useDeleteFeed,

  // Article hooks
  useArticles,
  useRecentlyReadArticles,
  useReadLaterArticles,
  useUnreadCounts,
  useArticle,
  useSubscribeToFeed,
  useUpdateArticle,

  // Infinite query hooks
  useInfiniteArticles,
  useInfiniteRecentlyReadArticles,
  useInfiniteReadLaterArticles,
  useInfiniteTodayArticles,
} = defaultHooks;

// Export the factory function for custom configurations
export { createFeedHooks };
