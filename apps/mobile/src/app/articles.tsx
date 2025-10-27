import { ArticleListItem } from '@/components/ArticleListItem';
import { Header } from '@/components/Header';
import { groupArticlesByDate } from '@/utils/dateUtils';
import { generateMockArticles, type MockArticle } from '@/utils/mockArticles';
import { MOCK_FEEDS, MOCK_FOLDERS } from '@/utils/mockFeeds';
import { LegendList } from '@legendapp/list';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

const TAB_CONFIGS = [{ label: 'All', iconName: 'solar:calendar-mark-linear' }];

export default function ArticlesScreen() {
    const router = useRouter();
    const { feed_id, folder_id } = useLocalSearchParams<{ feed_id?: string; folder_id?: string }>();
    const scrollY = useSharedValue(0);
    const [selectedTabIndex, setSelectedTabIndex] = useState(0);

    // Find the feed or folder name
    const title = useMemo(() => {
        if (feed_id) {
            const feed = MOCK_FEEDS.find((f) => f.id === feed_id);
            return feed?.name || 'Feed';
        } else if (folder_id) {
            const folder = MOCK_FOLDERS.find((f) => f.id === folder_id);
            return folder?.name || 'Folder';
        }
        return 'Articles';
    }, [feed_id, folder_id]);

    // Filter articles by feed_id or folder_id (mock implementation - in real app, would filter by feed/folder)
    const articles = useMemo(() => {
        // For now, just generate mock articles
        // In a real implementation, you'd filter articles by the feed_id or folder_id
        return generateMockArticles();
    }, [feed_id, folder_id]);

    const groupedArticles = useMemo(() => groupArticlesByDate(articles), [articles]);

    const listData = useMemo<ListItem[]>(() => {
        const items: ListItem[] = [];
        const sortedDates = Object.keys(groupedArticles).sort(
            (a, b) => new Date(b).getTime() - new Date(a).getTime()
        );

        sortedDates.forEach((date, dateIndex) => {
            // Add section header
            items.push({
                type: 'section',
                id: `section-${date}`,
                sectionTitle: date,
            });

            // Add articles
            groupedArticles[date].forEach((article, articleIndex) => {
                items.push({
                    type: 'article',
                    id: article.id,
                    data: article,
                });

                // Add divider after each article except the last one in the section
                if (articleIndex < groupedArticles[date].length - 1) {
                    items.push({
                        type: 'divider',
                        id: `divider-${article.id}`,
                    });
                }
            });
        });

        return items;
    }, [groupedArticles]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.value = event.nativeEvent.contentOffset.y;
    };

    const renderItem = ({ item }: { item: ListItem }) => {
        if (item.type === 'section') {
            return (
                <View className="bg-off-white px-6 py-3">
                    <Text className="font-geist-semibold text-sm tracking-subheading text-grey">
                        {item.sectionTitle}
                    </Text>
                </View>
            );
        }

        if (item.type === 'divider') {
            return <View className="mx-6 h-[1px] bg-light-grey" />;
        }

        if (item.type === 'article' && item.data) {
            return <ArticleListItem article={item.data} />;
        }

        return null;
    };

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-off-white">
            <Header
                title={title}
                tabs={TAB_CONFIGS}
                selectedTabIndex={selectedTabIndex}
                onTabPress={setSelectedTabIndex}
                scrollY={scrollY}
                onBackPress={() => router.back()}
            />

            <LegendList
                data={listData}
                renderItem={renderItem}
                estimatedItemSize={100}
                onScroll={handleScroll}
                scrollEventThrottle={16}
            />
        </SafeAreaView>
    );
}

