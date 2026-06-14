import { AddFeedBottomSheet, type AddFeedBottomSheetRef } from '@components/bottom-sheets/add-feed';
import {
  CreateFolderModal,
  type CreateFolderModalRef,
} from '@components/bottom-sheets/create-folder';
import {
  FolderPickerBottomSheet,
  type FolderPickerBottomSheetRef,
} from '@components/bottom-sheets/folder-picker';
import PlusIcon from '@components/icons/local/plus';
import { LanguagePicker } from '@components/screens/discover/ui/language-picker.dropdown';
import { RecentSearches } from '@components/screens/discover/ui/recent-searches';
import { type Language, SearchBar } from '@components/screens/discover/ui/search-bar.input';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { createSearchClient, FEEDS_INDEX_NAME, meilisearchClient } from '@lib/meilisearch-client';
import type { FeedSummary } from '@readspace/shared';
import { MOBILE_CATEGORY_NAMES, useCreateFeed } from '@readspace/shared';
import { useSearchHistory } from '@stores/search-history';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  Configure,
  InstantSearch,
  useInfiniteHits,
  useInstantSearch,
  useMenu,
  useSearchBox,
} from 'react-instantsearch';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import type { TextInput as RNTextInput } from 'react-native';
import {
  DeviceEventEmitter,
  Keyboard,
  Pressable,
  ScrollView,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
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
      <Configure hitsPerPage={20} attributesToHighlight={['title', 'description']} />
      <DiscoverScreenInner />
    </InstantSearch>
  );
}

function DiscoverScreenInner() {
  const [viewState, setViewState] = useState<ViewState>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [_activeQuery, setActiveQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('english');
  const [_isSearchFocused, setIsSearchFocused] = useState(false);
  const [isPendingFilter, setIsPendingFilter] = useState(false);
  const [_, startTransition] = useTransition();

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
  const showSearchSkeleton = (isSearchLoading && hits.length === 0) || isPendingFilter;

  useEffect(() => {
    if (!isSearchLoading) {
      setIsPendingFilter(false);
    }
  }, [isSearchLoading]);

  const handleCategoryPress = useCallback(
    (category: string) => {
      // 1. Immediately highlight chip, clear search query inputs, close search focus, and scroll to beginning
      setSelectedCategory(category);
      setSearchQuery('');
      setActiveQuery('');
      setIsSearchFocused(false);
      categoryScrollRef.current?.scrollTo({ x: 0, animated: true });

      // 2. Defer the heavy view state swap, skeleton loading, and Meilisearch query to allow
      // the chip color highlight and position change to render instantly.
      startTransition(() => {
        setIsPendingFilter(true);
        setViewState('category');
        refineCategory(category);
        refineQuery('');
      });
    },
    [refineCategory, refineQuery]
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
    setActiveQuery(searchQuery);
    setIsSearchFocused(false);
    searchBarRef.current?.blur();
    Keyboard.dismiss();

    // Defer query refinement and view state swap
    startTransition(() => {
      setIsPendingFilter(true);
      setViewState('search');
      refineQuery(searchQuery);
    });
  }, [searchQuery, addSearch, refineQuery]);

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
      setSearchQuery(text);
      // Live instant search: refine query as user types inside transition to keep typing lag-free
      startTransition(() => {
        if (text.trim()) {
          refineQuery(text);
        } else {
          refineQuery('');
        }
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
    setSearchQuery('');
    setActiveQuery('');
    searchBarRef.current?.blur();
    Keyboard.dismiss();

    const hasCategory = selectedCategory !== null;

    // Defer queries and view state changes until after urgent keyboard dismissals
    startTransition(() => {
      setIsPendingFilter(true);
      setViewState(hasCategory ? 'category' : 'default');
      refineQuery('');
    });
  }, [refineQuery, selectedCategory]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setActiveQuery('');
    setIsSearchFocused(true);
    searchBarRef.current?.focus();

    startTransition(() => {
      refineQuery('');
      setViewState('focused');
    });
  }, [refineQuery]);

  const handleLanguageChange = useCallback(
    (language: Language) => {
      setSelectedLanguage(language);
      refineLanguage(language === 'english' ? 'en' : language === 'chinese' ? 'zh' : 'ja');
    },
    [refineLanguage]
  );

  const handleRecentSearchPress = useCallback(
    (query: string) => {
      addSearch(query);
      setSearchQuery(query);
      setActiveQuery(query);
      setIsSearchFocused(false);
      searchBarRef.current?.blur();
      Keyboard.dismiss();

      // Defer query refinement and view state swap
      startTransition(() => {
        setIsPendingFilter(true);
        setViewState('search');
        refineQuery(query);
      });
    },
    [addSearch, refineQuery]
  );

  const showCancelButton = viewState !== 'default';

  const handleOutsidePress = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleClearCategory = useCallback(() => {
    const prevCategory = selectedCategory;
    setSelectedCategory(null);

    // Defer the view state swap and query refinement to make the chip state change instant
    startTransition(() => {
      setIsPendingFilter(true);
      const hasSearch = searchQuery.trim().length > 0;
      setViewState(hasSearch ? 'search' : 'default');
      if (prevCategory) {
        refineCategory(prevCategory);
      }
    });
  }, [selectedCategory, refineCategory, searchQuery]);

  const insets = useSafeAreaInsets();

  // Whether user is actively typing (show instant results instead of recent searches)
  const hasTypedQuery = searchQuery.trim().length > 0;

  return (
    <View
      className="bg-background flex-1"
      style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
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
                  <PlusIcon width={34} height={34} color={colors.black} strokeWidth={2} />
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
                keyboardShouldPersistTaps="always"
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
                searchQuery={searchQuery}
                showCategoriesList={viewState === 'category' || selectedCategory !== null}
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
