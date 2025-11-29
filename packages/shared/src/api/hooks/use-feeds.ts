import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationOptions,
    type UseQueryOptions,
} from "@tanstack/react-query";
import { ApiClient } from "../client";
import { RSS_QUERY_KEYS, mutationKeys, queryKeys } from "../query-keys";
import type { ArticleCountsResponse, FeedDetail, FeedSummary, Subscription, SubscriptionExtended } from "../types";

export function createFeedHooks() {
    function useFeeds(
        params?: {
            folderId?: string;
            isFavorite?: boolean;
            extended?: boolean;
        },
        options?: Omit<
            UseQueryOptions<
                Subscription[] | SubscriptionExtended[],
                Error,
                Subscription[] | SubscriptionExtended[],
                ReturnType<typeof queryKeys.feeds>
            >,
            "queryKey" | "queryFn"
        >,
    ) {
        return useQuery({
            queryKey: queryKeys.feeds(params),
            queryFn: () =>
                ApiClient.getFeeds({
                    folder_id: params?.folderId,
                    is_favorite: params?.isFavorite,
                    extended: params?.extended,
                }),
            ...options,
        });
    }

    function useFeed(
        feedId: string,
        options?: Omit<
            UseQueryOptions<
                FeedDetail,
                Error,
                FeedDetail,
                ReturnType<typeof queryKeys.feed>
            >,
            "queryKey" | "queryFn"
        >,
    ) {
        return useQuery({
            queryKey: queryKeys.feed(feedId),
            queryFn: () => ApiClient.getFeed(feedId),
            enabled: !!feedId,
            ...options,
        });
    }

    function useCreateFeed(
        options?: UseMutationOptions<
            Subscription,
            unknown,
            {
                url: string;
                folder_id: string;
            }
        >,
    ) {
        const queryClient = useQueryClient();
        return useMutation({
            mutationKey: mutationKeys.createFeed(),
            mutationFn: (feed: { url: string; folder_id: string }) =>
                ApiClient.createFeed(feed),
            onSettled: (data) => {
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
                queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });

                // Invalidate specific feed cache
                if (data?.feed?.id) {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.feed(data.feed.id),
                    });
                }
            },
            ...options,
        });
    }

    function useUpdateFeed(
        options?: UseMutationOptions<
            Subscription,
            unknown,
            {
                feedId: string;
                data: {
                    folder_id?: string;
                    is_favorite?: boolean;
                    custom_title?: string;
                };
            },
            unknown
        >,
    ) {
        const queryClient = useQueryClient();
        return useMutation({
            mutationKey: mutationKeys.updateFeed(),
            mutationFn: ({
                feedId,
                data,
            }: {
                feedId: string;
                data: {
                    folder_id?: string;
                    is_favorite?: boolean;
                    custom_title?: string;
                };
            }) => ApiClient.updateFeed(feedId, data),
            onSettled: (_data, _error, { feedId }) => {
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FOLDERS] });
                queryClient.invalidateQueries({ queryKey: queryKeys.feed(feedId) });
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
            mutationKey: mutationKeys.refreshFeed(),
            mutationFn: async ({
                feedId,
                forceRefetch = false,
            }: {
                feedId: string;
                forceRefetch?: boolean;
            }) => {
                await ApiClient.refreshFeed(feedId, forceRefetch);
            },
            onSuccess: (_, { feedId }) => {
                queryClient.invalidateQueries({ queryKey: queryKeys.feed(feedId) });
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
                queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
            },
            ...options,
        });
    }

    function usePreviewFeed(
        options?: UseMutationOptions<
            FeedDetail,
            unknown,
            string
        >,
    ) {
        const queryClient = useQueryClient();
        return useMutation({
            mutationKey: ["preview-feed"],
            mutationFn: async (feedId: string) => {
                return ApiClient.refreshFeed(feedId, true, true);
            },
            onSuccess: () => {
                // Invalidate articles to ensure the preview articles are shown
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
            },
            ...options,
        });
    }

    function useMarkFeedAllRead(
        options?: UseMutationOptions<
            { message: string; feed_id: string },
            unknown,
            string
        >,
    ) {
        const queryClient = useQueryClient();
        return useMutation({
            mutationKey: mutationKeys.markFeedAllRead(),
            mutationFn: (feedId: string) => ApiClient.markFeedAllRead(feedId),
            onSuccess: (_, feedId) => {
                queryClient.invalidateQueries({ queryKey: queryKeys.feed(feedId) });
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
                queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
            },
            ...options,
        });
    }

    function useRefreshAllFeeds(
        options?: UseMutationOptions<unknown, unknown, void>,
    ) {
        return useMutation({
            mutationKey: mutationKeys.refreshAllFeeds(),
            mutationFn: () => ApiClient.refreshAllFeeds(),
            ...options,
        });
    }

    function useRefreshStatus(
        taskId: string | null,
        enabled: boolean = true,
        options?: Omit<
            UseQueryOptions<
                unknown,
                Error,
                unknown,
                ReturnType<typeof queryKeys.refreshStatus>
            >,
            "queryKey" | "queryFn"
        >,
    ) {
        return useQuery({
            queryKey: queryKeys.refreshStatus(taskId),
            queryFn: () => ApiClient.getRefreshStatus(taskId!) as Promise<unknown>,
            enabled: enabled && !!taskId,
            refetchInterval: 2000, // Poll every 2 seconds
            refetchIntervalInBackground: false,
            ...options,
        });
    }

    function useDeleteFeed(
        options?: UseMutationOptions<
            void,
            unknown,
            {
                feedId: string;
                silent?: boolean;
            },
            unknown
        >,
    ) {
        const queryClient = useQueryClient();
        return useMutation({
            mutationKey: mutationKeys.deleteFeed(),
            mutationFn: async ({ feedId }: { feedId: string; silent?: boolean }) => {
                await ApiClient.deleteFeed(feedId);
            },
            onSettled: (_data, _error, { feedId }) => {
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
                queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
                queryClient.invalidateQueries({ queryKey: queryKeys.feed(feedId) });
            },
            ...options,
        });
    }

    function useAdminDeleteFeed(
        options?: UseMutationOptions<
            void,
            unknown,
            {
                feedId: string;
                silent?: boolean;
            },
            unknown
        >,
    ) {
        const queryClient = useQueryClient();
        return useMutation({
            mutationKey: mutationKeys.adminDeleteFeed(),
            mutationFn: async ({ feedId }: { feedId: string; silent?: boolean }) => {
                await ApiClient.adminDeleteFeed(feedId);
            },
            onSettled: (_data, _error, { feedId }) => {
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
                queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
                queryClient.invalidateQueries({ queryKey: queryKeys.feed(feedId) });
            },
            ...options,
        });
    }

    function useAdminUpdateFeed(
        options?: UseMutationOptions<
            FeedDetail,
            unknown,
            {
                feedId: string;
                data: {
                    title?: string;
                    description?: string;
                    language?: string;
                    top_level_category?: string;
                    url?: string;
                    link?: string;
                    image_url?: string;
                    popularity_score?: number;
                };
            },
            unknown
        >,
    ) {
        const queryClient = useQueryClient();
        return useMutation({
            mutationKey: mutationKeys.adminUpdateFeed(),
            mutationFn: ({
                feedId,
                data,
            }: {
                feedId: string;
                data: any;
            }) => ApiClient.adminUpdateFeed(feedId, data),
            onSettled: (_data, _error, { feedId }) => {
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
                queryClient.invalidateQueries({ queryKey: queryKeys.feed(feedId) });
            },
            ...options,
        });
    }

    function useBulkDeleteFeeds(
        options?: UseMutationOptions<
            { deleted_count: number; deleted_ids: string[] },
            unknown,
            { feedIds: string[] },
            unknown
        >,
    ) {
        const queryClient = useQueryClient();
        return useMutation({
            mutationKey: mutationKeys.bulkDeleteFeeds(),
            mutationFn: ({ feedIds }: { feedIds: string[] }) =>
                ApiClient.bulkDeleteFeeds(feedIds),
            onSettled: () => {
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
                queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] });
            },
            ...options,
        });
    }

    function useBulkUpdateFeedsFolder(
        options?: UseMutationOptions<
            {
                updated_count: number;
                updated_ids: string[];
                folder_id: string;
            },
            unknown,
            { feedIds: string[]; folderId: string },
            unknown
        >,
    ) {
        const queryClient = useQueryClient();
        return useMutation({
            mutationKey: mutationKeys.bulkUpdateFeedsFolder(),
            mutationFn: ({
                feedIds,
                folderId,
            }: {
                feedIds: string[];
                folderId: string;
            }) => ApiClient.bulkUpdateFeedsFolder(feedIds, folderId),
            onSettled: () => {
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
            },
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
            mutationKey: mutationKeys.subscribeToFeed(),
            mutationFn: async ({
                feedId,
                folderId,
            }: {
                feedId: string;
                folderId: string;
            }): Promise<void> => {
                await ApiClient.subscribeToFeed(feedId, { folder_id: folderId });
            },
            onSettled: () => {
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] });
                queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
            },
            ...options,
        });
    }

    function useFeedUnreadCounts(
        options?: Omit<
            UseQueryOptions<
                ArticleCountsResponse,
                Error,
                Record<string, number>,
                ReturnType<typeof queryKeys.unreadCounts>
            >,
            "queryKey" | "queryFn" | "select"
        >,
    ) {
        return useQuery({
            queryKey: queryKeys.unreadCounts(),
            queryFn: () => ApiClient.getUnreadCounts(),
            select: (data) => data.feed_counts,
            refetchInterval: 60000, // Poll every minute
            ...options,
        });
    }

    return {
        useFeeds,
        useFeed,
        useCreateFeed,
        useUpdateFeed,
        useRefreshFeed,
        usePreviewFeed,
        useRefreshAllFeeds,
        useRefreshStatus,
        useDeleteFeed,
        useAdminDeleteFeed,
        useAdminUpdateFeed,
        useBulkDeleteFeeds,
        useBulkUpdateFeedsFolder,
        useSubscribeToFeed,
        useFeedUnreadCounts,
        useMarkFeedAllRead,
    };
}
