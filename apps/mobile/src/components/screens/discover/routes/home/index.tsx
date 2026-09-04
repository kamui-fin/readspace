import { AddFeedBottomSheet, type AddFeedBottomSheetRef } from '@components/bottom-sheets/add-feed';
import {
  CreateFolderModal,
  type CreateFolderModalRef,
} from '@components/bottom-sheets/create-folder';
import {
  FolderPickerBottomSheet,
  type FolderPickerBottomSheetRef,
} from '@components/bottom-sheets/folder-picker';
import { Plus } from '@components/icons/svg';
import { LanguagePicker } from '@components/screens/discover/ui/language-picker.dropdown';
import { RecentSearches } from '@components/screens/discover/ui/recent-searches';
import { type Language, SearchBar } from '@components/screens/discover/ui/search-bar.input';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useDiscoverController } from '@hooks/useDiscoverController';
import {
  BOTTOM_TABBAR_BASE_HEIGHT,
  MAX_TRENDING_ITEMS,
  TRENDING_PAGE_SIZE,
} from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { createSearchClient, FEEDS_INDEX_NAME, meilisearchClient } from '@lib/meilisearch-client';
import type { FeedSummary } from '@readspace/shared';
import { MOBILE_CATEGORY_NAMES, POPULAR_CATEGORIES, useCreateFeed } from '@readspace/shared';
import { useSearchHistory } from '@stores/search-history';
import { useInfiniteQuery } from '@tanstack/react-query';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  Configure,
  InstantSearch,
  useInfiniteHits,
  useInstantSearch,
} from 'react-instantsearch';
import type { TextInput as RNTextInput } from 'react-native';
import {
  DeviceEventEmitter,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoriesList } from '@/components/screens/discover/ui/categories.list';
import { SearchResults } from '@/components/screens/discover/ui/search-results.list';
import { TrendingSection } from '@/components/screens/discover/ui/trending-section.list';

const CATEGORIES = Object.keys(MOBILE_CATEGORY_NAMES);

type ViewState = 'default' | 'category' | 'search' | 'focused';

export function DiscoverScreen() {
  const { searchClient } = useMemo(() => createSearchClient(), []);

  return (
    <InstantSearch
      searchClient={searchClient as any}
      indexName={FEEDS_INDEX_NAME}
      future={{ preserveSharedStateOnUnmount: true }}>
      <DiscoverScreenInner />
    </InstantSearch>
  );
}

