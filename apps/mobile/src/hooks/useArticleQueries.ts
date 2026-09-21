import { FOLLOWING_TAB } from '@lib/constants/tabs';
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
    enabled: activeTab === FOLLOWING_TAB.TODAY && !isViewingFeedOrFolder,
  } as any);

  const savedQuery = useInfiniteReadLaterArticles({ limit: 25 }, {
    enabled: activeTab === FOLLOWING_TAB.SAVED && !isViewingFeedOrFolder,
  } as any);

  const allQuery = useInfiniteArticles({ ...feedFolderParams, limit: 25 }, {
    enabled: activeTab === FOLLOWING_TAB.ALL || isViewingFeedOrFolder,
  } as any);

  const recentQuery = useInfiniteRecentlyReadArticles({ limit: 25 }, {
    enabled: activeTab === FOLLOWING_TAB.RECENT && !isViewingFeedOrFolder,
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
      case FOLLOWING_TAB.TODAY:
        return todayQuery;
      case FOLLOWING_TAB.SAVED:
        return savedQuery;
      case FOLLOWING_TAB.RECENT:
        return recentQuery;
      default:
        return allQuery;
    }
  })();

  return { todayQuery, savedQuery, allQuery, recentQuery, activeQuery };
}
