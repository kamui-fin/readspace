import type { Language } from '@components/screens/discover/ui/search-bar.input';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface DiscoverPreferencesState {
  /** Selected discover search language. Always defaults to English. */
  language: Language;
}

interface DiscoverPreferencesActions {
  setLanguage: (language: Language) => void;
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

/** Read the persisted discover language synchronously, outside of React. */
export const getDiscoverLanguage = (): Language => useDiscoverPreferences.getState().language;

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
