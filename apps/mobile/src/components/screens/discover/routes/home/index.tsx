import {
  CreateFolderModal,
  type CreateFolderModalRef,
} from '@components/bottom-sheets/create-folder';
import PlusIcon from '@components/icons/local/plus';
import { CategoriesList } from '@/components/screens/discover/ui/categories.list';
import { RecentSearches } from '@components/screens/discover/ui/recent-searches';
import { SearchResults } from '@/components/screens/discover/ui/search-results.list';
import { type Language, SearchBar } from '@components/screens/discover/ui/search-bar.input';
import { TrendingSection } from '@/components/screens/discover/ui/trending-section.list';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useDiscoverScroll } from '@contexts/discover-scroll-context';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { ApiClient } from '@readspace/shared';
import { useSearchHistory } from '@stores/search-history';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState, useMemo } from 'react';
import type { TextInput as RNTextInput } from 'react-native';
import {
  Keyboard,
  LayoutAnimation,
  Pressable,
  ScrollView,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InstantSearch, Configure, useSearchBox, useMenu, useInfiniteHits, useInstantSearch } from 'react-instantsearch';
import { createSearchClient, meilisearchClient, FEEDS_INDEX_NAME } from '@lib/meilisearch-client';

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

import type { FeedSummary } from '@readspace/shared';
export function DiscoverScreen() {
  const { searchClient } = useMemo(() => createSearchClient(), []);

  return (
    <InstantSearch searchClient={searchClient as any} indexName={FEEDS_INDEX_NAME}>
      <Configure hitsPerPage={20} attributesToHighlight={['title', 'description']} />
      <DiscoverScreenInner />
    </InstantSearch>
  );
}

