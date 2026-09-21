import { useContentTypeFilters } from '@hooks/useContentTypeFilters';
import { useDiscoverPreferences } from '@stores/discover-preferences';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useClearRefinements,
  useCurrentRefinements,
  useInfiniteHits,
  useInstantSearch,
  useMenu,
  useSearchBox,
} from 'react-instantsearch';

/**
 * Which screen Discover is showing.
 *
 * This is **derived**, never stored. The previous implementation kept a
 * `viewState` useState that every handler had to update alongside the
 * InstantSearch refinements — and because those updates landed in different
 * React lanes (refinements synchronously, `viewState` inside a
 * `startTransition`), each interaction committed in two visible steps:
 * results wiped → empty state flashed → screen finally switched. Deriving the
 * mode from the search state means one commit, one frame, no flashes.
 */
export type DiscoverMode = 'browse' | 'suggestions' | 'results';

const CATEGORY_ATTRIBUTE = 'top_level_category';

/**
 * The search inputs a set of hits was produced for. Used to tell "these results
 * answer the current question" from "these are the previous question's results,
 * still on screen while a new request is in flight".
 */
interface SearchSnapshot {
  query: string;
  category: string;
  /** Sorted, so order of selection doesn't matter. */
  types: string[];
  filters: string;
}

function sameValues(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameSearch(a: SearchSnapshot, b: SearchSnapshot): boolean {
  return (
    a.query === b.query &&
    a.category === b.category &&
    a.filters === b.filters &&
    sameValues(a.types, b.types)
  );
}

export function useDiscoverController(languageFilter: string) {
  const { query, refine: refineQuery } = useSearchBox();
  const { refine: refineCategory } = useMenu({ attribute: CATEGORY_ATTRIBUTE, limit: 100 });
  const {
    options: contentTypeOptions,
    selected: selectedContentTypes,
    refine: refineContentType,
    clear: clearContentTypeRefinements,
  } = useContentTypeFilters();
  const { items: currentRefinements } = useCurrentRefinements();
  const { refine: clearAllRefinements } = useClearRefinements();
  const { items: hits, isLastPage, showMore } = useInfiniteHits();
  const { status, results, refresh } = useInstantSearch();

  const { searchMode, setSearchMode } = useDiscoverPreferences();

  /**
   * Local, synchronously-updated mirror of the search text. The TextInput must
   * always be bound to this rather than to `query` — in Smart mode `query` only
   * catches up on submit, and on Android a controlled TextInput whose `value`
   * lags the native EditText buffer fights the IME (dropped characters, cursor
   * jumps).
   */
  const [inputValue, setInputValue] = useState(query);
  const [isFocused, setIsFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  /**
   * The text Smart mode has been told to search for, recorded the instant it's
   * submitted. `query` only reflects it a render later, and for that one render
   * the screen would otherwise see no search at all and animate the Discover
   * header back in before tucking it away again.
   */
  const [submittedQuery, setSubmittedQuery] = useState('');

  /**
   * Read the active refinements from `useCurrentRefinements`, which reflects the
   * helper's UI state **synchronously** on refine. The widget hooks' own `items`
   * are rebuilt from the *response* facets instead, so they stay empty until the
   * request lands — long enough for the screen to briefly decide nothing is
   * selected and fall back to the landing view. That one-frame fallback is the
   * "clear wipes the feeds and flashes the empty state" glitch.
   */
  const selectedCategory = useMemo(
    () =>
      currentRefinements.find((group) => group.attribute === CATEGORY_ATTRIBUTE)?.refinements[0]
        ?.value as string | undefined,
    [currentRefinements]
  );

  // ---------------------------------------------------------------------------
  // Staleness
  // ---------------------------------------------------------------------------

  /**
   * True while the hits on screen belong to a previous query/filter combination.
   *
   * Derived by comparing the current refinements against the ones the rendered
   * results were actually produced from, rather than by watching `status`:
   * `status` only flips to `loading` once InstantSearch schedules the request,
   * which is a render or two after the user's tap. Skeletons keyed off `status`
   * alone therefore appeared *after* the chip had already moved — the "selects
   * the chip AND ONLY THEN shows the skeleton" lag.
   */
  // In Smart mode a submit records `submittedQuery` synchronously while `query`
  // catches up a render or two later, so it stands in for `query` here.
  const currentSearch: SearchSnapshot = {
    query: searchMode === 'smart' ? submittedQuery || query : query,
    category: selectedCategory ?? '',
    types: [...selectedContentTypes].sort(),
    filters: languageFilter,
  };

  /**
   * What the hits on screen were answering, captured when the `results` object
   * last changed. `results` is swapped only when a response actually lands, so
   * the snapshot stays on the old question for the whole request.
   *
   * Do NOT read this from `results._state`: InstantSearch's `getResults()`
   * overwrites it with the *current* helper state on every render (including the
   * stalled render ~200ms after a request starts), so it flips to the new query
   * while the old hits are still displayed.
   */
  const renderedRef = useRef<{ results: unknown; snapshot: SearchSnapshot } | null>(null);
  if (results && renderedRef.current?.results !== results) {
    renderedRef.current = { results, snapshot: currentSearch };
  }
  const renderedSearch = renderedRef.current?.snapshot;
  const isStale = renderedSearch ? !sameSearch(renderedSearch, currentSearch) : false;

  /**
   * Keyword text typed but not yet answered, so the results view can show
   * progress from the first keystroke instead of briefly insisting there are no
   * matches. Smart mode never fires per keystroke, so unsubmitted text there is
   * not a pending request and must not raise skeletons — the previous results
   * stay put until the user actually submits.
   */
  const hasUnansweredInput = searchMode !== 'smart' && inputValue !== query;

  const isPending = isStale || hasUnansweredInput || status === 'loading' || status === 'stalled';

  useEffect(() => {
    if (!isPending) setIsTyping(false);
  }, [isPending]);

  // ---------------------------------------------------------------------------
  // Derived view mode
  // ---------------------------------------------------------------------------

  /**
   * The query the UI should present as "what we're searching for".
   *
   * In Keyword mode the typed text leads and `query` catches up a render later,
   * so anything keyed off `query` renders one frame of the pre-search view
   * first — that frame is what flashed the category rail on every search. Using
   * the input directly removes the lag. Smart mode searches only on submit, so
   * there the input must not lead it; the just-submitted text stands in for
   * `query` until it catches up.
   */
  const presentedQuery = searchMode === 'smart' ? submittedQuery || query : inputValue;
  const hasSearchText = presentedQuery.trim().length > 0;
  const hasActiveSearch = hasSearchText || Boolean(selectedCategory);
  /**
   * Focusing the field with nothing searched always surfaces suggestions, even
   * when a category is active — tapping the search box is a request to start a
   * new search, not to keep staring at the current results.
   */
  const mode: DiscoverMode =
    isFocused && !hasSearchText ? 'suggestions' : hasActiveSearch ? 'results' : 'browse';

  /**
   * Keep previously loaded results visible while the user types in Keywords
   * mode (matching web) — swapping a full list for skeletons on every keystroke
   * reads as flicker, not as progress.
   */
  // A next-page request changes status but still answers the same search. Keep its
  // existing rows mounted so shrinking to skeletons cannot reset the scroll offset.
  const showSkeletons =
    (isStale || hasUnansweredInput || (isPending && hits.length === 0)) &&
    !(isTyping && hits.length > 0);

  // ---------------------------------------------------------------------------
  // Actions — each one is a single synchronous batch
  // ---------------------------------------------------------------------------

  const isSmart = searchMode === 'smart';

  const changeQuery = useCallback(
    (text: string) => {
      setInputValue(text);
      // Keyword search is cheap enough to run per keystroke. Smart embeds the
      // text on every request, so it runs only when the user submits.
      if (!isSmart) {
        setIsTyping(true);
        refineQuery(text);
      }
    },
    [isSmart, refineQuery]
  );

  const submitSearch = useCallback(
    (value?: string) => {
      const next = (value ?? inputValue).trim();
      if (!next) return;
      setInputValue(next);
      setSubmittedQuery(next);
      setIsTyping(false);
      setIsFocused(false);
      refineQuery(next);
    },
    [inputValue, refineQuery]
  );

  /** The ✕ inside the input: empties the field and returns to suggestions. */
  const clearQuery = useCallback(() => {
    setInputValue('');
    setSubmittedQuery('');
    setIsTyping(false);
    setIsFocused(true);
    refineQuery('');
  }, [refineQuery]);

  /**
   * The back arrow: leaves search entirely. Only the query is dropped — an
   * active category survives, so backing out of the search field returns you to
   * the category you were browsing instead of dumping you on the landing screen.
   */
  const exitSearch = useCallback(() => {
    setInputValue('');
    setSubmittedQuery('');
    setIsTyping(false);
    setIsFocused(false);
    refineQuery('');
    // Content-type chips only exist alongside results; if dropping the query
    // lands us back on the landing screen, they'd otherwise linger invisibly
    // and silently narrow the next search.
    if (!selectedCategory) clearAllRefinements();
  }, [refineQuery, selectedCategory, clearAllRefinements]);

  const focusSearch = useCallback(() => {
    setIsFocused(true);
  }, []);

  /** Leave the suggestions panel without discarding anything (keyboard dismissed). */
  const blurSearch = useCallback(() => {
    setIsFocused(false);
  }, []);

  const selectCategory = useCallback(
    (category: string) => {
      setIsTyping(false);
      setIsFocused(false);
      refineCategory(category);
    },
    [refineCategory]
  );

  const toggleContentType = useCallback(
    (contentType: string) => {
      setIsTyping(false);
      refineContentType(contentType);
    },
    [refineContentType]
  );

  /** Clears only the content-type filters — the sheet's Reset shows nothing else. */
  const clearContentTypes = useCallback(() => {
    setIsTyping(false);
    clearContentTypeRefinements();
  }, [clearContentTypeRefinements]);

  /** Full reset back to the landing screen, in one commit. */
  const resetSearch = useCallback(() => {
    setInputValue('');
    setSubmittedQuery('');
    setIsTyping(false);
    setIsFocused(false);
    refineQuery('');
    clearAllRefinements();
  }, [refineQuery, clearAllRefinements]);

  // Switching search mode has to re-run the current search: the hybrid params
  // are injected inside the search client, so nothing in InstantSearch's state
  // changes when the toggle flips and no request would be scheduled otherwise.
  const previousSearchModeRef = useRef(searchMode);
  useEffect(() => {
    if (previousSearchModeRef.current === searchMode) return;
    const wasSmart = previousSearchModeRef.current === 'smart';
    previousSearchModeRef.current = searchMode;

    // Leaving Smart with text that was typed but never submitted: Keyword
    // search runs as you type, so apply it now — otherwise the input and the
    // query stay out of step and the results sit on skeletons forever.
    if (wasSmart && inputValue !== query) {
      setSubmittedQuery('');
      refineQuery(inputValue);
      return;
    }
    if (query) refresh();
  }, [searchMode, query, inputValue, refineQuery, refresh]);

  return {
    // Mode & search state
    mode,
    query,
    hasSearchText,
    inputValue,
    searchMode,
    setSearchMode,
    selectedCategory,
    selectedContentTypes,
    contentTypeOptions,

    // Results
    hits,
    hasMore: !isLastPage,
    loadMore: showMore,
    isPending,
    showSkeletons,
    isError: status === 'error',

    // Actions
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
  };
}
