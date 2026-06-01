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
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Configure,
  InstantSearch,
  useInfiniteHits,
  useInstantSearch,
  useMenu,
  useSearchBox,
} from 'react-instantsearch';
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
  const [activeQuery, setActiveQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('english');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

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

  const handleCategoryPress = useCallback((category: string) => {
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
  }, []);

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
    refineQuery(searchQuery);

    setViewState('search');
    if (selectedCategory) {
      refineCategory(selectedCategory);
    }
    setSelectedCategory(null);
    setIsSearchFocused(false);
    searchBarRef.current?.blur();
    Keyboard.dismiss();
  }, [searchQuery, addSearch, refineQuery, selectedCategory, refineCategory]);

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
      // Live instant search: refine query as user types
      if (text.trim()) {
        refineQuery(text);
      } else {
        refineQuery('');
      }
    },
    [refineQuery]
  );

  const handleSearchFocus = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearchFocused(true);
    setViewState('focused');
    if (selectedCategory) {
      refineCategory(selectedCategory);
    }
    setSelectedCategory(null);
  }, [selectedCategory, refineCategory]);

  const handleSearchCancel = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearchFocused(false);
    setSearchQuery('');
    setActiveQuery('');
    refineQuery('');
    setViewState('default');
    if (selectedCategory) {
      refineCategory(selectedCategory);
    }
    setSelectedCategory(null);
    searchBarRef.current?.blur();
    Keyboard.dismiss();
  }, [refineQuery, selectedCategory, refineCategory]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setActiveQuery('');
    refineQuery('');
    setIsSearchFocused(true);
    setViewState('focused');
    searchBarRef.current?.focus();
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
      refineQuery(query);
      setViewState('search');
      if (selectedCategory) {
        refineCategory(selectedCategory);
      }
      setSelectedCategory(null);
      setIsSearchFocused(false);
      searchBarRef.current?.blur();
      Keyboard.dismiss();
    },
    [addSearch, refineQuery, selectedCategory, refineCategory]
  );

  const showCancelButton = viewState !== 'default';

  const handleOutsidePress = useCallback(() => {
    // Only cancel search when in focused mode
    if (viewState === 'focused') {
      handleSearchCancel();
    }
  }, [viewState, handleSearchCancel]);

  const handleClearCategory = useCallback(() => {
    setViewState('default');
    if (selectedCategory) {
      refineCategory(selectedCategory);
    }
    setSelectedCategory(null);
  }, [selectedCategory, refineCategory]);

  const insets = useSafeAreaInsets();

  // Whether user is actively typing (show instant results instead of recent searches)
  const hasTypedQuery = searchQuery.trim().length > 0;

  return (
    <View
      className="bg-background flex-1"
      style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
      <TouchableWithoutFeedback onPress={handleOutsidePress}>
        <View className="flex-1">
          {/* In non-default states (focused/search/category), search bar is at top */}
          {viewState !== 'default' && (
            <View className="px-6 pb-6 pt-3">
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
                  autoFocus={viewState === 'focused'}
                />
              </Pressable>
            </View>
          )}

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
              /* Default: header scrolls away, search bar pins via stickyHeaderIndices */
              <ScrollView
                showsVerticalScrollIndicator={false}
                className="flex-1"
                keyboardShouldPersistTaps="always"
                stickyHeaderIndices={[1]}
                contentContainerStyle={{
                  paddingBottom: contentPaddingBottom,
                }}>
                {/* Child 0 — Discover header, scrolls away */}
                <View className="flex-row items-center justify-between px-6 pb-4 pt-3">
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

                {/* Child 1 — search bar, becomes sticky once header is gone */}
                <View className="bg-background px-6 pb-4">
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

                {/* Child 2 — categories, scrolls with content */}
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

                {/* Child 3 — trending */}
                <TrendingSection
                  showTrendingSkeleton={showTrendingSkeleton}
                  trendingError={trendingError}
                  trendingData={trendingData}
                />
              </ScrollView>
            ) : (
              /* Search/Category Results (also shown for instant search while focused) */
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