function DiscoverScreenInner() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('english');
  const [_isSearchFocused, setIsSearchFocused] = useState(false);
  const [viewState, setViewState] = useState<ViewState>('default');
  const [_, startTransition] = useTransition();

  const {
    query: searchQuery,
    activeCategory: selectedCategory,
    hasActiveSearch,
    handleCategoryClick: controllerHandleCategoryClick,
    refineQuery,
    clearSearch: controllerClearSearch,
  } = useDiscoverController();

  const addFeedModalRef = useRef<AddFeedBottomSheetRef>(null);
  const folderPickerModalRef = useRef<FolderPickerBottomSheetRef>(null);
  const [pendingAddFeedUrl, setPendingAddFeedUrl] = useState<string | null>(null);

  const searchBarRef = useRef<RNTextInput>(null);
  const categoryScrollRef = useRef<ScrollView>(null);
  const createFolderModalRef = useRef<CreateFolderModalRef>(null);
  const languagePickerRef = useRef<BottomSheetModal>(null);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const { searches: recentSearches, addSearch, clearHistory } = useSearchHistory();
  const createFeed = useCreateFeed();

  // Focus search bar on bottom tab double tap
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('bottom-tab-double-tap:discover', () => {
      searchBarRef.current?.focus();
    });
    return () => subscription.remove();
  }, []);

  // Compute bottom padding to account for tab bar
  // Tab bar height = BOTTOM_TABBAR_BASE_HEIGHT + 0.8 * safeAreaBottom (from BottomTabbar component)
  // Add extra spacing (24px) for better visual separation
  const contentPaddingBottom = BOTTOM_TABBAR_BASE_HEIGHT + 24;
  const trendingScrollRef = useRef<ScrollView>(null);

  // Language filter for both trending + live search. Default is always English;
  // 'all' means no language filter at all.
  const languageCode =
    selectedLanguage === 'all'
      ? null
      : selectedLanguage === 'chinese'
        ? 'zh'
        : selectedLanguage === 'japanese'
          ? 'ja'
          : 'en';

  // Fetch trending feeds using Meilisearch directly — infinite paginated, capped at MAX_TRENDING_ITEMS
  // Trending shows popular feeds from News, Tech, and Business categories only
  const {
    data: trendingInfiniteData,
    isLoading: isTrendingLoading,
    isFetchingNextPage: isTrendingFetchingNextPage,
    fetchNextPage: fetchTrendingNextPage,
    hasNextPage: trendingHasNextPage,
    error: trendingError,
  } = useInfiniteQuery({
    queryKey: ['trending', languageCode],
    queryFn: async ({ pageParam = 0 }) => {
      const categoryFilter = POPULAR_CATEGORIES.map(
        (cat) => `top_level_category = "${cat}"`
      ).join(' OR ');
      const filter = languageCode
        ? [`language = ${languageCode} AND (${categoryFilter})`]
        : [categoryFilter];

      const res = await meilisearchClient.index(FEEDS_INDEX_NAME).search('', {
        limit: TRENDING_PAGE_SIZE,
        offset: pageParam,
        filter,
        sort: ['frontend_rank_override:asc', 'popularity_score:desc'],
      });
      return { hits: res.hits as unknown as FeedSummary[], offset: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, p) => sum + p.hits.length, 0);
      if (lastPage.hits.length < TRENDING_PAGE_SIZE || totalFetched >= MAX_TRENDING_ITEMS) {
        return undefined;
      }
      return lastPage.offset + TRENDING_PAGE_SIZE;
    },
    enabled: viewState === 'default',
  });

  // Flatten pages into a single list, capped at MAX_TRENDING_ITEMS
  const trendingData = useMemo(() => {
    const all = trendingInfiniteData?.pages.flatMap((p) => p.hits) || [];
    return all.slice(0, MAX_TRENDING_ITEMS);
  }, [trendingInfiniteData]);

  const showTrendingSkeleton = isTrendingLoading && (!trendingData || trendingData.length === 0);

  const handleTrendingScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!trendingHasNextPage || isTrendingFetchingNextPage) return;
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const paddingToBottom = 200;
      const isNearBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
      if (isNearBottom) {
        fetchTrendingNextPage();
      }
    },
    [trendingHasNextPage, isTrendingFetchingNextPage, fetchTrendingNextPage]
  );

  const { items: hits, isLastPage, showMore } = useInfiniteHits();
  const { status } = useInstantSearch();

  // InstantSearch handles both search and category filtering
  const displayFeeds = (hits as any) || [];
  const isSearchLoading = status === 'loading' || status === 'stalled';
  const showSearchSkeleton = isSearchLoading && displayFeeds.length === 0;

  const handleCategoryPress = useCallback(
    (category: string) => {
      controllerHandleCategoryClick(category);
      categoryScrollRef.current?.scrollTo({ x: 0, animated: true });
      startTransition(() => {
        setViewState('category');
      });
    },
    [controllerHandleCategoryClick]
  );

  const orderedCategories = selectedCategory
    ? [selectedCategory, ...CATEGORIES.filter((c) => c !== selectedCategory)]
    : CATEGORIES;

  const half = Math.ceil(orderedCategories.length / 2);
  const categoriesRow1 = orderedCategories.slice(0, half);
  const categoriesRow2 = orderedCategories.slice(half);

  const handleSearchSubmit = useCallback(() => {
    if (!searchQuery.trim()) return;
    addSearch(searchQuery);
    setIsSearchFocused(false);
    searchBarRef.current?.blur();
    Keyboard.dismiss();
    startTransition(() => {
      setViewState('search');
    });
  }, [searchQuery, addSearch]);

  const handleAddFeedConfirm = useCallback((url: string) => {
    setPendingAddFeedUrl(url);
    folderPickerModalRef.current?.present();
  }, []);

  const handleFolderSelect = useCallback(
    async (folderId: string | null) => {
      if (!pendingAddFeedUrl) return;
      const urlToSubscribe = pendingAddFeedUrl;
      setPendingAddFeedUrl(null);

      try {
        await toast.promise(
          createFeed.mutateAsync({
            url: urlToSubscribe,
            folder_id: folderId || undefined,
          }),
          {
            loading: 'Subscribing to feed...',
            success: 'Subscribed successfully!',
            error: 'Failed to subscribe to feed',
          }
        );
      } catch (e) {
        console.log('Error subscribing to feed:', e);
      }
    },
    [pendingAddFeedUrl, createFeed]
  );

  const handleSearchChange = useCallback(
    (text: string) => {
      startTransition(() => {
        refineQuery(text);
      });
    },
    [refineQuery]
  );

  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
    setViewState('focused');
  }, []);

  const handleSearchCancel = useCallback(() => {
    setIsSearchFocused(false);
    searchBarRef.current?.blur();
    Keyboard.dismiss();
    controllerClearSearch();
    startTransition(() => {
      setViewState(selectedCategory ? 'category' : 'default');
    });
  }, [controllerClearSearch, selectedCategory]);

  const handleClearSearch = useCallback(() => {
    setIsSearchFocused(true);
    searchBarRef.current?.focus();
    startTransition(() => {
      refineQuery('');
      setViewState('focused');
    });
  }, [refineQuery]);

  const handleLanguageChange = useCallback((language: Language) => {
    setSelectedLanguage(language);
  }, []);

  const handleRecentSearchPress = useCallback(
    (query: string) => {
      addSearch(query);
      setIsSearchFocused(false);
      searchBarRef.current?.blur();
      Keyboard.dismiss();
      startTransition(() => {
        refineQuery(query);
        setViewState('search');
      });
    },
    [addSearch, refineQuery]
  );

  const showCancelButton = viewState !== 'default';

  const handleOutsidePress = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleClearCategory = useCallback(() => {
    controllerClearSearch();
    startTransition(() => {
      setViewState(searchQuery ? 'search' : 'default');
    });
  }, [controllerClearSearch, searchQuery]);

  const insets = useSafeAreaInsets();

  // Whether user is actively typing (show instant results instead of recent searches)
  const hasTypedQuery = searchQuery.trim().length > 0;

  // Language filter for Configure — applied as raw Meilisearch filter
  const languageFilter =
    selectedLanguage && selectedLanguage !== 'all'
      ? `language = ${languageCode || 'en'}`
      : undefined;

  return (
    <View
      className="bg-background flex-1"
      style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
      <Configure
        hitsPerPage={20}
        attributesToHighlight={['title', 'description']}
        filters={languageFilter}
      />
      <TouchableWithoutFeedback onPress={handleOutsidePress}>
        <View className="flex-1">
          {/* Fixed Header & SearchBar Wrapper */}
          <View>
            {/* Discover Header - slides/collapses beautifully when search is active */}
            <MotiView
              animate={{
                opacity: viewState === 'default' ? 1 : 0,
                height: viewState === 'default' ? 62 : 0,
                scale: viewState === 'default' ? 1 : 0.95,
              }}
              transition={{
                type: 'timing',
                duration: 250,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              }}
              style={{ overflow: 'hidden' }}>
              <View className="flex-row items-center justify-between px-6 pb-2 pt-3">
                <Text
                  size="3xl"
                  fontFamily="geist-bold"
                  className="tracking-heading text-primary-foreground">
                  Discover
                </Text>
                <Button
                  variant="icon"
                  size="small"
                  className="bg-grey6"
                  fullWidth={false}
                  onPress={() => addFeedModalRef.current?.present()}>
                  <Plus width={20} height={20} color={colors.grey} />
                </Button>
              </View>
            </MotiView>

            {/* Sticky Search Bar - always mounted for seamless, non-janky morph animations */}
            <View className="px-6 pb-4 pt-2">
              <Pressable onPress={(e) => e.stopPropagation()}>
                <SearchBar
                  ref={searchBarRef}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  onFocus={handleSearchFocus}
                  onLanguageChange={handleLanguageChange}
                  selectedLanguage={selectedLanguage}
                  languagePickerRef={languagePickerRef}
                  onClear={handleClearSearch}
                  onCancel={handleSearchCancel}
                  onSubmit={handleSearchSubmit}
                  showCancelButton={showCancelButton}
                  autoFocus={false}
                />
              </Pressable>
            </View>
          </View>

          {/* Content Area */}
          <View className="flex-1">
            {viewState === 'focused' && !hasTypedQuery ? (
              /* Recent Searches - only when focused with no query */
              <RecentSearches
                recentSearches={recentSearches}
                onRecentSearchPress={handleRecentSearchPress}
                onClearHistory={clearHistory}
                contentPaddingBottom={contentPaddingBottom}
                colors={colors}
              />
            ) : viewState === 'default' ? (
              /* Default Feed Content */
              <ScrollView
                showsVerticalScrollIndicator={false}
                className="flex-1"
                ref={trendingScrollRef}
                keyboardShouldPersistTaps="always"
                onScroll={handleTrendingScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{
                  paddingBottom: contentPaddingBottom,
                }}>
                {/* Categories, scrolls with content */}
                <View className="mb-2">
                  <CategoriesList
                    selectedCategory={selectedCategory}
                    categoriesRow1={categoriesRow1}
                    categoriesRow2={categoriesRow2}
                    onCategoryPress={handleCategoryPress}
                    onClearCategory={handleClearCategory}
                    categoryScrollRef={categoryScrollRef}
                  />
                </View>

                {/* Trending section */}
                <TrendingSection
                  showTrendingSkeleton={showTrendingSkeleton}
                  trendingError={trendingError}
                  trendingData={trendingData}
                  hasNextPage={trendingHasNextPage}
                  isFetchingNextPage={isTrendingFetchingNextPage}
                />
              </ScrollView>
            ) : (
              /* Search/Category Results */
              <SearchResults
                showSearchSkeleton={showSearchSkeleton}
                hits={displayFeeds}
                contentPaddingBottom={contentPaddingBottom}
                selectedCategory={selectedCategory}
                categoriesRow1={categoriesRow1}
                categoriesRow2={categoriesRow2}
                onCategoryPress={handleCategoryPress}
                onClearCategory={handleClearCategory}
                categoryScrollRef={categoryScrollRef}
                searchQuery={searchQuery}
                showCategoriesList={selectedCategory !== null}
                hasMore={!isLastPage}
                onLoadMore={showMore}
              />
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* Modals & Bottom Sheets */}
      <CreateFolderModal ref={createFolderModalRef} />
      <AddFeedBottomSheet ref={addFeedModalRef} onConfirm={handleAddFeedConfirm} />
      <FolderPickerBottomSheet ref={folderPickerModalRef} onFolderSelect={handleFolderSelect} />

      {/* Language Picker Bottom Sheet */}
      <LanguagePicker
        ref={languagePickerRef}
        initialLanguage={selectedLanguage}
        onLanguageChange={(lang) => handleLanguageChange(lang as Language)}
      />
    </View>
  );
}
