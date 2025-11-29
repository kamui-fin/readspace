import { FeedDiscoveryResult, FeedSummary } from "../api/types/feeds";

export function feedDiscoveryResultToFeed(
  result: FeedDiscoveryResult,
): Partial<FeedSummary> {
  return {
    url: result.url,
    title: result.title,
    link: result.site_url || null,
    image_url: result.icon_url || null,
  };
}
