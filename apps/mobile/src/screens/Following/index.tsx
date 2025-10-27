import { ArticleListItem } from '@/components/ArticleListItem';
import { Header } from '@/components/Header';
import { useFeedViewStore } from '@/stores/feed-view';
import { groupArticlesByDate } from '@/utils/dateUtils';
import { generateMockArticles, type MockArticle } from '@/utils/mockArticles';
import { LegendList } from '@legendapp/list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ListItem {
    type: 'section' | 'article' | 'divider';
    id: string;
    data?: MockArticle;
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
    const scrollY = useSharedValue(0);

    // Generate mock data
    const allArticles = useMemo(() => generateMockArticles(), []);

    // Determine the title based on view state
    const title = useMemo(() => {
        if (viewType === 'feed' && selectedName) {
            return selectedName;
        } else if (viewType === 'folder' && selectedName) {
            return selectedName;
        }
        return 'Following';
    }, [viewType, selectedName]);

    // Filter articles based on view type and active tab
    const filteredArticles = useMemo(() => {
        let articles = allArticles;

        // First, filter by feed or folder if selected
        if (viewType === 'feed' && selectedId) {
            // In a real app, filter articles by feed ID
            // For now, just return all articles as mock implementation
            articles = allArticles;
        } else if (viewType === 'folder' && selectedId) {
            // In a real app, filter articles by folder ID (all feeds in folder)
            // For now, just return all articles as mock implementation
            articles = allArticles;
        } else {
            // Filter by tab when in "following" view
            switch (activeTab) {
                case 0: // Today
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return allArticles.filter((article) => {
                        const articleDate = new Date(article.date);
                        articleDate.setHours(0, 0, 0, 0);
                        return articleDate.getTime() === today.getTime();
                    });
                case 1: // Saved
                    return allArticles.filter((article) => article.isSaved);
                case 2: // All
                    return allArticles;
                case 3: // Recent (unread)
                    return allArticles.filter((article) => !article.isRead);
                default:
                    return allArticles;
            }
        }

        return articles;
    }, [allArticles, activeTab, viewType, selectedId]);

    // Group articles by date and create flat list with sections and dividers
    const listItems = useMemo(() => {
        const grouped = groupArticlesByDate(filteredArticles);
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
    }, [filteredArticles]);

    const unreadCount = useMemo(() => {
        return allArticles.filter((article) => !article.isRead).length;
    }, [allArticles]);

    const scrollHandler = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.value = event.nativeEvent.contentOffset.y;
    };

    const renderItem = ({ item }: { item: ListItem }) => {
        if (item.type === 'section') {
            return (
                <View className="px-4 pb-2 pt-4">
                    <Text className="font-geist-semibold text-sm text-secondary">{item.sectionTitle}</Text>
                </View>
            );
        }

        if (item.type === 'divider') {
            return <View className="mx-4 h-[0.5px] bg-light-grey" />;
        }

        if (item.type === 'article' && item.data) {
            return (
                <ArticleListItem
                    className="px-4"
                    source={item.data.source}
                    timestamp={item.data.timestamp}
                    title={item.data.title}
                    description={item.data.description}
                    imageUrl={item.data.imageUrl}
                    faviconUrl={item.data.faviconUrl}
                    isRead={item.data.isRead}
                    isSaved={item.data.isSaved}
                    onPress={() => router.push(`/articles/${item.data?.id}`)}
                />
            );
        }

        return null;
    };

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
            />
        </SafeAreaView>
    );
}

