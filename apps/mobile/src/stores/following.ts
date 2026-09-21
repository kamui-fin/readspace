import { FOLLOWING_TAB } from '@lib/constants/tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ArticleFilter = 'all' | 'unread' | 'read' | 'read_later';

interface FollowingState {
  // Active tab index — see FOLLOWING_TAB in @lib/constants/tabs
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
  activeTab: FOLLOWING_TAB.TODAY,
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
        // Reset user-specific state without marking the already-loaded store as
        // unhydrated. Hydration only runs once per app launch, so resetting this
        // flag on sign-out leaves filter controls stale until the next restart.
        set((state) => ({
          ...initialState,
          _hasHydrated: state._hasHydrated,
        }));
      },
    }),
    {
      name: 'readspace-following',
      storage: createJSONStorage(() => AsyncStorage),
      // v1 moved Today to the front of the tab row (was All, Today, Saved).
      // Without this, everyone with a persisted tab index would silently land
      // on the neighbouring tab after updating.
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as Partial<FollowingState> | undefined;
        if (!state || version >= 1) return state as FollowingState;

        const V0_TO_V1_TAB: Record<number, number> = {
          0: FOLLOWING_TAB.ALL, // v0 "All" was index 0
          1: FOLLOWING_TAB.TODAY, // v0 "Today" was index 1
        };
        return {
          ...state,
          activeTab: V0_TO_V1_TAB[state.activeTab ?? 0] ?? state.activeTab,
        } as FollowingState;
      },
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
    case FOLLOWING_TAB.TODAY:
      return "today's articles";
    case FOLLOWING_TAB.SAVED:
      return 'saved articles';
    default:
      return 'articles';
  }
};

// Helper function to get tab key from index
export const getTabKey = (tab: number): 'today' | 'saved' | 'all' => {
  switch (tab) {
    case FOLLOWING_TAB.TODAY:
      return 'today';
    case FOLLOWING_TAB.SAVED:
      return 'saved';
    default:
      return 'all';
  }
};
