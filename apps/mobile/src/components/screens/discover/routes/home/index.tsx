import { useCallback, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, TouchableWithoutFeedback, View } from 'react-native';
import type { TextInput as RNTextInput } from 'react-native';
import { Text } from '@components/ui/text';
import { useQuery } from '@tanstack/react-query';
import { Monicon } from '@monicon/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchBar, type Language } from '@components/screens/discover/ui/search-bar.input';
import { InfiniteScrollList } from '@components/ui/infinite-scroll-list';
import { Chip } from '@components/ui/chip';
import { FeedListItem } from '@components/screens/discover/ui/feed-list-item.card';
import { Skeleton } from '@components/ui/skeleton';
import { useSearchHistory } from '@stores/search-history';
import { ApiClient, useTrendingFeeds, type DiscoverSearchResponse } from '@readspace/shared';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';

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

export function DiscoverScreen() {
  const [viewState, setViewState] = useState<ViewState>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('english');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const searchBarRef = useRef<RNTextInput>(null);
  const categoryScrollRef = useRef<ScrollView>(null);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const { searches: recentSearches, addSearch } = useSearchHistory();
  const insets = useSafeAreaInsets();

  // Compute bottom padding to account for tab bar
  // Tab bar height = BOTTOM_TABBAR_BASE_HEIGHT + 0.8 * safeAreaBottom (from BottomTabbar component)
  // Add extra spacing (24px) for better visual separation
  const contentPaddingBottom = BOTTOM_TABBAR_BASE_HEIGHT + 24;

  const languageCode =
    selectedLanguage === 'english' ? 'en' : selectedLanguage === 'chinese' ? 'zh' : 'ja';

  // Fetch trending feeds
  const {
    data: trendingData,
    isLoading: isTrendingLoading,
    isFetching: isTrendingFetching,
    error: trendingError,
  } = useTrendingFeeds({ language: languageCode, limit: 20 }, { enabled: viewState === 'default' });

  const showTrendingSkeleton =
    (isTrendingLoading || isTrendingFetching) && (!trendingData || trendingData.length === 0);

  // Search/category feeds
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

  const showSearchSkeleton = (isSearchLoading || isFetching) && !isSearchSuccess && !searchData;

  const handleCategoryPress = useCallback((category: string) => {
    setSelectedCategory(category);
    setViewState('category');
    setSearchQuery('');
    setActiveQuery('');
    setIsSearchFocused(false);
    setTimeout(() => {
      categoryScrollRef.current?.scrollTo({ x: 0, animated: true });
    }, 0);
  }, []);

  const orderedCategories = selectedCategory
    ? [selectedCategory, ...CATEGORIES.filter((c) => c !== selectedCategory)]
    : CATEGORIES;

  const categoriesRow1 = orderedCategories.slice(0, 6);
  const categoriesRow2 = orderedCategories.slice(6);

  const handleSearchSubmit = useCallback(() => {
    if (!searchQuery.trim()) return;
    addSearch(searchQuery);
    setActiveQuery(searchQuery);
    setViewState('search');
    setSelectedCategory(null);
    setIsSearchFocused(false);
    searchBarRef.current?.blur();
    Keyboard.dismiss();
  }, [searchQuery, addSearch]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
    setViewState('focused');
    setSelectedCategory(null);
  }, []);

  const handleSearchCancel = useCallback(() => {
    setIsSearchFocused(false);
    setSearchQuery('');
    setActiveQuery('');
    setViewState('default');
    setSelectedCategory(null);
    searchBarRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setActiveQuery('');
  }, []);

  const handleLanguageChange = useCallback((language: Language) => {
    setSelectedLanguage(language);
  }, []);

  const handleRecentSearchPress = useCallback(
    (query: string) => {
      addSearch(query);
      setSearchQuery(query);
      setActiveQuery(query);
      setViewState('search');
      setIsSearchFocused(false);
      searchBarRef.current?.blur();
      Keyboard.dismiss();
    },
    [addSearch]
  );

  const showClearButton = isSearchFocused || viewState === 'search' || viewState === 'category';
  const showCancelButton = isSearchFocused;

  const handleOutsidePress = useCallback(() => {
    // Only cancel search when in focused mode
    if (viewState === 'focused') {
      handleSearchCancel();
    }
  }, [viewState, handleSearchCancel]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-white-dark" edges={['top']}>
      <TouchableWithoutFeedback onPress={handleOutsidePress}>
        <View className="flex-1">
          {/* Header and Search Bar - Always visible */}
          <View className="px-6">
            {viewState === 'default' && (
              <Text
                size="lg"
                fontFamily="geist-bold"
                className="mb-8 tracking-heading text-black dark:text-black-dark">
                Discover feeds
              </Text>
            )}

            <View className={viewState === 'default' ? 'pb-4' : 'pt-16 pb-4'}>
              <Pressable onPress={(e) => e.stopPropagation()}>
                <SearchBar
                  ref={searchBarRef}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  onFocus={handleSearchFocus}
                  onLanguageChange={handleLanguageChange}
                  selectedLanguage={selectedLanguage}
                  onClear={handleClearSearch}
                  onCancel={handleSearchCancel}
                  onSubmit={handleSearchSubmit}
                  showClearButton={showClearButton}
                  showCancelButton={showCancelButton}
                  autoFocus={false}
                />
              </Pressable>
            </View>
          </View>

          {/* Content Area */}
          <View className="flex-1">
            {viewState === 'focused' ? (
              /* Recent Searches */
              <ScrollView
                showsVerticalScrollIndicator={false}
                className="px-6"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  paddingBottom: contentPaddingBottom,
                }}>
                {recentSearches.length > 0 ? (
                  <>
                    <Text
                      size="base"
                      fontFamily="geist-semibold"
                      className="mb-4 text-black dark:text-black-dark">
                      Recent searches
                    </Text>
                    <View className="gap-3">
                      {recentSearches.map((query) => (
                        <Pressable
                          key={query}
                          onPress={() => handleRecentSearchPress(query)}
                          className="flex-row items-center gap-3 py-2 transition-opacity active:opacity-60">
                          <Monicon
                            name="solar:clock-circle-outline"
                            size={20}
                            color={colors.grey}
                          />
                          <Text
                            size="base"
                            fontFamily="geist"
                            className="flex-1 text-black dark:text-black-dark">
                            {query}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <View className="py-12">
                    <Text
                      size="base"
                      fontFamily="geist"
                      className="text-center text-grey dark:text-grey-dark">
                      No recent searches yet
                    </Text>
                    <Text
                      size="sm"
                      fontFamily="geist"
                      className="mt-2 text-center text-grey dark:text-grey-dark">
                      Your search history will appear here
                    </Text>
                  </View>
                )}
              </ScrollView>
            ) : viewState === 'default' ? (
              /* Default Trending View */
              <ScrollView
                showsVerticalScrollIndicator={false}
                className="flex-1"
                contentContainerStyle={{
                  paddingBottom: contentPaddingBottom,
                }}>
                <View>
                  <View className="mb-4 flex-row items-center justify-between px-6">
                    <Text
                      size="base"
                      fontFamily="geist-semibold"
                      className="text-black dark:text-black-dark">
                      Categories
                    </Text>
                    {selectedCategory && (
                      <Pressable
                        onPress={() => {
                          setViewState('default');
                          setSelectedCategory(null);
                        }}
                        className="transition-opacity active:opacity-60">
                        <Text size="sm" fontFamily="geist-medium" className="text-secondary">
                          Clear
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  <ScrollView
                    ref={categoryScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="pl-6">
                    <View className="gap-2 pr-6">
                      <View className="flex-row gap-2">
                        {categoriesRow1.map((category) => (
                          <Chip
                            key={category}
                            label={category}
                            selected={selectedCategory === category}
                            onPress={() => handleCategoryPress(category)}
                            size="medium"
                          />
                        ))}
                      </View>
                      <View className="flex-row gap-2">
                        {categoriesRow2.map((category) => (
                          <Chip
                            key={category}
                            label={category}
                            selected={selectedCategory === category}
                            onPress={() => handleCategoryPress(category)}
                            size="medium"
                          />
                        ))}
                      </View>
                    </View>
                  </ScrollView>
                </View>

                <View className="mb-4 mt-8 px-6">
                  <Text
                    size="base"
                    fontFamily="geist-semibold"
                    className="text-black dark:text-black-dark">
                    Trending
                  </Text>
                </View>

                {showTrendingSkeleton ? (
                  <View className="gap-4 px-6">
                    {Array.from({ length: 5 }, (_, i) => `trending-skeleton-${i}`).map((key) => (
                      <View key={key} className="flex-row gap-3">
                        <Skeleton variant="circle" width={48} height={48} />
                        <View className="flex-1 gap-2">
                          <Skeleton variant="text" width="70%" height={20} />
                          <Skeleton variant="text" width="100%" height={16} />
                          <Skeleton variant="text" width="80%" height={16} />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : trendingError ? (
                  <View className="items-center justify-center px-6 py-12">
                    <Text
                      size="base"
                      fontFamily="geist"
                      className="mb-2 text-center"
                      style={{ color: '#dc2626' }}>
                      Error loading trending feeds
                    </Text>
                    <Text
                      size="sm"
                      fontFamily="geist"
                      className="text-center text-grey dark:text-grey-dark">
                      {(trendingError as Error).message}
                    </Text>
                  </View>
                ) : trendingData && trendingData.length > 0 ? (
                  <View className="px-6 pb-2">
                    {trendingData.map((feed) => (
                      <FeedListItem
                        key={feed.id}
                        feedId={feed.id}
                        title={feed.title || 'Untitled Feed'}
                        description={feed.description || ''}
                        iconUrl={feed.image_url || undefined}
                        feedUrl={feed.url || undefined}
                        isFollowing={feed.is_subscribed || false}
                        isPreview={feed.is_preview}
                      />
                    ))}
                  </View>
                ) : (
                  <View className="items-center justify-center px-6 py-12">
                    <Text
                      size="base"
                      fontFamily="geist"
                      className="text-center text-grey dark:text-grey-dark">
                      No trending feeds available
                    </Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              /* Search/Category Results */
              <View className="flex-1">
                {showSearchSkeleton ? (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    className="flex-1"
                    contentContainerStyle={{
                      paddingBottom: contentPaddingBottom,
                    }}>
                    <View className="gap-4 px-6 pt-4">
                      {Array.from({ length: 8 }, (_, i) => `search-skeleton-${i}`).map((key) => (
                        <View key={key} className="flex-row gap-3">
                          <Skeleton variant="circle" width={48} height={48} />
                          <View className="flex-1 gap-2">
                            <Skeleton variant="text" width="70%" height={20} />
                            <Skeleton variant="text" width="100%" height={16} />
                            <Skeleton variant="text" width="80%" height={16} />
                          </View>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                ) : searchData?.results && searchData.results.length > 0 ? (
                  <InfiniteScrollList
                    data={searchData.results}
                    estimatedItemSize={80}
                    renderItem={(item) => (
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
                    contentContainerStyle={{
                      paddingBottom: contentPaddingBottom,
                    }}
                    ListHeaderComponent={
                      selectedCategory ? (
                        <View>
                          <View className="mb-4 flex-row items-center justify-between px-6">
                            <Text
                              size="base"
                              fontFamily="geist-semibold"
                              className="text-black dark:text-black-dark">
                              Categories
                            </Text>
                            <Pressable
                              onPress={() => {
                                setViewState('default');
                                setSelectedCategory(null);
                              }}
                              className="transition-opacity active:opacity-60">
                              <Text size="sm" fontFamily="geist-medium" className="text-secondary">
                                Clear
                              </Text>
                            </Pressable>
                          </View>

                          <ScrollView
                            ref={categoryScrollRef}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            className="mb-6 pl-6">
                            <View className="gap-2 pr-6">
                              <View className="flex-row gap-2">
                                {categoriesRow1.map((category) => (
                                  <Chip
                                    key={category}
                                    label={category}
                                    selected={selectedCategory === category}
                                    onPress={() => handleCategoryPress(category)}
                                    size="medium"
                                  />
                                ))}
                              </View>
                              <View className="flex-row gap-2">
                                {categoriesRow2.map((category) => (
                                  <Chip
                                    key={category}
                                    label={category}
                                    selected={selectedCategory === category}
                                    onPress={() => handleCategoryPress(category)}
                                    size="medium"
                                  />
                                ))}
                              </View>
                            </View>
                          </ScrollView>
                        </View>
                      ) : undefined
                    }
                  />
                ) : (
                  <View className="flex-1 items-center justify-center px-6 py-12">
                    <Text
                      size="base"
                      fontFamily="geist"
                      className="text-center text-grey dark:text-grey-dark">
                      No feeds found matching your search
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
