import { ArticleListItem } from '@/components/ArticleListItem';
import { FeedPreviewBanner } from '@/components/FeedPreviewBanner';
import { FolderPicker, type FolderPickerRef } from '@/components/FolderPicker';
import { Header } from '@/components/Header';
import { ArticleListSkeleton } from '@/components/skeletons';
import { COLORS } from '@/constants/Colors';
import { useFeedViewStore } from '@/stores/feed-view';
import { groupArticlesByDate } from '@/utils/dateUtils';
import { LegendList } from '@legendapp/list';
import { Monicon } from '@monicon/native';
import {
    type Article,
    type CursorPaginatedResponse,
    formatRelativeDate,
    useCreateFeed,
    useFeed,
    useFeeds,
    useInfiniteArticles,
    useInfiniteReadLaterArticles,
    useInfiniteRecentlyReadArticles,
    useInfiniteTodayArticles,
    useUnreadCounts,
    useUpdateArticle,
} from '@readspace/shared';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

interface ListItem {
    type: 'section' | 'article' | 'divider';
    id: string;
    data?: Article;
    sectionTitle?: string;
}

const TAB_CONFIGS = [
    { label: 'Today', iconName: 'solar:calendar-mark-linear' },
    { label: 'Saved', iconName: 'solar:bookmark-linear' },
    { label: 'All', iconName: 'solar:inbox-linear' },
    { label: 'Recent', iconName: 'solar:history-linear' },
];

