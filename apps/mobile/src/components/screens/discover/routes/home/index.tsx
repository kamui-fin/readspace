import { AddFeedBottomSheet, type AddFeedBottomSheetRef } from '@components/bottom-sheets/add-feed';
import {
  FolderPickerBottomSheet,
  type FolderPickerBottomSheetRef,
} from '@components/bottom-sheets/folder-picker';
import { Languages, Plus } from '@components/icons/svg';
import { CategoriesList } from '@components/screens/discover/ui/categories.list';
import { DiscoverBrowseView } from '@components/screens/discover/ui/discover-browse.view';
import { LanguagePicker } from '@components/screens/discover/ui/language-picker.dropdown';
import { SearchBar } from '@components/screens/discover/ui/search-bar.input';
import { SearchOptionsButton } from '@components/screens/discover/ui/search-options.button';
import { SearchOptionsSheet } from '@components/screens/discover/ui/search-options.sheet';
import { SearchResults } from '@components/screens/discover/ui/search-results.list';
import { SearchSuggestionsPanel } from '@components/screens/discover/ui/search-suggestions.panel';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import type { SheetRef } from '@components/ui/bottom-sheet';
import { useDiscoverController } from '@hooks/useDiscoverController';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useTrendingFeeds } from '@hooks/useTrendingFeeds';
import {
  BOTTOM_TABBAR_BASE_HEIGHT,
  MIN_SEARCH_HISTORY_LENGTH,
  SEARCH_HISTORY_COMMIT_MS,
} from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { createSearchClient, FEEDS_INDEX_NAME } from '@lib/meilisearch-client';
import { createHybridSearchParams, MOBILE_CATEGORY_NAMES, useCreateFeed } from '@readspace/shared';
import {
  type DiscoverLanguage,
  discoverLanguageToCode,
  getDiscoverSearchMode,
  useDiscoverPreferences,
} from '@stores/discover-preferences';
import { useSearchHistory } from '@stores/search-history';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Configure, InstantSearch } from 'react-instantsearch';
import {
  DeviceEventEmitter,
  Keyboard,
  Pressable,
  type TextInput as RNTextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORIES = Object.keys(MOBILE_CATEGORY_NAMES);

/** Extra breathing room under the tab bar so the last row isn't flush against it. */
const CONTENT_PADDING_BOTTOM = BOTTOM_TABBAR_BASE_HEIGHT + 24;

export function DiscoverScreen() {
  /**
   * Hybrid (Smart) params are injected inside the search client, not via
   * `<Configure>`, so the client needs to read the mode at request time. It
   * reads the persisted store synchronously on every search, which keeps the
   * client itself stable — recreating it would reset InstantSearch's state.
   */
  const { searchClient } = useMemo(
    () =>
      createSearchClient(() =>
        getDiscoverSearchMode() === 'smart' ? createHybridSearchParams() : undefined
      ),
    []
  );

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
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const searchBarRef = useRef<RNTextInput>(null);
  const addFeedModalRef = useRef<AddFeedBottomSheetRef>(null);
  const folderPickerModalRef = useRef<FolderPickerBottomSheetRef>(null);
  const languagePickerRef = useRef<SheetRef>(null);
  const optionsSheetRef = useRef<SheetRef>(null);

  const [pendingAddFeedUrl, setPendingAddFeedUrl] = useState<string | null>(null);

  const { searches: recentSearches, addSearch, clearHistory } = useSearchHistory();
  const createFeed = useCreateFeed();

  // Language scopes both search and trending, so it stays a screen-level control
  // in the header rather than a search-only setting.
  const { language: discoverLanguage, setLanguage: setDiscoverLanguage } = useDiscoverPreferences();
  const languageCode = discoverLanguageToCode(discoverLanguage);
  const languageFilter = `language = ${languageCode || 'en'}`;

  const {
    mode,
    query,
    hasSearchText,
    inputValue,
    searchMode,
    setSearchMode,
    selectedCategory,
    selectedContentTypes,
    contentTypeOptions,
    hits,
    hasMore,
    loadMore,
    isPending,
    showSkeletons,
    isError,
    focusSearch,
    blurSearch,
    changeQuery,
    submitSearch,
    clearQuery,
    exitSearch,
    selectCategory,
    toggleContentType,
    clearContentTypes,
    resetSearch,
  } = useDiscoverController(languageFilter);

  const trending = useTrendingFeeds({ languageCode, enabled: mode === 'browse' });

  // Record a search once the user rests on it (see SEARCH_HISTORY_COMMIT_MS).
  useEffect(() => {
    const trimmed = query.trim();
    if (isPending || trimmed.length < MIN_SEARCH_HISTORY_LENGTH) return;
    const timer = setTimeout(() => addSearch(trimmed), SEARCH_HISTORY_COMMIT_MS);
    return () => clearTimeout(timer);
  }, [query, isPending, addSearch]);

  // Focus the search bar when the Discover tab is double-tapped.
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('bottom-tab-double-tap:discover', () => {
      searchBarRef.current?.focus();
    });
    return () => subscription.remove();
  }, []);

  const dismissKeyboard = useCallback(() => {
    searchBarRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    addSearch(trimmed);
    submitSearch(trimmed);
    dismissKeyboard();
  }, [inputValue, addSearch, submitSearch, dismissKeyboard]);

  const handleRecentSearchPress = useCallback(
    (recent: string) => {
      addSearch(recent);
      submitSearch(recent);
      dismissKeyboard();
    },
    [addSearch, submitSearch, dismissKeyboard]
  );

  const handleClear = useCallback(() => {
    clearQuery();
    searchBarRef.current?.focus();
  }, [clearQuery]);

  /**
   * Back arrow. Drops the query first and only falls through to a full reset
   * once there's no query left, so backing out of a search you ran inside a
   * category returns you to that category instead of the landing screen.
   */
  const handleBack = useCallback(() => {
    dismissKeyboard();
    if (inputValue || query) {
      exitSearch();
    } else {
      resetSearch();
    }
  }, [inputValue, query, exitSearch, resetSearch, dismissKeyboard]);

  /**
   * The sheet slides up over the keyboard, so the keyboard has to go — but
   * dismissing it blurs the field, and an empty field would then drop the
   * screen back to browsing behind the open sheet. This flag makes that one
   * blur a no-op.
   */
  const isOpeningOptionsRef = useRef(false);

  const handleOpenOptions = useCallback(() => {
    isOpeningOptionsRef.current = true;
    dismissKeyboard();
    optionsSheetRef.current?.present();
  }, [dismissKeyboard]);

  const handleOptionsDismiss = useCallback(() => {
    isOpeningOptionsRef.current = false;
  }, []);

  const handleBlur = useCallback(() => {
    if (isOpeningOptionsRef.current) return;
    if (!inputValue.trim()) blurSearch();
  }, [inputValue, blurSearch]);

  const handleCategoryPress = useCallback(
    (category: string) => {
      dismissKeyboard();
      selectCategory(category);
    },
    [selectCategory, dismissKeyboard]
  );

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
          createFeed.mutateAsync({ url: urlToSubscribe, folder_id: folderId || undefined }),
          {
            loading: 'Subscribing to feed...',
            success: 'Subscribed successfully!',
            error: 'Failed to subscribe to feed',
          }
        );
      } catch (error) {
        console.log('Error subscribing to feed:', error);
      }
    },
    [pendingAddFeedUrl, createFeed]
  );

  const isBrowsing = mode === 'browse';
  const hasContentTypeFilters = selectedContentTypes.length > 0;

  /**
   * Category browsing keeps its rail so you can hop between categories; a text
   * search hides it — categories are a different axis there and would only add
   * chrome above the answers.
   */
  const resultsHeader = useMemo(
    () =>
      hasSearchText ? null : (
        <View className="pb-3">
          <CategoriesList
            categories={CATEGORIES}
            selectedCategory={selectedCategory}
            onCategoryPress={handleCategoryPress}
            showHeader={false}
          />
        </View>
      ),
    [hasSearchText, selectedCategory, handleCategoryPress]
  );

  const emptyAction =
    hasSearchText && searchMode === 'keywords' ? (
      <Button
        variant="secondary"
        size="small"
        fullWidth={false}
        onPress={() => setSearchMode('smart')}>
        Try Smart search
      </Button>
    ) : undefined;

  return (
    <View
      className="bg-background flex-1"
      style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
      <Configure
        hitsPerPage={20}
        attributesToHighlight={['title', 'description']}
        filters={languageFilter}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1">
          {/* Header collapses out of the way as soon as search takes over */}
          <MotiView
            animate={{
              opacity: isBrowsing ? 1 : 0,
              height: isBrowsing ? 62 : 0,
              scale: isBrowsing ? 1 : 0.95,
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
              <View className="flex-row items-center gap-2">
                <Button
                  variant="icon"
                  size="small"
                  className="bg-grey6"
                  fullWidth={false}
                  onPress={() => languagePickerRef.current?.present()}>
                  <Languages width={20} height={20} color={colors.grey} />
                </Button>
                <Button
                  variant="icon"
                  size="small"
                  className="bg-grey6"
                  fullWidth={false}
                  onPress={() => addFeedModalRef.current?.present()}>
                  <Plus width={20} height={20} color={colors.grey} />
                </Button>
              </View>
            </View>
          </MotiView>

          {/* Always mounted so focus/blur morphs stay smooth */}
          <View className="px-6 pb-4 pt-2">
            <Pressable onPress={(event) => event.stopPropagation()}>
              <SearchBar
                ref={searchBarRef}
                value={inputValue}
                onChangeText={changeQuery}
                onFocus={focusSearch}
                onBlur={handleBlur}
                onClear={handleClear}
                onCancel={handleBack}
                onSubmit={handleSubmit}
                showCancelButton={!isBrowsing}
                autoFocus={false}
                trailingAction={
                  isBrowsing ? null : <SearchOptionsButton onPress={handleOpenOptions} />
                }
              />
            </Pressable>
          </View>

          <View className="flex-1">
            {mode === 'suggestions' ? (
              <SearchSuggestionsPanel
                recentSearches={recentSearches}
                onRecentSearchPress={handleRecentSearchPress}
                onClearHistory={clearHistory}
                contentPaddingBottom={CONTENT_PADDING_BOTTOM}
              />
            ) : mode === 'browse' ? (
              <DiscoverBrowseView
                categories={CATEGORIES}
                onCategoryPress={handleCategoryPress}
                trendingFeeds={trending.feeds}
                trendingError={trending.error}
                showTrendingSkeleton={trending.showSkeleton}
                hasNextPage={Boolean(trending.hasNextPage)}
                isFetchingNextPage={trending.isFetchingNextPage}
                onLoadMoreTrending={trending.fetchNextPage}
                contentPaddingBottom={CONTENT_PADDING_BOTTOM}
              />
            ) : (
              <SearchResults
                hits={hits as any}
                showSkeletons={showSkeletons}
                isError={isError}
                hasMore={hasMore}
                onLoadMore={loadMore}
                contentPaddingBottom={CONTENT_PADDING_BOTTOM}
                listHeader={resultsHeader}
                resetKey={`${query}|${selectedCategory ?? ''}|${selectedContentTypes.join(',')}`}
                emptyAction={emptyAction}
                emptyHint={
                  searchMode === 'smart'
                    ? 'Smart search looks for meaning, so try describing what you want to read.'
                    : undefined
                }
              />
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>

      <SearchOptionsSheet
        ref={optionsSheetRef}
        onDismiss={handleOptionsDismiss}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        options={contentTypeOptions}
        onToggle={toggleContentType}
        onReset={clearContentTypes}
        canReset={hasContentTypeFilters}
      />
      <AddFeedBottomSheet ref={addFeedModalRef} onConfirm={handleAddFeedConfirm} />
      <FolderPickerBottomSheet ref={folderPickerModalRef} onFolderSelect={handleFolderSelect} />
      <LanguagePicker
        ref={languagePickerRef}
        title="Search language"
        initialLanguage={discoverLanguage}
        onLanguageChange={(language) => setDiscoverLanguage(language as DiscoverLanguage)}
      />
    </View>
  );
}
