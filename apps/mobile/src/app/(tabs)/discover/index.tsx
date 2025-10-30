import { FeedListItem } from '@/components/FeedListItem';
import { LanguagePicker, type Language } from '@/components/LanguagePicker';
import { SearchBar } from '@/components/SearchBar';
import { FeedListSkeleton } from '@/components/skeletons';
import { Chip } from '@/components/ui/Chip';
import { useSearchHistory } from '@/stores/search-history';
import BottomSheet from '@gorhom/bottom-sheet';
import { LegendList } from '@legendapp/list';
import { Monicon } from '@monicon/native';
import {
    ApiClient,
    useTrendingFeeds,
    type DiscoverSearchResponse,
    type Feed
} from '@readspace/shared';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
    Keyboard,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

// Feed categories from RSS dataset
const CATEGORIES = [
    'Technology & Programming',
    'Culture & Arts',
    'Lifestyle & Personal',
    'Miscellaneous',
    'Design & Creativity',
    'Science & Research',
    'News & Politics',
    'Gaming & Entertainment',
    'Business & Finance',
    'Artificial Intelligence',
    'Security & Privacy',
    'Education & Learning',
];

type ViewState = 'default' | 'category' | 'search' | 'focused';

export default function DiscoverScreen() {
    const [viewState, setViewState] = useState<ViewState>('default');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeQuery, setActiveQuery] = useState(''); // Actual query sent to API
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedLanguage, setSelectedLanguage] = useState<Language>('english');
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const languagePickerRef = useRef<BottomSheet>(null);
    const searchBarRef = useRef<any>(null);
    const categoryScrollRef = useRef<ScrollView>(null);

    const { searches: recentSearches, addSearch } = useSearchHistory();

    // Animation for search bar
    const searchBarTop = useSharedValue(0);

    const searchBarAnimatedStyle = useAnimatedStyle(() => ({
        paddingTop: withTiming(searchBarTop.value, { duration: 300 }),
    }));

    // Map language display names to API codes
    const languageCode =
        selectedLanguage === 'english' ? 'en' : selectedLanguage === 'chinese' ? 'zh' : 'ja';

    // Fetch trending feeds for default view
    const { data: trendingData, isLoading: isTrendingLoading, isFetching: isTrendingFetching, isSuccess: isTrendingSuccess, error: trendingError } = useTrendingFeeds(
        {
            language: languageCode,
            limit: 20,
        },
        {
            enabled: viewState === 'default',
        }
    );

    // Only show skeleton on initial load, not on refetch
    const showTrendingSkeleton = (isTrendingLoading || isTrendingFetching) && !isTrendingSuccess && !trendingData;


    // Search query for category or text search
    const {
        data: searchData,
        isLoading: isSearchLoading,
        isFetching,
        isSuccess: isSearchSuccess,
    } = useQuery<DiscoverSearchResponse>({
        queryKey: ['discover', 'search', activeQuery, selectedCategory, languageCode],
        queryFn: async () => {
            return await ApiClient.rss.searchFeeds({
                q: activeQuery || undefined,
                category: selectedCategory || undefined,
                language: languageCode,
                limit: 50,
            });
        },
        enabled: viewState === 'category' || viewState === 'search',
    });

    // Only show skeleton on initial load, not on refetch
    const showSearchSkeleton = (isSearchLoading || isFetching) && !isSearchSuccess && !searchData;

    const handleCategoryPress = (category: string) => {
        setSelectedCategory(category);
        setViewState('category');
        setSearchQuery('');
        setActiveQuery('');
        setIsSearchFocused(false);
        searchBarTop.value = 0;
        // Scroll to the beginning after category selection
        setTimeout(() => {
            categoryScrollRef.current?.scrollTo({ x: 0, animated: true });
        }, 0);
    };

    // Reorder categories to put selected one first
    const getOrderedCategories = () => {
        if (!selectedCategory) {
            return CATEGORIES;
        }
        const filtered = CATEGORIES.filter((cat) => cat !== selectedCategory);
        return [selectedCategory, ...filtered];
    };

    const orderedCategories = getOrderedCategories();

    const handleSearchSubmit = () => {
        if (searchQuery.trim()) {
            // Add to search history
            addSearch(searchQuery);

            setActiveQuery(searchQuery);
            setViewState('search');
            setSelectedCategory(null);
            setIsSearchFocused(false);
            searchBarRef.current?.blur();
            Keyboard.dismiss();
        }
    };

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        // If search is cleared, don't automatically search
    };

    const handleSearchFocus = () => {
        setIsSearchFocused(true);
        setViewState('focused');
        setSelectedCategory(null);
    };

    const handleSearchCancel = () => {
        setIsSearchFocused(false);
        setSearchQuery('');
        setActiveQuery('');
        setViewState('default');
        setSelectedCategory(null);
        searchBarRef.current?.blur();
        Keyboard.dismiss();
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setActiveQuery('');
    };

    const handleLanguagePress = () => {
        languagePickerRef.current?.expand();
    };

    const handleLanguageChange = (language: string) => {
        setSelectedLanguage(language as Language);
    };

    const handleRecentSearchPress = (query: string) => {
        // Move this search to the front of history
        addSearch(query);

        setSearchQuery(query);
        setActiveQuery(query);
        setViewState('search');
        setIsSearchFocused(false);
        searchBarRef.current?.blur();
        Keyboard.dismiss();
    };

    const showClearButton = isSearchFocused || viewState === 'search' || viewState === 'category';
    const showCancelButton = isSearchFocused;

    // Split categories into two rows (6 per row)
    const categoriesRow1 = orderedCategories.slice(0, 6);
    const categoriesRow2 = orderedCategories.slice(6);

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
            <View className="flex-1">
                {/* Header and Search Bar */}
                <Animated.View style={searchBarAnimatedStyle} className="px-6">
                    {viewState === 'default' && (
                        <Text className="mb-6 font-geist-bold text-3xl tracking-heading text-black dark:text-black-dark">
                            Discover feeds
                        </Text>
                    )}

                    <SearchBar
                        ref={searchBarRef}
                        placeholder="What are you looking for?"
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                        onFocus={handleSearchFocus}
                        onLanguagePress={handleLanguagePress}
                        onClear={handleClearSearch}
                        onCancel={handleSearchCancel}
                        onSubmit={handleSearchSubmit}
                        showClearButton={showClearButton}
                        showCancelButton={showCancelButton}
                        autoFocus={false}
                    />
                </Animated.View>

                {/* Content Area */}
                <View className="mt-6 flex-1">
                    {viewState === 'focused' ? (
                        /* Recent Searches / Search Focus View */
                        <ScrollView showsVerticalScrollIndicator={false} className="px-6">
                            {recentSearches.length > 0 ? (
                                <>
                                    <Text className="mb-4 font-geist-semibold text-base text-black dark:text-black-dark">
                                        Recent searches
                                    </Text>
                                    <View className="gap-3">
                                        {recentSearches.map((query, index) => (
                                            <Pressable
                                                key={index}
                                                onPress={() => handleRecentSearchPress(query)}
                                                className="flex-row items-center gap-3 py-2 transition-opacity active:opacity-60">
                                                <Monicon
                                                    name="solar:clock-circle-outline"
                                                    size={20}
                                                    color="#90988B"
                                                />
                                                <Text className="flex-1 font-geist text-base text-black dark:text-black-dark">
                                                    {query}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </>
                            ) : (
                                <View className="py-12">
                                    <Text className="text-center font-geist text-base text-grey dark:text-grey-dark">
                                        No recent searches yet
                                    </Text>
                                    <Text className="mt-2 text-center font-geist text-sm text-grey dark:text-grey-dark">
                                        Your search history will appear here
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                    ) : viewState === 'default' ? (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Categories */}
                            <View>
                                <View className="mb-4 flex-row items-center justify-between px-6">
                                    <Text className="font-geist-semibold text-base text-black dark:text-black-dark">
                                        Categories
                                    </Text>
                                    {selectedCategory && (
                                        <Pressable
                                            onPress={() => {
                                                setViewState('default');
                                                setSelectedCategory(null);
                                            }}
                                            className="transition-opacity active:opacity-60">
                                            <Text className="font-geist-medium text-sm text-secondary">
                                                Clear
                                            </Text>
                                        </Pressable>
                                    )}
                                </View>

                                {/* Combined scrollable categories - both rows scroll together */}
                                <ScrollView
                                    ref={categoryScrollRef}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    className="pl-6">
                                    <View className="gap-2 pr-6">
                                        {/* First row */}
                                        <View className="flex-row gap-2">
                                            {categoriesRow1.map((category) => (
                                                <Chip
                                                    key={category}
                                                    label={category}
                                                    selected={selectedCategory === category}
                                                    onPress={() => handleCategoryPress(category)}
                                                />
                                            ))}
                                        </View>
                                        {/* Second row */}
                                        <View className="flex-row gap-2">
                                            {categoriesRow2.map((category) => (
                                                <Chip
                                                    key={category}
                                                    label={category}
                                                    selected={selectedCategory === category}
                                                    onPress={() => handleCategoryPress(category)}
                                                />
                                            ))}
                                        </View>
                                    </View>
                                </ScrollView>
                            </View>

                            {/* Trending */}
                            <View className="mt-8 px-6">
                                <Text className="mb-4 font-geist-semibold text-base text-black dark:text-black-dark">
                                    Trending
                                </Text>
                                {showTrendingSkeleton ? (
                                    <FeedListSkeleton count={5} />
                                ) : trendingError ? (
                                    <View className="py-8">
                                        <Text className="text-center text-base text-red-600 mb-2">
                                            Error loading trending feeds
                                        </Text>
                                        <Text className="text-center text-sm text-grey dark:text-grey-dark">
                                            {trendingError.message}
                                        </Text>
                                    </View>
                                ) : trendingData && trendingData.length > 0 ? (
                                    <LegendList
                                        data={trendingData}
                                        estimatedItemSize={80}
                                        renderItem={({ item: feed }: { item: Feed }) => (
                                            <FeedListItem
                                                feedId={feed.id}
                                                title={feed.title || 'Untitled Feed'}
                                                description={feed.description || ''}
                                                iconUrl={feed.image_url || undefined}
                                                isFollowing={feed.is_subscribed || false}
                                                isPreview={feed.is_preview}
                                            />
                                        )}
                                        keyExtractor={(item: Feed) => item.id}
                                    />
                                ) : (
                                    <Text className="py-8 text-center text-grey dark:text-grey-dark">
                                        No trending feeds available
                                    </Text>
                                )}
                            </View>
                        </ScrollView>
                    ) : (
                        /* Feed List (for category or search view) */
                        <View className="flex-1">
                            {/* Show categories when filtering */}
                            {selectedCategory && (
                                <View className="mb-6">
                                    <View className="mb-4 flex-row items-center justify-between px-6">
                                        <Text className="font-geist-semibold text-base text-black dark:text-black-dark">
                                            Categories
                                        </Text>
                                        <Pressable
                                            onPress={() => {
                                                setViewState('default');
                                                setSelectedCategory(null);
                                            }}
                                            className="transition-opacity active:opacity-60">
                                            <Text className="font-geist-medium text-sm text-secondary">
                                                Clear
                                            </Text>
                                        </Pressable>
                                    </View>

                                    {/* Combined scrollable categories - both rows scroll together */}
                                    <ScrollView
                                        ref={categoryScrollRef}
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        className="pl-6">
                                        <View className="gap-2 pr-6">
                                            {/* First row */}
                                            <View className="flex-row gap-2">
                                                {categoriesRow1.map((category) => (
                                                    <Chip
                                                        key={category}
                                                        label={category}
                                                        selected={selectedCategory === category}
                                                        onPress={() =>
                                                            handleCategoryPress(category)
                                                        }
                                                    />
                                                ))}
                                            </View>
                                            {/* Second row */}
                                            <View className="flex-row gap-2">
                                                {categoriesRow2.map((category) => (
                                                    <Chip
                                                        key={category}
                                                        label={category}
                                                        selected={selectedCategory === category}
                                                        onPress={() =>
                                                            handleCategoryPress(category)
                                                        }
                                                    />
                                                ))}
                                            </View>
                                        </View>
                                    </ScrollView>
                                </View>
                            )}

                            {showSearchSkeleton ? (
                                <View className="flex-1 px-6 py-4">
                                    <FeedListSkeleton count={8} />
                                </View>
                            ) : searchData?.results && searchData.results.length > 0 ? (
                                <LegendList
                                    data={searchData.results}
                                    estimatedItemSize={80}
                                    renderItem={({ item }) => (
                                        <FeedListItem
                                            feedId={item.id}
                                            title={item.title || 'Untitled Feed'}
                                            description={item.description || ''}
                                            iconUrl={item.image_url || undefined}
                                            isFollowing={item.is_subscribed || false}
                                            className="px-6"
                                            isPreview={item.is_preview}
                                        />
                                    )}
                                    keyExtractor={(item) => item.id}
                                    showsVerticalScrollIndicator={false}
                                />
                            ) : (
                                <View className="flex-1 items-center justify-center px-6 py-12">
                                    <Text className="text-center text-base text-grey dark:text-grey-dark">
                                        No feeds found matching your search
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </View>

            {/* Language Picker Bottom Sheet */}
            <LanguagePicker
                ref={languagePickerRef}
                initialLanguage={selectedLanguage}
                onLanguageChange={handleLanguageChange}
            />
        </SafeAreaView>
    );
}
