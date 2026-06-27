import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ArticleFilter = 'all' | 'unread' | 'read' | 'read_later';

interface FollowingState {
  // Active tab index (0: All, 1: Today, 2: Saved, 3: Recent)
  activeTab: number;
  // Previous tab index (for back button navigation)
  previousTab: number | null;
  // Article filter (all, unread, read)
  filter: ArticleFilter;
  // Track loading states per tab
  loadingStates: {
    today: boolean;
    saved: boolean;
    all: boolean;
  };
  // Track article counts per tab (for toast messages)
  articleCounts: {
    today: number;
    saved: number;
    all: number;
  };
  // Track if we're currently loading more articles
  isLoadingMore: boolean;
  // Whether the store has been rehydrated from AsyncStorage
  _hasHydrated: boolean;
}

interface FollowingActions {
  setActiveTab: (tab: number) => void;
  setFilter: (filter: ArticleFilter) => void;
  setLoadingState: (tab: 'today' | 'saved' | 'all', isLoading: boolean) => void;
  setArticleCount: (tab: 'today' | 'saved' | 'all', count: number) => void;
  setIsLoadingMore: (isLoading: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  reset: () => void;
}

export type FollowingStore = FollowingState & FollowingActions;

const initialState: FollowingState = {
  activeTab: 0,
  previousTab: null,
  filter: 'all',
  loadingStates: {
    all: false,
    today: false,
    saved: false,
  },
  articleCounts: {
    today: 0,
    saved: 0,
    all: 0,
  },
  isLoadingMore: false,
  _hasHydrated: false,
};

export const useFollowingStore = create<FollowingStore>()(
  persist(
    (set) => ({
      ...initialState,

      setActiveTab: (tab) => {
        set((state) => {
          // Only track previous tab if it's different from current
          const previousTab = state.activeTab !== tab ? state.activeTab : state.previousTab;
          return { activeTab: tab, previousTab };
        });
      },

      setFilter: (filter) => {
        set({ filter });
      },

      setLoadingState: (tab, isLoading) => {
        set((state) => ({
          loadingStates: {
            ...state.loadingStates,
            [tab]: isLoading,
          },
        }));
      },

      setArticleCount: (tab, count) => {
        set((state) => ({
          articleCounts: {
            ...state.articleCounts,
            [tab]: count,
          },
        }));
      },

      setIsLoadingMore: (isLoading) => {
        set({ isLoadingMore: isLoading });
      },

      setHasHydrated: (hasHydrated) => {
        set({ _hasHydrated: hasHydrated });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'readspace-following',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Persist the active tab and filter, not loading states or counts
        // Don't persist previousTab as it's only for navigation within session
        activeTab: state.activeTab,
        filter: state.filter,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Hook to check if the following store has been hydrated from AsyncStorage
export const useHasFollowingHydrated = () => useFollowingStore((state) => state._hasHydrated);

// Helper function to get current active tab synchronously
export const getActiveTab = () => useFollowingStore.getState().activeTab;

// Helper function to get tab name for display
export const getTabName = (tab: number): string => {
  switch (tab) {
    case 0:
      return 'articles';
    case 1:
      return "today's articles";
    case 2:
      return 'saved articles';
    default:
      return 'articles';
  }
};

// Helper function to get tab key from index
export const getTabKey = (tab: number): 'today' | 'saved' | 'all' => {
  switch (tab) {
    case 0:
      return 'all';
    case 1:
      return 'today';
    case 2:
      return 'saved';
    default:
      return 'all';
  }
};
