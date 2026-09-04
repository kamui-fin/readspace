import { useCallback, useState } from 'react';
import { useClearRefinements, useCurrentRefinements, useMenu, useSearchBox } from 'react-instantsearch';

export function useDiscoverController() {
  const { query, refine: refineQuery } = useSearchBox();
  const [isPopularSelected, setIsPopularSelected] = useState(false);

  // Use InstantSearch's menu widget for category filtering — exactly like web
  const { refine: refineCategory } = useMenu({
    attribute: 'top_level_category',
    limit: 100,
  });

  const { refine: clearRefinementsBase } = useClearRefinements();
  const { items: currentRefinements } = useCurrentRefinements();

  // Get active category from current refinements
  const activeCategoryRefinement = currentRefinements.find(
    (item) => item.attribute === 'top_level_category'
  );
  const activeCategory = activeCategoryRefinement?.refinements[0]?.value || null;

  const handleCategoryClick = useCallback(
    (categoryName: string) => {
      if (categoryName === 'popular') {
        // Toggle popular mode — when enabled, filter gets stripped so all feeds show sorted by popularity
        refineCategory('popular');
        setIsPopularSelected((prev) => !prev);
      } else {
        // Switching to a regular category — disable popular if it was on
        if (isPopularSelected) {
          setIsPopularSelected(false);
          refineCategory('popular'); // Remove popular filter
        }
        refineCategory(categoryName);
      }
    },
    [isPopularSelected, refineCategory]
  );

  const clearSearch = useCallback(() => {
    setIsPopularSelected(false);
    refineQuery('');
    clearRefinementsBase();
  }, [refineQuery, clearRefinementsBase]);

  const effectiveCategory = isPopularSelected ? 'Popular' : activeCategory;
  const hasActiveSearch = Boolean(query || activeCategory || isPopularSelected);

  return {
    query,
    activeCategory: effectiveCategory,
    isPopularSelected,
    hasActiveSearch,
    handleCategoryClick,
    clearSearch,
    refineQuery,
    clearRefinementsBase,
  };
}
