import { CategoryChrome } from '@components/screens/discover/routes/category/chrome';
import { AddFeedFlow, type AddFeedFlowRef } from '@components/screens/discover/ui/add-feed-flow';
import type { DiscoverSearchHandle } from '@components/screens/discover/ui/discover-chrome';
import { LanguagePicker } from '@components/screens/discover/ui/language-picker.dropdown';
import { SearchOptionsSheet } from '@components/screens/discover/ui/search-options.sheet';
import { SearchResults } from '@components/screens/discover/ui/search-results.list';
import type { SheetRef } from '@components/ui/bottom-sheet';
import { useContentTypeFilters } from '@hooks/useContentTypeFilters';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { USES_NATIVE_HEADER } from '@lib/constants/platform';
import { createSearchClient, FEEDS_INDEX_NAME } from '@lib/meilisearch-client';
import { createHybridSearchParams, MOBILE_CATEGORY_NAMES } from '@readspace/shared';
import {
  type DiscoverLanguage,
  discoverLanguageToCode,
  getDiscoverSearchMode,
  useDiscoverPreferences,
} from '@stores/discover-preferences';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Configure,
  InstantSearch,
  useInfiniteHits,
  useInstantSearch,
  useMenu,
  useSearchBox,
} from 'react-instantsearch';
import { Keyboard, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Breathing room at the end of the list; this screen has no tab bar under it. */
const CONTENT_PADDING_BOTTOM = 32;

interface CategoryScreenProps {
  category: string;
}

/**
 * One category, as its own pushed screen rather than a filtered state of Discover.
 *
 * Discover's own controller is welded to the landing screen's InstantSearch instance (chips,
 * suggestions, browse/results mode), so this screen runs its own instance instead. Its search
 * is permanently scoped to the category through `Configure`, which means the query box here
 * searches *within* the category and can never widen back out to everything.
 */
export function CategoryScreen({ category }: CategoryScreenProps) {
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
      <CategoryScreenInner category={category} />
    </InstantSearch>
  );
}

function CategoryScreenInner({ category }: CategoryScreenProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const searchRef = useRef<DiscoverSearchHandle>(null);
  const optionsSheetRef = useRef<SheetRef>(null);
  const languagePickerRef = useRef<SheetRef>(null);
  const addFeedRef = useRef<AddFeedFlowRef>(null);

  const { language, setLanguage, searchMode, setSearchMode } = useDiscoverPreferences();
  const languageCode = discoverLanguageToCode(language);
  const languageFilter = `language = ${languageCode || 'en'}`;

  const contentTypes = useContentTypeFilters();
  const { refresh } = useInstantSearch();

  const [inputValue, setInputValue] = useState('');

  const title = MOBILE_CATEGORY_NAMES[category as keyof typeof MOBILE_CATEGORY_NAMES] ?? category;

  const handleChangeText = useCallback((text: string) => setInputValue(text), []);

  const handleCancel = useCallback(() => {
    setInputValue('');
    Keyboard.dismiss();
  }, []);

  /**
   * Switching search mode has to re-run the current search by hand: the hybrid params are injected
   * inside the search client, so nothing in InstantSearch's own state changes when the toggle
   * flips and no request would be scheduled otherwise.
   */
  const previousSearchModeRef = useRef(searchMode);
  useEffect(() => {
    if (previousSearchModeRef.current === searchMode) return;
    previousSearchModeRef.current = searchMode;
    refresh();
  }, [searchMode, refresh]);

  /** The sheet slides up over the keyboard, so the keyboard has to go first. */
  const handleOpenOptions = useCallback(() => {
    Keyboard.dismiss();
    optionsSheetRef.current?.present();
  }, []);

  return (
    <View
      className="bg-background flex-1"
      style={{
        paddingTop: USES_NATIVE_HEADER ? 0 : insets.top,
        backgroundColor: colors.background,
      }}>
      <Configure
        hitsPerPage={20}
        attributesToHighlight={['title', 'description']}
        filters={languageFilter}
      />
      <CategoryChrome
        ref={searchRef}
        title={title}
        inputValue={inputValue}
        onChangeText={handleChangeText}
        onCancel={handleCancel}
        onSubmit={Keyboard.dismiss}
        onOpenOptions={handleOpenOptions}
        onOpenLanguage={() => languagePickerRef.current?.present()}
        onOpenAddFeed={() => addFeedRef.current?.present()}
      />
      <CategoryResults
        category={category}
        inputValue={inputValue}
        selectedContentTypes={contentTypes.selected}
      />

      <SearchOptionsSheet
        ref={optionsSheetRef}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        options={contentTypes.options}
        onToggle={contentTypes.refine}
        onReset={contentTypes.clear}
        canReset={contentTypes.selected.length > 0}
      />
      <LanguagePicker
        ref={languagePickerRef}
        title="Search language"
        initialLanguage={language}
        onLanguageChange={(next) => setLanguage(next as DiscoverLanguage)}
      />
      <AddFeedFlow ref={addFeedRef} />
    </View>
  );
}

/**
 * Applies the category the same way the Discover landing screen does — as a `useMenu`
 * refinement, not a hand-written `filters` clause. The raw-filter version returned nothing:
 * `Configure.filters` replaces whatever the client already set rather than combining with it,
 * so the language clause and the category clause kept overwriting each other.
 */
function CategoryResults({
  category,
  inputValue,
  selectedContentTypes,
}: {
  category: string;
  inputValue: string;
  selectedContentTypes: string[];
}) {
  const { refine: refineCategory } = useMenu({ attribute: 'top_level_category', limit: 100 });
  const { refine: refineQuery } = useSearchBox();
  const { items: hits, isLastPage, showMore } = useInfiniteHits();
  const { status, results } = useInstantSearch();

  const [isRefined, setIsRefined] = useState(false);

  useEffect(() => {
    refineCategory(category);
    setIsRefined(true);
    // `refineCategory`'s identity changes with every search state update; re-running on it
    // would re-refine (and so toggle the menu back off) on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    refineQuery(inputValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  const isPending = status === 'loading' || status === 'stalled';

  return (
    <SearchResults
      hits={hits as any}
      // Until the refinement has been applied the index still holds the previous screen's
      // results, so skeletons stand in rather than showing another category's feeds.
      showSkeletons={!isRefined || (isPending && hits.length === 0)}
      isLoading={isPending}
      isError={status === 'error'}
      hasMore={!isLastPage}
      onLoadMore={showMore}
      contentPaddingBottom={CONTENT_PADDING_BOTTOM}
      resetKey={`${category}|${inputValue}|${selectedContentTypes.join(',')}`}
    />
  );
}
