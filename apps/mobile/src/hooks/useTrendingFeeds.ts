import { MAX_TRENDING_ITEMS, TRENDING_PAGE_SIZE } from '@lib/constants/app';
import { FEEDS_INDEX_NAME, meilisearchClient } from '@lib/meilisearch-client';
import type { FeedSummary } from '@readspace/shared';
import { POPULAR_CATEGORIES } from '@readspace/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

interface UseTrendingFeedsOptions {
  languageCode: string;
  enabled: boolean;
}

/**
 * Trending feeds for the Discover landing screen: the most popular feeds from
 * the News, Tech and Business categories, in the user's search language.
 *
 * Queried through the Meilisearch client directly rather than through
 * InstantSearch — it is a fixed, sorted listing with its own pagination, not a
 * refinement of the user's search, and routing it through the shared
 * InstantSearch index state would make browsing and searching fight over the
 * same widget state.
 */
export function useTrendingFeeds({ languageCode, enabled }: UseTrendingFeedsOptions) {
  const query = useInfiniteQuery({
    queryKey: ['trending', languageCode],
    queryFn: async ({ pageParam = 0 }) => {
      const categoryFilter = POPULAR_CATEGORIES.map(
        (category) => `top_level_category = "${category}"`
      ).join(' OR ');
      const filter = languageCode
        ? [`language = ${languageCode} AND (${categoryFilter})`]
        : [categoryFilter];

      const response = await meilisearchClient.index(FEEDS_INDEX_NAME).search('', {
        limit: TRENDING_PAGE_SIZE,
        offset: pageParam,
        filter,
        sort: ['frontend_rank_override:asc', 'popularity_score:desc'],
      });
      return { hits: response.hits as unknown as FeedSummary[], offset: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + page.hits.length, 0);
      if (lastPage.hits.length < TRENDING_PAGE_SIZE || totalFetched >= MAX_TRENDING_ITEMS) {
        return undefined;
      }
      return lastPage.offset + TRENDING_PAGE_SIZE;
    },
    enabled,
  });

  const feeds = useMemo(() => {
    const all = query.data?.pages.flatMap((page) => page.hits) ?? [];
    return all.slice(0, MAX_TRENDING_ITEMS);
  }, [query.data]);

  return {
    feeds,
    error: query.error,
    showSkeleton: query.isLoading && feeds.length === 0,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
