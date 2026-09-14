import { useCallback } from 'react';
import {
  useClearRefinements,
  useCurrentRefinements,
  useMenu,
  useSearchBox,
} from 'react-instantsearch';

export function useDiscoverController() {
  const { query, refine: refineQuery } = useSearchBox();

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
      refineCategory(categoryName);
    },
    [refineCategory]
  );

  const clearSearch = useCallback(() => {
    refineQuery('');
    clearRefinementsBase();
  }, [refineQuery, clearRefinementsBase]);

  const hasActiveSearch = Boolean(query || activeCategory);

  return {
    query,
    activeCategory,
    hasActiveSearch,
    handleCategoryClick,
    clearSearch,
    refineQuery,
    clearRefinementsBase,
  };
}
