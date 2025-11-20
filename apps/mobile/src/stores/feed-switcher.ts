import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const storage = createMMKV();

const zustandStorage = {
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
      storage: createJSONStorage(() => zustandStorage),
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
