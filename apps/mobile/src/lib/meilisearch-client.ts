import { CLOUD_CONFIG } from '@lib/constants/config';
import { resolveHostname } from '@lib/utils/network';
import { instantMeiliSearch } from '@meilisearch/instant-meilisearch';
import type { HybridSearchConfig } from '@readspace/shared';
import { getSettings } from '@stores/settings';
import { MeiliSearch } from 'meilisearch';
import { Platform } from 'react-native';

export const MEILISEARCH_URL =
  process.env.EXPO_PUBLIC_MEILISEARCH_URL || CLOUD_CONFIG.MEILISEARCH_URL;
export const MEILISEARCH_SEARCH_KEY =
  process.env.EXPO_PUBLIC_MEILISEARCH_SEARCH_KEY || CLOUD_CONFIG.MEILISEARCH_SEARCH_KEY;

if (!MEILISEARCH_SEARCH_KEY) {
  console.warn(
    'EXPO_PUBLIC_MEILISEARCH_SEARCH_KEY is not set. Search functionality may not work correctly.'
  );
}

const getMeiliSearchConfig = () => {
  const settings = getSettings();
  const host =
    settings?.instance_type === 'self-hosted' && settings?.meilisearch_url
      ? resolveHostname(settings.meilisearch_url)
      : resolveHostname(MEILISEARCH_URL);
  const apiKey =
    settings?.instance_type === 'self-hosted' && settings?.meilisearch_search_key
      ? settings.meilisearch_search_key
      : MEILISEARCH_SEARCH_KEY;
  return { host, apiKey };
};

export const FEEDS_INDEX_NAME = 'feeds';

interface SearchRequest {
  params?: SearchParams;
}

interface SearchParams {
  query?: string;
  q?: string;
  facetFilters?: Array<string | string[]>;
  filter?: Array<string | string[]>;
  hybrid?: {
    semanticRatio: number;
    embedder?: string;
  };
  showRankingScore?: boolean;
}

function hasQuery(params?: SearchParams): boolean {
  if (!params) return false;
  return (!!params.query && params.query.trim() !== '') || (!!params.q && params.q.trim() !== '');
}

function hasCategoryFilter(filters: Array<string | string[]>): boolean {
  return filters.some((filter) => {
    if (typeof filter === 'string') {
      // Support both facetFilters syntax (top_level_category:value) and explicit filter syntax (top_level_category = "value")
      return filter.includes('top_level_category');
    }
    if (Array.isArray(filter)) {
      return filter.some(
        (f: string) => typeof f === 'string' && f.includes('top_level_category')
      );
    }
    return false;
  });
}

/**
 * Strip 'popular' category filter from requests so Meilisearch queries all categories by popularity_score.
 */
function stripPopularCategoryFilter(request: SearchRequest): SearchRequest {
  if (!request.params) return request;

  const cleanFilter = (filters: any) => {
    if (!filters) return filters;
    if (Array.isArray(filters)) {
      return filters
        .map((f) => {
          if (typeof f === 'string') {
            return f.includes('popular') ? null : f;
          }
          if (Array.isArray(f)) {
            const cleaned = f.filter(
              (item: string) => typeof item === 'string' && !item.includes('popular')
            );
            return cleaned.length > 0 ? cleaned : null;
          }
          return f;
        })
        .filter(Boolean);
    }
    return filters;
  };

  const beforeFacetFilters = request.params.facetFilters;
  const beforeFilter = request.params.filter;
  const afterFacetFilters = cleanFilter(request.params.facetFilters);
  const afterFilter = cleanFilter(request.params.filter);

  if (
    JSON.stringify(beforeFacetFilters) !== JSON.stringify(afterFacetFilters) ||
    JSON.stringify(beforeFilter) !== JSON.stringify(afterFilter)
  ) {
    console.log('[banana] stripPopularCategoryFilter triggered', {
      beforeFacetFilters,
      afterFacetFilters,
      beforeFilter,
      afterFilter,
    });
  }

  return {
    ...request,
    params: {
      ...request.params,
      facetFilters: afterFacetFilters,
      filter: afterFilter,
    },
  };
}

