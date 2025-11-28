import { ApiClient } from "../core";
import { FeedDetail, Subscription } from "../types/feeds";

export const feeds = {
    getFeeds: (params?: {
        folder_id?: string;
        tag_names?: string[];
        is_favorite?: boolean;
        skip?: number;
    }) => {
        const queryParams = new URLSearchParams();
        if (params?.folder_id) queryParams.append("folder_id", params.folder_id);
        if (params?.tag_names)
            params.tag_names.forEach((tag) => queryParams.append("tag_names", tag));
        if (params?.is_favorite !== undefined)
            queryParams.append("is_favorite", params.is_favorite.toString());
        if (params?.skip !== undefined)
            queryParams.append("skip", params.skip.toString());

        const queryString = queryParams.toString();
        return ApiClient.get<Subscription[]>(
            `/api/feeds/${queryString ? `?${queryString}` : ""}`,
        );
    },

    getFeed: (id: string) => ApiClient.get<FeedDetail>(`/api/feeds/${id}`),

    createFeed: (
        data: { url: string; folder_id?: string },
        signal?: AbortSignal,
    ) =>
        ApiClient.post<Subscription>(
            "/api/feeds/",
            data,
            signal ? { signal } : undefined,
        ),

    updateFeed: (
        id: string,
        data: {
            folder_id?: string;
            is_favorite?: boolean;
            custom_title?: string;
        },
    ) => ApiClient.put<Subscription>(`/api/feeds/${id}`, data),

    refreshFeed: (
        id: string,
        forceRefetch: boolean = false,
        preview: boolean = false,
    ): Promise<FeedDetail> => {
        const queryParams = new URLSearchParams();
        if (forceRefetch) queryParams.append("force_refetch", "true");
        if (preview) queryParams.append("preview", "true");
        const queryString = queryParams.toString();

        return ApiClient.post<FeedDetail>(
            `/api/feeds/${id}/refresh${queryString ? `?${queryString}` : ""}`,
        );
    },

    refreshAllFeeds: () => ApiClient.post("/api/feeds/refresh"),

    getRefreshStatus: (taskId: string) =>
        ApiClient.get(`/api/feeds/refresh-status/${taskId}`),

    deleteFeed: (id: string) => ApiClient.delete(`/api/feeds/${id}`),

    adminDeleteFeed: (id: string) => ApiClient.delete(`/api/feeds/${id}/admin`),

    markFeedAllRead: (feed_id: string) =>
        ApiClient.put<{
            message: string;
            feed_id: string;
        }>(`/api/feeds/${feed_id}/read-status`),

    subscribeToFeed: (feedId: string, data: { folder_id: string }) =>
        ApiClient.post(`/api/feeds/${feedId}/subscribe`, data),

    // Admin/Bulk operations might need to be verified against backend
    // Assuming these are still valid or will be updated later
    bulkDeleteFeeds: (feed_ids: string[]) =>
        ApiClient.delete<{
            deleted_count: number;
            deleted_ids: string[];
        }>("/api/feeds/", { feed_ids }),

    bulkUpdateFeedsFolder: (feed_ids: string[], folder_id: string) =>
        ApiClient.patch<{
            updated_count: number;
            updated_ids: string[];
            folder_id: string;
        }>("/api/feeds/folder", { feed_ids, folder_id }),
};
