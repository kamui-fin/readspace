import {
  useInfiniteArticles,
  useInfiniteReadLaterArticles,
  useInfiniteRecentlyReadArticles,
  useInfiniteTodayArticles,
} from '@readspace/shared';

interface UseArticleQueriesParams {
  activeTab: number;
  isViewingFeedOrFolder: boolean;
  feedFolderParams: Record<string, unknown>;
}

/**
 * Custom hook to manage article queries based on active tab and view type
 */
export function useArticleQueries({
  activeTab,
  isViewingFeedOrFolder,
  feedFolderParams,
}: UseArticleQueriesParams) {
  const todayQuery = useInfiniteTodayArticles({ limit: 25 }, {
    enabled: activeTab === 0 && !isViewingFeedOrFolder,
  } as any);

  const savedQuery = useInfiniteReadLaterArticles({ limit: 25 }, {
    enabled: activeTab === 1 && !isViewingFeedOrFolder,
  } as any);

  const allQuery = useInfiniteArticles({ ...feedFolderParams, limit: 25 }, {
    enabled: activeTab === 2 || isViewingFeedOrFolder,
  } as any);

  const recentQuery = useInfiniteRecentlyReadArticles({ limit: 25 }, {
    enabled: activeTab === 3 && !isViewingFeedOrFolder,
  } as any);

  // Select active query based on tab
  const activeQuery = (() => {
    // When viewing a feed/folder, always use allQuery because the special queries
    // (today/saved/recent) don't support feed/folder filtering
    if (isViewingFeedOrFolder) {
      return allQuery;
    }

    // When NOT viewing a feed/folder, use the tab-specific query
    switch (activeTab) {
      case 0:
        return todayQuery;
      case 1:
        return savedQuery;
      case 2:
        return allQuery;
      case 3:
        return recentQuery;
      default:
        return allQuery;
    }
  })();

  return { todayQuery, savedQuery, allQuery, recentQuery, activeQuery };
}
