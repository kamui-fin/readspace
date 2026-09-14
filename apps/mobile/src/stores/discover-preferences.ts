import type { Language } from '@components/screens/discover/ui/search-bar.input';

/**
 * Discover search is English-only for now — there is no UI to change it, and this always
 * resolves to English regardless of any language preference persisted by an older app version.
 */
export const getDiscoverLanguage = (): Language => 'english';

/**
 * Map a discover language label to the ISO code used in Meilisearch `language`
 * filters. Returns `null` for "all" (no language filter should be applied).
 */
export function discoverLanguageToCode(language: Language): string | null {
  switch (language) {
    case 'all':
      return null;
    case 'chinese':
      return 'zh';
    case 'japanese':
      return 'ja';
    default:
      return 'en';
  }
}
