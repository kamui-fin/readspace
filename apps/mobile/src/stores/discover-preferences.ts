import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Languages selectable in Discover search — kept intentionally small (matches web). */
export type DiscoverLanguage = 'english' | 'chinese';

interface DiscoverPreferencesState {
  language: DiscoverLanguage;
}

interface DiscoverPreferencesActions {
  setLanguage: (language: DiscoverLanguage) => void;
}

export type DiscoverPreferencesStore = DiscoverPreferencesState & DiscoverPreferencesActions;

export const useDiscoverPreferences = create<DiscoverPreferencesStore>()(
  persist(
    (set) => ({
      language: 'english',

      setLanguage: (language) => {
        set({ language });
      },
    }),
    {
      name: 'readspace-discover-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        language: state.language,
      }),
    }
  )
);

/** Synchronous accessor for the persisted discover language preference. */
export const getDiscoverLanguage = (): DiscoverLanguage =>
  useDiscoverPreferences.getState().language;

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