function DiscoverScreenInner() {
  const [viewState, setViewState] = useState<ViewState>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('english');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const searchBarRef = useRef<RNTextInput>(null);
  const categoryScrollRef = useRef<ScrollView>(null);
  const createFolderModalRef = useRef<CreateFolderModalRef>(null);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const { searches: recentSearches, addSearch } = useSearchHistory();
  const { setIsSearching } = useDiscoverScroll();

  // Compute bottom padding to account for tab bar
  // Tab bar height = BOTTOM_TABBAR_BASE_HEIGHT + 0.8 * safeAreaBottom (from BottomTabbar component)
  // Add extra spacing (24px) for better visual separation
  const contentPaddingBottom = BOTTOM_TABBAR_BASE_HEIGHT + 24;

  const languageCode =
    selectedLanguage === 'english' ? 'en' : selectedLanguage === 'chinese' ? 'zh' : 'ja';

  // Fetch trending feeds using Meilisearch directly
  const {
    data: trendingData,
    isLoading: isTrendingLoading,
    isFetching: isTrendingFetching,
    error: trendingError,
  } = useQuery({
    queryKey: ['trending', languageCode],
    queryFn: async () => {
      const res = await meilisearchClient.index(FEEDS_INDEX_NAME).search('', {
        limit: 20,
        filter: [`language=${languageCode}`], // Assuming 'language' is a filterable attribute
      });
      return res.hits as unknown as FeedSummary[];
    },
    enabled: viewState === 'default',
  });

  const showTrendingSkeleton =
    (isTrendingLoading || isTrendingFetching) && (!trendingData || trendingData.length === 0);

  const { refine: refineQuery } = useSearchBox();
  const { refine: refineCategory } = useMenu({ attribute: 'top_level_category', limit: 100 });
  const { refine: refineLanguage } = useMenu({ attribute: 'language', limit: 10 });
  const { items: hits, isLastPage } = useInfiniteHits();
  const { status } = useInstantSearch();

  const isSearchLoading = status === 'loading' || status === 'stalled';
  const showSearchSkeleton = isSearchLoading && hits.length === 0;

  const handleCategoryPress = useCallback(
    (category: string) => {
      setSelectedCategory(category);
      refineCategory(category);

      setViewState('category');
      setSearchQuery('');
      setActiveQuery('');
      refineQuery('');
      setIsSearchFocused(false);
      setTimeout(() => {
        categoryScrollRef.current?.scrollTo({ x: 0, animated: true });
      }, 0);
      setIsSearching?.(true);
    },
    [setIsSearching]
  );

  const orderedCategories = selectedCategory
    ? [selectedCategory, ...CATEGORIES.filter((c) => c !== selectedCategory)]
    : CATEGORIES;

  const categoriesRow1 = orderedCategories.slice(0, 6);
  const categoriesRow2 = orderedCategories.slice(6);

  const handleSearchSubmit = useCallback(() => {
    if (!searchQuery.trim()) return;
    addSearch(searchQuery);
    setActiveQuery(searchQuery);
    refineQuery(searchQuery);

    setViewState('search');
    setSelectedCategory(null);
    refineCategory('');
    setIsSearchFocused(false);
    searchBarRef.current?.blur();
    Keyboard.dismiss();
    setIsSearching?.(true);
  }, [searchQuery, addSearch, setIsSearching]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSearchFocus = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearchFocused(true);
    setViewState('focused');
    setSelectedCategory(null);
    setIsSearching?.(true);
  }, [setIsSearching]);

  const handleSearchCancel = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearchFocused(false);
    setSearchQuery('');
    setActiveQuery('');
    refineQuery('');
    setViewState('default');
    setSelectedCategory(null);
    refineCategory('');
    searchBarRef.current?.blur();
    Keyboard.dismiss();
    setIsSearching?.(false);
  }, [setIsSearching]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setActiveQuery('');
    refineQuery('');
  }, [refineQuery]);

  const handleLanguageChange = useCallback((language: Language) => {
    setSelectedLanguage(language);
    refineLanguage(language === 'english' ? 'en' : language === 'chinese' ? 'zh' : 'ja');
  }, [refineLanguage]);

  const handleRecentSearchPress = useCallback(
    (query: string) => {
      addSearch(query);
      setSearchQuery(query);
      setActiveQuery(query);
      refineQuery(query);
      setViewState('search');
      setSelectedCategory(null);
      refineCategory('');
      setIsSearchFocused(false);
      searchBarRef.current?.blur();
      Keyboard.dismiss();
      setIsSearching?.(true);
    },
    [addSearch, setIsSearching]
  );

  const showClearButton = isSearchFocused || viewState === 'search' || viewState === 'category';
  const showCancelButton = isSearchFocused;

  const handleOutsidePress = useCallback(() => {
    // Only cancel search when in focused mode
    if (viewState === 'focused') {
      handleSearchCancel();
    }
  }, [viewState, handleSearchCancel]);

  const handleClearCategory = useCallback(() => {
    setViewState('default');
    setSelectedCategory(null);
    refineCategory('');
    setIsSearching?.(false);
  }, [setIsSearching, refineCategory]);

  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <TouchableWithoutFeedback onPress={handleOutsidePress}>
        <View className="flex-1">
          {/* Header and Search Bar - Always visible */}
          <View className="px-6">
            {viewState === 'default' && (
              <View className="mb-8 flex-row items-center justify-between">
                <Text size="lg" fontFamily="geist-bold" className="tracking-heading text-black">
                  Discover
                </Text>
                <Button
                  variant="icon"
                  size="large"
                  className="h-9 w-9 rounded-full bg-grey-5 dark:bg-grey-5"
                  fullWidth={false}
                  onPress={() => createFolderModalRef.current?.present()}
                  style={{ backgroundColor: colors.grey5 }}>
                  <PlusIcon width={22} height={22} fill={colors.grey} strokeWidth={2} />
                </Button>
              </View>
            )}

            <View className="pb-4">
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
              <RecentSearches
                recentSearches={recentSearches}
                onRecentSearchPress={handleRecentSearchPress}
                contentPaddingBottom={contentPaddingBottom}
                colors={colors}
              />
            ) : viewState === 'default' ? (
              /* Default Trending View */
              <ScrollView
                showsVerticalScrollIndicator={false}
                className="flex-1"
                contentContainerStyle={{
                  paddingBottom: contentPaddingBottom,
                }}>
                <CategoriesList
                  selectedCategory={selectedCategory}
                  categoriesRow1={categoriesRow1}
                  categoriesRow2={categoriesRow2}
                  onCategoryPress={handleCategoryPress}
                  onClearCategory={handleClearCategory}
                  categoryScrollRef={categoryScrollRef}
                />

                <TrendingSection
                  showTrendingSkeleton={showTrendingSkeleton}
                  trendingError={trendingError}
                  trendingData={trendingData}
                />
              </ScrollView>
            ) : (
              /* Search/Category Results */
              <SearchResults
                showSearchSkeleton={showSearchSkeleton}
                hits={hits as any}
                contentPaddingBottom={contentPaddingBottom}
                selectedCategory={selectedCategory}
                categoriesRow1={categoriesRow1}
                categoriesRow2={categoriesRow2}
                onCategoryPress={handleCategoryPress}
                onClearCategory={handleClearCategory}
                categoryScrollRef={categoryScrollRef}
              />
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* Create Folder Modal */}
      <CreateFolderModal ref={createFolderModalRef} />
    </View>
  );
}
