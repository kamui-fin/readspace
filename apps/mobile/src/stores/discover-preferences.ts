import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Languages selectable in Discover search — kept intentionally small (matches web). */
export type DiscoverLanguage = 'english' | 'chinese';

/**
 * Discover search mode.
 *
 * - `keywords`: classic typo-tolerant keyword matching, refined on every keystroke.
 * - `smart`: hybrid keyword + semantic (vector) search. Each request costs an
 *   embedding, so it only runs on submit — never as-you-type.
 */
export type DiscoverSearchMode = 'keywords' | 'smart';

interface DiscoverPreferencesState {
  language: DiscoverLanguage;
  searchMode: DiscoverSearchMode;
}

interface DiscoverPreferencesActions {
  setLanguage: (language: DiscoverLanguage) => void;
  setSearchMode: (searchMode: DiscoverSearchMode) => void;
}

export type DiscoverPreferencesStore = DiscoverPreferencesState & DiscoverPreferencesActions;

export const useDiscoverPreferences = create<DiscoverPreferencesStore>()(
  persist(
    (set) => ({
      language: 'english',
      searchMode: 'keywords',

      setLanguage: (language) => {
        set({ language });
      },

      setSearchMode: (searchMode) => {
        set({ searchMode });
      },
    }),
    {
      name: 'readspace-discover-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        language: state.language,
        searchMode: state.searchMode,
      }),
    }
  )
);

/** Synchronous accessor for the persisted discover language preference. */
export const getDiscoverLanguage = (): DiscoverLanguage =>
  useDiscoverPreferences.getState().language;

/** Synchronous accessor for the persisted discover search mode. */
export const getDiscoverSearchMode = (): DiscoverSearchMode =>
  useDiscoverPreferences.getState().searchMode;

/**
 * Map a discover language label to the ISO code used in Meilisearch `language`
 * filters.
 */
export function discoverLanguageToCode(language: DiscoverLanguage): string {
  switch (language) {
    case 'chinese':
      return 'zh';
    default:
      return 'en';
  }
}
