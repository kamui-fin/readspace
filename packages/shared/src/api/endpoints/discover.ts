import { ApiClient } from "../core";

export const discover = {
    previewFeed: (url: string) => {
        const queryParams = new URLSearchParams();
        queryParams.append("url", url);
        return ApiClient.get<Record<string, any>>(
            `/api/discover/preview?${queryParams.toString()}`
        );
    },
};
