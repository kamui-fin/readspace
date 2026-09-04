import { FEEDS_INDEX_NAME, meilisearchClient } from '@lib/meilisearch-client';
import {
  buildOnboardingFeedQueries,
  interleaveOnboardingFeeds,
  mapHitToOnboardingFeed,
  type OnboardingFeed,
} from '@readspace/shared/search/onboarding-feeds';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

export function useOnboardingFeeds(selectedCategories: string[] = []) {
  const [displayedFeeds, setDisplayedFeeds] = useState<OnboardingFeed[]>([]);
  const [isTransitionComplete, setIsTransitionComplete] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsTransitionComplete(true);
    });
    return () => task.cancel();
  }, []);

  const {
    data: feedsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['onboarding-feeds', selectedCategories],
    queryFn: async () => {
      if (selectedCategories.length === 0) {
        return [];
      }

      const queries = buildOnboardingFeedQueries(FEEDS_INDEX_NAME, selectedCategories, 20);

      const multiSearchResults = await meilisearchClient.multiSearch({
        queries,
      });

      const categoryResults = multiSearchResults.results.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result: { hits: any[] }) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result.hits.map((hit: any) => mapHitToOnboardingFeed(hit))
      );

      return interleaveOnboardingFeeds(categoryResults);
    },
    enabled: selectedCategories.length > 0 && isTransitionComplete,
  });

  useEffect(() => {
    if (feedsData) {
      setDisplayedFeeds(feedsData);
    }
  }, [feedsData]);

  const fetchSimilarFeeds = async (feedId: string) => {
    try {
      const index = meilisearchClient.index(FEEDS_INDEX_NAME);
      const results = await index.searchSimilarDocuments({
        id: feedId,
        limit: 3,
        embedder: 'default',
        showRankingScore: true,
        filter: 'language = "en"',
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const similarFeeds = results.hits.map((hit: any) => ({
        id: hit.id,
        title: hit.title,
        description: hit.description,
        url: hit.url,
        link: hit.link,
        image_url: hit.image_url,
        category: hit.top_level_category,
        popularity_score: hit.popularity_score,
      }));

      setDisplayedFeeds((prev) => {
        const feedIndex = prev.findIndex((f) => f.id === feedId);
        if (feedIndex === -1) return prev;

        const newFeeds = [...prev];
        const uniqueSimilar = similarFeeds.filter(
          (sf: OnboardingFeed) => !newFeeds.some((f) => f.id === sf.id)
        );
        newFeeds.splice(feedIndex + 1, 0, ...uniqueSimilar);
        return newFeeds;
      });
    } catch (error) {
      console.error('Failed to fetch similar feeds:', error);
    }
  };

  return {
    displayedFeeds: displayedFeeds.length > 0 ? displayedFeeds : feedsData || [],
    isLoading,
    error,
    fetchSimilarFeeds,
  };
}
