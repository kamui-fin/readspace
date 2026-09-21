import { ALL_CONTENT_TYPES } from '@readspace/shared';
import { useMemo } from 'react';
import { useClearRefinements, useCurrentRefinements, useRefinementList } from 'react-instantsearch';

export const CONTENT_TYPE_ATTRIBUTE = 'content_type';

export interface ContentTypeOption {
  value: string;
  count: number;
  isRefined: boolean;
}

export interface ContentTypeFilters {
  /** Every content type, in a fixed order — see below. */
  options: ContentTypeOption[];
  selected: string[];
  refine: (contentType: string) => void;
  clear: () => void;
}

/**
 * The content-type facet, shared by every Discover surface that shows the search options sheet
 * (the landing screen and the category screens each run their own InstantSearch instance, so each
 * calls this inside its own provider).
 *
 * Every content type is always rendered, in a fixed order, whether or not the current result set
 * happens to contain them — a filter rail whose chips appear and disappear between searches is
 * impossible to aim at. Counts come from the response facets; selection comes from
 * `useCurrentRefinements`, which reflects the helper's UI state **synchronously** on refine, so a
 * tap highlights on the same frame. The widget's own `items` are rebuilt from the *response*
 * instead and stay empty until the request lands.
 */
export function useContentTypeFilters(): ContentTypeFilters {
  const { items, refine } = useRefinementList({
    attribute: CONTENT_TYPE_ATTRIBUTE,
    limit: 50,
  });
  const { items: currentRefinements } = useCurrentRefinements();
  const { refine: clear } = useClearRefinements({
    includedAttributes: [CONTENT_TYPE_ATTRIBUTE],
  });

  const selected = useMemo(
    () =>
      (
        currentRefinements.find((group) => group.attribute === CONTENT_TYPE_ATTRIBUTE)
          ?.refinements ?? []
      ).map((refinement) => String(refinement.value)),
    [currentRefinements]
  );

  const options = useMemo(() => {
    const byValue = new Map(items.map((item) => [item.value, item]));
    return ALL_CONTENT_TYPES.map((type) => ({
      value: type as string,
      count: byValue.get(type)?.count ?? 0,
      isRefined: selected.includes(type),
    }));
  }, [items, selected]);

  return { options, selected, refine, clear };
}
