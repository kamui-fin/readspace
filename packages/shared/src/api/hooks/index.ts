import { createArticleHooks } from "./use-articles";
import { createFeedHooks } from "./use-feeds";
import { createFolderHooks } from "./use-folders";
import { createOpmlHooks } from "./use-opml";
import { createUserHooks } from "./use-users";

// Export factory functions for custom configurations
export {
  createFeedHooks,
  createArticleHooks,
  createFolderHooks,
  createOpmlHooks,
  createUserHooks,
};

// Re-export enhancement utilities
export {
  ARTICLE_ENHANCEMENT_QUERY_KEYS,
  createTranslationQueryKey,
} from "./use-articles";

// Create and export default hooks
const defaultFeedHooks = createFeedHooks();
const defaultArticleHooks = createArticleHooks();
const defaultFolderHooks = createFolderHooks();
const defaultOpmlHooks = createOpmlHooks();
const defaultUserHooks = createUserHooks();

// Re-export all default hooks
export const {
  useFeeds,
  useFeed,
  useCreateFeed,
  useUpdateFeed,
  useRefreshFeed,
  usePreviewFeed,
  useDeleteFeed,
  useAdminDeleteFeed,
  useAdminUpdateFeed,
  useBulkDeleteFeeds,
  useBulkUpdateFeedsFolder,
  useSubscribeToFeed,
  useFeedUnreadCounts,
  useMarkFeedAllRead,
} = defaultFeedHooks;

export const {
  useUnreadCounts,
  useArticle,
  useUpdateArticle,
  useCheckArticleSaved,
  useSaveArticle,
  useUnsaveArticle,
  useInfiniteArticles,
  useInfiniteRecentlyReadArticles,
  useInfiniteReadLaterArticles,
  useInfiniteTodayArticles,
  useExtractFullText,
  useSummarizeArticle,
  fetchTranslation,
} = defaultArticleHooks;

export const {
  useFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useMarkFolderAllRead,
} = defaultFolderHooks;

export const { useImportOPML, useImportTaskStatus, useActiveImportTask, useCancelImportTask } =
  defaultOpmlHooks;

export const { useProfile } = defaultUserHooks;
