import { useFeeds } from './use-feeds';
import type { Subscription } from '../types';

interface UseIsSubscribedResult {
  isSubscribed: boolean;
  subscription: Subscription | undefined;
}

/**
 * Hook to check if a feed is currently subscribed to.
 * Checks by ID first, then falls back to normalized URL comparison.
 */
export function useIsSubscribed(feed: {
  id: string;
  url: string;
  initialIsSubscribed?: boolean;
}): UseIsSubscribedResult {
  const { data: feedsData } = useFeeds(
    {},
    {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes
      refetchInterval: false,
    }
  );

  // Normalize URL function to handle www/non-www variations
  const normalizeUrl = (url: string | undefined | null) => {
    if (!url) return '';
    return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  };

  const subscription = feedsData?.subscriptions?.find((f) => {
    // Check by ID first
    if (f.feed.id === feed.id) {
      return true;
    }
    // Fallback: check by normalized URL
    return normalizeUrl(f.feed.url) === normalizeUrl(feed.url);
  });

  // If we have feeds data, trust it. Otherwise fall back to initial state.
  const isSubscribed = feedsData ? !!subscription : (feed.initialIsSubscribed ?? !!subscription);

  return {
    isSubscribed,
    subscription,
  };
}
