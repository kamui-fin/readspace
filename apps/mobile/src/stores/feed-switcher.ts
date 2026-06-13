import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface FeedSwitcherState {
  expandedFolders: Set<string>;
}

interface FeedSwitcherActions {
  toggleFolder: (folderId: string) => void;
  setExpandedFolders: (folders: Set<string>) => void;
}

export type FeedSwitcherStore = FeedSwitcherState & FeedSwitcherActions;

export const useFeedSwitcherStore = create<FeedSwitcherStore>()(
  persist(
    (set) => ({
      expandedFolders: new Set<string>(),

      toggleFolder: (folderId: string) =>
        set((state) => {
          const newExpanded = new Set(state.expandedFolders);
          if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId);
          } else {
            newExpanded.add(folderId);
          }
          return { expandedFolders: newExpanded };
        }),

      setExpandedFolders: (folders: Set<string>) => set({ expandedFolders: folders }),
    }),
    {
      name: 'feed-switcher-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Custom serialization for Set
      partialize: (state) => ({
        expandedFolders: Array.from(state.expandedFolders),
      }),
      // Custom deserialization for Set
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        expandedFolders: new Set(persistedState?.expandedFolders || []),
      }),
    }
  )
);

