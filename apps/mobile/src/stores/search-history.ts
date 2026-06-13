import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const MAX_SEARCH_HISTORY = 10;

interface SearchHistoryState {
  searches: string[];
}

interface SearchHistoryActions {
  addSearch: (query: string) => void;
  removeSearch: (query: string) => void;
  clearHistory: () => void;
}

export type SearchHistoryStore = SearchHistoryState & SearchHistoryActions;

export const useSearchHistory = create<SearchHistoryStore>()(
  persist(
    (set) => ({
      searches: [],

      addSearch: (query) => {
        const trimmedQuery = query.trim().toLowerCase();

        // Don't add empty queries
        if (!trimmedQuery) {
          return;
        }

        set((state) => {
          // Remove existing instance of this query (if any)
          const filteredSearches = state.searches.filter(
            (search) => search.toLowerCase() !== trimmedQuery
          );

          // Add to front and limit to MAX_SEARCH_HISTORY
          const newSearches = [query.trim(), ...filteredSearches].slice(0, MAX_SEARCH_HISTORY);

          return { searches: newSearches };
        });
      },

      removeSearch: (query) => {
        set((state) => ({
          searches: state.searches.filter(
            (search) => search.toLowerCase() !== query.trim().toLowerCase()
          ),
        }));
      },

      clearHistory: () => {
        set({ searches: [] });
      },
    }),
    {
      name: 'readspace-search-history',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        searches: state.searches,
      }),
    }
  )
);


// Helper function to get recent searches synchronously
export const getRecentSearches = (): string[] => {
  return useSearchHistory.getState().searches;
};
