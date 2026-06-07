import { resolveHostname } from '@lib/utils/network';
import { instantMeiliSearch } from '@meilisearch/instant-meilisearch';
import type { HybridSearchConfig } from '@readspace/shared';
import { getSettings } from '@stores/settings';
import { MeiliSearch } from 'meilisearch';
import { Platform } from 'react-native';

export const MEILISEARCH_URL = process.env.EXPO_PUBLIC_MEILISEARCH_URL || 'http://localhost:7700';
export const MEILISEARCH_SEARCH_KEY = process.env.EXPO_PUBLIC_MEILISEARCH_SEARCH_KEY || '';

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
      return filter.startsWith('top_level_category:') || filter.includes('top_level_category');
    }
    if (Array.isArray(filter)) {
      return filter.some(
        (f: string) =>
          typeof f === 'string' &&
          (f.startsWith('top_level_category:') || f.includes('top_level_category'))
      );
    }
    return false;
  });
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
      const { host, apiKey } = getMeiliSearchConfig();
      const baseClient = instantMeiliSearch(host, apiKey, config);

      const hybridConfig = getHybridConfig?.();
      let processedRequests = requests;

      if (hybridConfig) {
        processedRequests = requests.map((request) =>
          applyHybridSearchParams(request, hybridConfig)
        );
      }

      const hasAnyMeaningfulSearch = processedRequests.some(({ params }) =>
        hasMeaningfulCriteria(params)
      );

      if (!hasAnyMeaningfulSearch) {
        return Promise.resolve({
          results: requests.map(() => createEmptyResult()),
        });
      }

      return baseClient.searchClient.search(processedRequests as any);
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
