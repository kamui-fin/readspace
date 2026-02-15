import { ApiClient } from "../core";
import { FeedDiscoveryResult } from "../types";

export const discover = {
  previewFeed: (url: string) => {
    const queryParams = new URLSearchParams();
    queryParams.append("url", url);
    return ApiClient.get<FeedDiscoveryResult>(
      `/api/discover/preview?${queryParams.toString()}`,
    );
  },
};
