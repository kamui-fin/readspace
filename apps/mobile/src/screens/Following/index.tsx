import { ArticleListItem } from '@/components/ArticleListItem';
import { Header } from '@/components/Header';
import { useFeedViewStore } from '@/stores/feed-view';
import { groupArticlesByDate } from '@/utils/dateUtils';
import { LegendList } from '@legendapp/list';
import {
    type Article,
    formatRelativeDate,
    useFeeds,
    useInfiniteArticles,
    useInfiniteReadLaterArticles,
    useInfiniteRecentlyReadArticles,
    useInfiniteTodayArticles,
    useUnreadCounts,
    useUpdateArticle,
} from '@readspace/shared';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
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
    const viewType = useFeedViewStore((state) => state.viewType);
    const selectedId = useFeedViewStore((state) => state.selectedId);
    const selectedName = useFeedViewStore((state) => state.selectedName);
    const activeTab = useFeedViewStore((state) => state.activeTab);
    const selectTab = useFeedViewStore((state) => state.selectTab);

    const [headerHeight, setHeaderHeight] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const scrollY = useSharedValue(0);

    // Determine query parameters based on view type and active tab
    const queryParams = useMemo(() => {
        // If viewing a specific feed
        if (viewType === 'feed' && selectedId) {
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
    const isViewingFeedOrFolder = activeTab === -1 && (viewType === 'feed' || viewType === 'folder');

    // Select the appropriate query hook based on active tab
    const todayQuery = useInfiniteTodayArticles({ size: 25 }, { enabled: activeTab === 0 } as any);
    const savedQuery = useInfiniteReadLaterArticles({ size: 25 }, {
        enabled: activeTab === 1,
    } as any);
    const allQuery = useInfiniteArticles({ ...queryParams, size: 25 }, {
        enabled: activeTab === 2 || isViewingFeedOrFolder,
    } as any);
    const recentQuery = useInfiniteRecentlyReadArticles({ size: 25 }, {
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

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = activeQuery;

    // Flatten paginated articles
    const allArticles = useMemo(() => {
        if (!data?.pages || !Array.isArray(data.pages)) return [];
        return data.pages.flatMap((page: any) => page.items || []);
    }, [data]);

    // Get unread counts - for feed/folder specific counts
    const { data: unreadCounts } = useUnreadCounts();
    const { data: feedsData } = useFeeds();

    // Calculate count based on active view
    const unreadCount = useMemo(() => {
        const feeds = (feedsData as { id: string; unread_count?: number; folder_id?: string }[]) || [];
        const counts = unreadCounts as {
            total_unread?: number;
            unread_by_folder?: { folder_id: string; unread_count: number }[]
        };

        // For feed-specific view
        if (viewType === 'feed' && selectedId) {
            const feed = feeds.find(f => f.id === selectedId);
            return feed?.unread_count || 0;
        }

        // For folder-specific view
        if (viewType === 'folder' && selectedId) {
            const folderUnread = counts?.unread_by_folder?.find(
                (item) => item.folder_id === selectedId
            );
            return folderUnread?.unread_count || 0;
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

    // Determine the title based on view state
    const title = useMemo(() => {
        if (viewType === 'feed' && selectedName) {
            return selectedName;
        } else if (viewType === 'folder' && selectedName) {
            return selectedName;
        }
        return 'Following';
    }, [viewType, selectedName]);

    // Group articles by date and create flat list with sections and dividers
    const listItems = useMemo(() => {
        type ArticleWithDate = Article & { date: Date };
        const articlesWithDates: ArticleWithDate[] = allArticles.map((article: Article) => ({
            ...article,
            date: article.published_at ? new Date(article.published_at) : new Date(),
        }));
        const grouped = groupArticlesByDate(articlesWithDates);
        const items: ListItem[] = [];

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
                        id: `divider-${article.id}`,
                    });
                }
            }

            // Add divider after section (before next section)
            items.push({
                type: 'divider',
                id: `divider-section-${sectionTitle}`,
            });
        }

        return items;
    }, [allArticles]);

    const scrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.value = event.nativeEvent.contentOffset.y;
    };

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const handleBookmark = useCallback(
        (articleId: string, currentlySaved: boolean) => {
            updateArticle.mutate({
                articleId,
                data: { is_read_later: !currentlySaved },
                articleType: 'feed',
            });
            toast.success(currentlySaved ? 'Removed from saved' : 'Saved for later');
        },
        [updateArticle]
    );

    const handleToggleRead = useCallback(
        (articleId: string, currentlyRead: boolean) => {
            updateArticle.mutate({
                articleId,
                data: { is_read: !currentlyRead },
                articleType: 'feed',
            });
            toast.success(currentlyRead ? 'Marked as unread' : 'Marked as read');
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
            return <View className="mx-4 h-[0.5px] bg-light-grey" />;
        }

        if (item.type === 'article' && item.data) {
            const article = item.data;
            const feedTitle =
                typeof article.feed === 'object' && article.feed ? article.feed.title : undefined;
            const feedImageUrl =
                typeof article.feed === 'object' && article.feed
                    ? article.feed.image_url
                    : undefined;
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
                    faviconUrl={feedImageUrl || undefined}
                    isRead={article.is_read || false}
                    isSaved={article.is_read_later || false}
                    onPress={() => router.push(`/articles/${article.id}`)}
                    onBookmark={() => handleBookmark(article.id, article.is_read_later || false)}
                    onToggleRead={() => handleToggleRead(article.id, article.is_read || false)}
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

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white" edges={['top']}>
                <Header
                    variant="tabbed"
                    title={title}
                    tabs={TAB_CONFIGS}
                    activeTab={activeTab}
                    onTabChange={selectTab}
                    unreadCount={unreadCount}
                    scrollY={scrollY}
                    onHeaderHeightChange={setHeaderHeight}
                />
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#6A994E" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            <Header
                variant="tabbed"
                title={title}
                tabs={TAB_CONFIGS}
                activeTab={activeTab}
                onTabChange={selectTab}
                unreadCount={unreadCount}
                scrollY={scrollY}
                onHeaderHeightChange={setHeaderHeight}
            />
            <LegendList
                data={listItems}
                renderItem={renderItem}
                estimatedItemSize={120}
                contentContainerStyle={{ paddingTop: headerHeight }}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                keyExtractor={(item) => item.id}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderFooter}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor="#6A994E"
                        colors={['#6A994E']}
                        progressViewOffset={headerHeight}
                    />
                }
            />
        </SafeAreaView>
    );
}