function hasMeaningfulCriteria(params?: SearchParams): boolean {
  if (hasQuery(params)) return true;
  if (!params) return false;
  if (params.facetFilters && Array.isArray(params.facetFilters)) {
    if (hasCategoryFilter(params.facetFilters)) return true;
  }
  if (params.filter && Array.isArray(params.filter)) {
    if (hasCategoryFilter(params.filter)) return true;
  }
  // Check for filters in the string format (from Configure component)
  if (params.filters && typeof params.filters === 'string') {
    if (params.filters.includes('top_level_category')) {
      console.log('[banana] Found category filter in params.filters (string):', params.filters);
      return true;
    }
  }
  return false;
}

function applyHybridSearchParams(
  request: SearchRequest,
  hybridConfig: HybridSearchConfig
): SearchRequest {
  return {
    ...request,
    params: {
      ...request.params,
      hybrid: {
        semanticRatio: hybridConfig.semanticRatio,
        embedder: hybridConfig.embedder || 'default',
      },
      showRankingScore: true,
    },
  };
}

function createEmptyResult() {
  return {
    hits: [],
    nbHits: 0,
    nbPages: 0,
    page: 0,
    processingTimeMS: 0,
    hitsPerPage: 0,
    exhaustiveNbHits: false,
    query: '',
    params: '',
    facets: {},
  };
}

export function createSearchClient(getHybridConfig?: () => HybridSearchConfig | undefined): any {
  const config: Record<string, unknown> = {
    primaryKey: 'id',
    placeholderSearch: true,
    keepZeroFacets: true,
    finitePagination: true,
  };

  const searchClientObject = {
    search(requests: SearchRequest[]) {
      console.log('[banana] search() called with requests:', requests);

      const { host, apiKey } = getMeiliSearchConfig();
      const baseClient = instantMeiliSearch(host, apiKey, config);

      const hybridConfig = getHybridConfig?.();
      let processedRequests = requests;

      if (hybridConfig) {
        processedRequests = requests.map((request) =>
          applyHybridSearchParams(request, hybridConfig)
        );
      }

      // Strip popular category filter so Meilisearch queries all categories by popularity_score
      processedRequests = processedRequests.map((r) => stripPopularCategoryFilter(r));
      console.log('[banana] after stripPopularCategoryFilter:', processedRequests);

      // Ensure sort parameter is always included for consistent popularity_score sorting
      processedRequests = processedRequests.map((r) => {
        if (!r.params) return r;
        // Only add sort if it's not already specified
        if (!r.params.sort && !r.params.sortBy) {
          console.log('[banana] Adding explicit sort parameter to request');
          return {
            ...r,
            params: {
              ...r.params,
              sort: ['popularity_score:desc'],
            },
          };
        }
        return r;
      });
      console.log('[banana] after ensuring sort parameter:', processedRequests);

      const hasAnyMeaningfulSearch = processedRequests.some(({ params }) => {
        const meaningful = hasMeaningfulCriteria(params);
        console.log('[banana] hasMeaningfulCriteria for params', params, '=', meaningful);
        return meaningful;
      });

      console.log('[banana] hasAnyMeaningfulSearch:', hasAnyMeaningfulSearch);

      if (!hasAnyMeaningfulSearch) {
        console.log('[banana] No meaningful search, returning empty results');
        return Promise.resolve({
          results: requests.map(() => createEmptyResult()),
        });
      }

      console.log('[banana] Sending to baseClient.searchClient.search:', processedRequests);

      // Log what instant-meilisearch is about to send to Meilisearch
      const result = baseClient.searchClient.search(processedRequests as any);
      result.then((res: any) => {
        console.log('[banana] Meilisearch response:', res);
      }).catch((err: any) => {
        console.log('[banana] Meilisearch error:', err);
      });

      return result;
    },
  };

  return {
    searchClient: searchClientObject,
  };
}

export const { searchClient }: { searchClient: any } = createSearchClient();

export const meilisearchClient = new Proxy({} as MeiliSearch, {
  get(target, prop, receiver) {
    const { host, apiKey } = getMeiliSearchConfig();
    const client = new MeiliSearch({ host, apiKey });
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export { createHybridSearchParams, type HybridSearchConfig } from '@readspace/shared';