export default function FollowingScreen() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const viewType = useFeedViewStore((state) => state.viewType);
    const selectedId = useFeedViewStore((state) => state.selectedId);
    const selectedName = useFeedViewStore((state) => state.selectedName);
    const activeTab = useFeedViewStore((state) => state.activeTab);
    const isPreviewMode = useFeedViewStore((state) => state.isPreviewMode);
    const selectTab = useFeedViewStore((state) => state.selectTab);

    const [headerHeight, setHeaderHeight] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadOnly, setUnreadOnly] = useState(false);
    const scrollY = useSharedValue(0);
    const folderPickerRef = useRef<FolderPickerRef>(null);

    const colors = COLORS[colorScheme ?? 'light'];

    // Fetch feed data for preview mode banner
    const { data: feedData } = useFeed(selectedId || '', {
        enabled: isPreviewMode && !!selectedId,
    });

    // Determine query parameters based on view type and active tab
    const queryParams = useMemo(() => {
        // If viewing a specific feed or feed preview
        if ((viewType === 'feed' || viewType === 'feedPreview') && selectedId) {
            return { feedIds: [selectedId] };
        }
        // If viewing a folder
        if (viewType === 'folder' && selectedId) {
            return { folderId: selectedId };
        }
        // Default: all articles
        return {};
    }, [viewType, selectedId]);

    // When a feed or folder is selected, activeTab is -1, so we should use the "All" query with specific filters
    const isViewingFeedOrFolder = activeTab === -1 && (viewType === 'feed' || viewType === 'folder' || viewType === 'feedPreview');

    // Select the appropriate query hook based on active tab
    const todayQuery = useInfiniteTodayArticles({ limit: 25 }, { enabled: activeTab === 0 } as any);
    const savedQuery = useInfiniteReadLaterArticles({ limit: 25 }, {
        enabled: activeTab === 1,
    } as any);
    const allQuery = useInfiniteArticles({ ...queryParams, limit: 25 }, {
        enabled: activeTab === 2 || isViewingFeedOrFolder,
    } as any);
    const recentQuery = useInfiniteRecentlyReadArticles({ limit: 25 }, {
        enabled: activeTab === 3,
    } as any);

    // Select active query based on tab
    const activeQuery = useMemo(() => {
        if (isViewingFeedOrFolder) {
            return allQuery;
        }
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
    }, [activeTab, isViewingFeedOrFolder, todayQuery, savedQuery, allQuery, recentQuery]);

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isFetching } = activeQuery;

    // Flatten paginated articles and deduplicate by ID
    const allArticles = useMemo(() => {
        const infiniteData = data as any;
        if (!infiniteData?.pages) return [];
        const articles = infiniteData.pages.flatMap((page: CursorPaginatedResponse<Article>) => page.items || []);
        // Deduplicate articles by ID
        const uniqueArticles = new Map();
        for (const article of articles) {
            if (!uniqueArticles.has(article.id)) {
                uniqueArticles.set(article.id, article);
            }
        }
        let result = Array.from(uniqueArticles.values());

        // Filter by unread only if enabled
        if (unreadOnly) {
            result = result.filter(article => !article.is_read);
        }

        return result;
    }, [data, unreadOnly]);

    // Get unread counts - for feed/folder specific counts
    const { data: unreadCounts } = useUnreadCounts();
    const { data: feedsData } = useFeeds();

    // Calculate count based on active view
    const unreadCount = useMemo(() => {
        const feeds = (feedsData as { id: string; unread_count?: number; folder_id?: string }[]) || [];
        const counts = unreadCounts as {
            total_unread?: number;
            unread_by_folder?: Record<string, number>
        };

        // For feed-specific view
        if (viewType === 'feed' && selectedId) {
            const feed = feeds.find(f => f.id === selectedId);
            return feed?.unread_count || 0;
        }

        // For folder-specific view
        if (viewType === 'folder' && selectedId) {
            const folderUnread = counts?.unread_by_folder?.[selectedId] ?? 0;
            return folderUnread;
        }

        // For tab-based views
        switch (activeTab) {
            case 0: // Today
                // Count articles from today's data
                return allArticles.filter(a => !a.is_read).length;
            case 1: // Saved (count all saved, not unread)
                return allArticles.length;
            case 2: // All
                return counts?.total_unread || 0;
            case 3: // Recent (count all recent, not unread)
                return allArticles.length;
            default:
                return counts?.total_unread || 0;
        }
    }, [unreadCounts, feedsData, viewType, selectedId, activeTab, allArticles]);

    // Article mutations
    const updateArticle = useUpdateArticle();
    const createFeed = useCreateFeed();

    // Determine the title based on view state
    const title = useMemo(() => {
        if ((viewType === 'feed' || viewType === 'feedPreview') && selectedName) {
            return selectedName;
        } else if (viewType === 'folder' && selectedName) {
            return selectedName;
        }
        return 'Following';
    }, [viewType, selectedName]);

    // Toggle unread only button
    const toggleUnreadButton = useMemo(() => (
        <Pressable
            onPress={() => setUnreadOnly(!unreadOnly)}
            className="w-10 h-10 items-center justify-center rounded-lg active:opacity-70"
            style={{ backgroundColor: unreadOnly ? colors['light-grey'] : 'transparent' }}
        >
            <Monicon
                name={unreadOnly ? "solar:eye-bold" : "solar:eye-linear"}
                size={24}
                color={unreadOnly ? colors.secondary : colors.grey}
            />
        </Pressable>
    ), [unreadOnly, colors]);

    // Handle following feed from preview banner
    const handleFollowFromPreview = useCallback(() => {
        folderPickerRef.current?.present();
    }, []);

    const handleFolderSelect = useCallback(
        (folderId: string | null) => {
            if (!feedData?.url) {
                toast.error('Feed URL is missing');
                return;
            }

            createFeed.mutate(
                {
                    url: feedData.url,
                    folder_id: folderId || undefined,
                    silent: false,
                },
                {
                    onSuccess: () => {
                        toast.success(`Following ${feedData.title}`);
                        // Exit preview mode
                        const { selectFeed } = useFeedViewStore.getState();
                        selectFeed(feedData.id, feedData.title);
                    },
                    onError: (error: any) => {
                        toast.error(error?.message || 'Failed to follow feed');
                    },
                }
            );
        },
        [feedData, createFeed]
    );

    // Group articles by date and create flat list with sections and dividers
    const listItems = useMemo(() => {
        type ArticleWithDate = Article & { date: Date };
        const articlesWithDates: ArticleWithDate[] = allArticles.map((article: Article) => ({
            ...article,
            date: article.published_at ? new Date(article.published_at) : new Date(),
        }));
        const grouped = groupArticlesByDate(articlesWithDates);
        const items: ListItem[] = [];
        let dividerCounter = 0;

        // Sort section headers chronologically
        const sortedSections = Object.entries(grouped).sort((a, b) => {
            const firstArticleA = a[1][0];
            const firstArticleB = b[1][0];
            return firstArticleB.date.getTime() - firstArticleA.date.getTime();
        });

        for (const [sectionTitle, articles] of sortedSections) {
            // Add section header
            items.push({
                type: 'section',
                id: `section-${sectionTitle}`,
                sectionTitle,
            });

            // Add articles with dividers
            for (let i = 0; i < articles.length; i++) {
                const article = articles[i];
                items.push({
                    type: 'article',
                    id: article.id,
                    data: article,
                });

                // Add divider after each article except the last one
                if (i < articles.length - 1) {
                    items.push({
                        type: 'divider',
                        id: `divider-${dividerCounter++}`,
                    });
                }
            }

            // Add divider after section (before next section)
            items.push({
                type: 'divider',
                id: `divider-${dividerCounter++}`,
            });
        }

        return items;
    }, [allArticles]);

    // Show skeleton during initial load until we have items ready to render
    // Keep skeleton visible if we're loading AND don't have any items yet
    const isInitialLoading = (isLoading || isFetching) && listItems.length === 0;

    const scrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.value = event.nativeEvent.contentOffset.y;
    };

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const handleBookmark = useCallback(
        (articleId: string, currentlySaved: boolean, articleType: 'feed' | 'clipped' = 'feed') => {
            const newValue = !currentlySaved;
            updateArticle.mutate(
                {
                    articleId,
                    data: { is_read_later: newValue },
                    articleType,
                },
                {
                    // Optimistic update handles UI changes immediately
                    onError: () => {
                        toast.error('Failed to update bookmark');
                    },
                }
            );
        },
        [updateArticle]
    );

    const handleToggleRead = useCallback(
        (articleId: string, currentlyRead: boolean, articleType: 'feed' | 'clipped' = 'feed') => {
            const newValue = !currentlyRead;
            updateArticle.mutate(
                {
                    articleId,
                    data: { is_read: newValue },
                    articleType,
                },
                {
                    // Optimistic update handles UI changes immediately
                    onError: () => {
                        toast.error('Failed to update read status');
                    },
                }
            );
        },
        [updateArticle]
    );

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await activeQuery.refetch();
        } finally {
            setRefreshing(false);
        }
    }, [activeQuery]);

    const renderItem = ({ item }: { item: ListItem }) => {
        if (item.type === 'section') {
            return (
                <View className="px-4 pb-2 pt-4">
                    <Text className="font-geist-semibold text-sm text-secondary">
                        {item.sectionTitle}
                    </Text>
                </View>
            );
        }

        if (item.type === 'divider') {
            return <View className="mx-4 h-[0.5px] bg-light-grey dark:bg-mid-grey-dark" />;
        }

        if (item.type === 'article' && item.data) {
            const article = item.data;
            const isClipped = article.article_type === 'clipped';

            // For feed articles
            const feedTitle =
                typeof article.feed === 'object' && article.feed ? article.feed.title : undefined;
            const feedImageUrl =
                typeof article.feed === 'object' && article.feed
                    ? article.feed.image_url
                    : undefined;

            // Try multiple ways to get the feed ID
            let feedId: string | undefined;
            if (typeof article.feed === 'object' && article.feed) {
                feedId = (article.feed as any).id;
            } else if (typeof article.feed === 'string') {
                feedId = article.feed;
            }

            // Check if there's a feed_id field directly on the article
            if (!feedId && (article as any).feed_id) {
                feedId = (article as any).feed_id;
            }

            // For clipped articles - get favicon from domain
            const getFaviconUrl = (url: string): string => {
                try {
                    const domain = new URL(url).hostname;
                    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
                } catch {
                    return '';
                }
            };

            const displayFaviconUrl = isClipped && article.link
                ? getFaviconUrl(article.link)
                : feedImageUrl;

            return (
                <ArticleListItem
                    className="px-4"
                    source={feedTitle || 'Unknown'}
                    timestamp={
                        article.published_at
                            ? formatRelativeDate(new Date(article.published_at))
                            : 'Unknown'
                    }
                    title={article.title}
                    description={article.description || undefined}
                    imageUrl={article.image_url || undefined}
                    faviconUrl={displayFaviconUrl || undefined}
                    isRead={article.is_read || false}
                    isSaved={article.is_read_later || false}
                    articleType={article.article_type}
                    priority={article.priority || undefined}
                    note={article.note || undefined}
                    articleUrl={article.link}
                    feedId={feedId || undefined}
                    onPress={() => router.push(`/articles/${article.id}`)}
                    onBookmark={() => handleBookmark(article.id, article.is_read_later || false, article.article_type)}
                    onToggleRead={() => handleToggleRead(article.id, article.is_read || false, article.article_type)}
                />
            );
        }

        return null;
    };

    const renderFooter = () => {
        if (!isFetchingNextPage) return null;
        return (
            <View className="py-4">
                <ActivityIndicator size="small" color="#6A994E" />
            </View>
        );
    };

    const emptyStateMessage = useMemo(() => {
        switch (activeTab) {
            case 0:
                return "No articles for today yet. Check back later!";
            case 1:
                return "No saved articles. Swipe right on articles to bookmark them.";
            case 2:
                return "No articles yet. Add some feeds to get started!";
            case 3:
                return "No recently read articles.";
            default:
                return "No articles available.";
        }
    }, [activeTab]);

    if (isInitialLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
                <Header
                    variant="tabbed"
                    title={title}
                    tabs={TAB_CONFIGS}
                    activeTab={activeTab}
                    onTabChange={selectTab}
                    unreadCount={isPreviewMode ? 0 : unreadCount}
                    scrollY={scrollY}
                    onHeaderHeightChange={setHeaderHeight}
                    rightAction={toggleUnreadButton}
                />
                <ArticleListSkeleton count={6} className="mt-28" />
            </SafeAreaView>
        );
    }

    return (
        <>
            <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
                <Header
                    variant="tabbed"
                    title={title}
                    tabs={TAB_CONFIGS}
                    activeTab={activeTab}
                    onTabChange={selectTab}
                    unreadCount={isPreviewMode ? 0 : unreadCount}
                    scrollY={scrollY}
                    onHeaderHeightChange={setHeaderHeight}
                    rightAction={toggleUnreadButton}
                />
                <LegendList
                    data={listItems}
                    renderItem={renderItem}
                    estimatedItemSize={120}
                    contentContainerStyle={{
                        paddingTop: headerHeight,
                        paddingBottom: isPreviewMode ? 80 : 16,
                    }}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                    keyExtractor={(item) => item.id}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                    ListEmptyComponent={
                        !isInitialLoading ? (
                            <View className="items-center justify-center px-6 py-20">
                                <Monicon
                                    name="solar:inbox-broken"
                                    size={64}
                                    color="#90988B"
                                />
                                <Text className="text-center mt-4 font-geist-medium text-lg text-black dark:text-black-dark mb-2">
                                    Nothing here yet
                                </Text>
                                <Text className="text-center font-geist text-base text-grey dark:text-grey-dark">
                                    {emptyStateMessage}
                                </Text>
                            </View>
                        ) : null
                    }
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            progressBackgroundColor={colors.white}
                            tintColor="#6A994E"
                            colors={['#6A994E']}
                            progressViewOffset={headerHeight}
                        />
                    }
                />

                {/* Sticky preview banner at bottom */}
                {isPreviewMode && feedData && (
                    <View className="absolute bottom-0 left-0 right-0">
                        <FeedPreviewBanner
                            feedTitle={feedData.title}
                            onFollow={handleFollowFromPreview}
                        />
                    </View>
                )}
            </SafeAreaView>

            {/* Folder picker bottom sheet */}
            <FolderPicker ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
        </>
    );
}
