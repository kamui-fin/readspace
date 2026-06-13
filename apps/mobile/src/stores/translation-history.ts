import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const MAX_RECENT_LANGUAGES = 3;

interface TranslationHistoryState {
  recentLanguages: string[]; // store language codes
}

interface TranslationHistoryActions {
  addRecentLanguage: (langCode: string) => void;
  clearHistory: () => void;
}

export type TranslationHistoryStore = TranslationHistoryState & TranslationHistoryActions;

export const useTranslationHistory = create<TranslationHistoryStore>()(
  persist(
    (set) => ({
      recentLanguages: [],

      addRecentLanguage: (langCode) => {
        set((state) => {
          // Remove existing instance of this language (if any)
          const filteredLanguages = state.recentLanguages.filter((code) => code !== langCode);

          // Add to front and limit to MAX_RECENT_LANGUAGES
          const newLanguages = [langCode, ...filteredLanguages].slice(0, MAX_RECENT_LANGUAGES);

          return { recentLanguages: newLanguages };
        });
      },

      clearHistory: () => {
        set({ recentLanguages: [] });
      },
    }),
    {
      name: 'readspace-translation-history',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recentLanguages: state.recentLanguages,
      }),
    }
  )
);
