import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({
  id: 'following-storage',
});

// MMKV storage adapter for Zustand
const mmkvStorage = {
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    storage.set(name, value);
  },
  removeItem: (name: string) => {
    storage.remove(name);
  },
};

export type ArticleFilter = 'all' | 'unread' | 'read' | 'read_later';

interface FollowingState {
  // Active tab index (0: Today, 1: Saved, 2: All)
  activeTab: number;
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
}

interface FollowingActions {
  setActiveTab: (tab: number) => void;
  setFilter: (filter: ArticleFilter) => void;
  setLoadingState: (tab: 'today' | 'saved' | 'all', isLoading: boolean) => void;
  setArticleCount: (tab: 'today' | 'saved' | 'all', count: number) => void;
  setIsLoadingMore: (isLoading: boolean) => void;
  reset: () => void;
}

export type FollowingStore = FollowingState & FollowingActions;

const initialState: FollowingState = {
  activeTab: 0,
  filter: 'all',
  loadingStates: {
    today: false,
    saved: false,
    all: false,
  },
  articleCounts: {
    today: 0,
    saved: 0,
    all: 0,
  },
  isLoadingMore: false,
};

export const useFollowingStore = create<FollowingStore>()(
  persist(
    (set) => ({
      ...initialState,

      setActiveTab: (tab) => {
        set({ activeTab: tab });
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

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'readspace-following',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        // Persist the active tab and filter, not loading states or counts
        activeTab: state.activeTab,
        filter: state.filter,
      }),
    }
  )
);

// Helper function to get current active tab synchronously
export const getActiveTab = () => useFollowingStore.getState().activeTab;

// Helper function to get tab name for display
export const getTabName = (tab: number): string => {
  switch (tab) {
    case 0:
      return "today's articles";
    case 1:
      return 'saved articles';
    case 2:
      return 'articles';
    default:
      return 'articles';
  }
};

// Helper function to get tab key from index
export const getTabKey = (tab: number): 'today' | 'saved' | 'all' => {
  switch (tab) {
    case 0:
      return 'today';
    case 1:
      return 'saved';
    case 2:
      return 'all';
    default:
      return 'all';
  }
};
