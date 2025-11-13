import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface FeedSwitcherStore {
    expandedFolders: Set<string>;
    toggleFolder: (folderId: string) => void;
    setExpandedFolders: (folders: Set<string>) => void;
}

export const useFeedSwitcherStore = create<FeedSwitcherStore>()(
    persist(
        (set) => ({
            expandedFolders: new Set<string>(),
            toggleFolder: (folderId: string) =>
                set((state) => {
                    const next = new Set(state.expandedFolders);
                    if (next.has(folderId)) {
                        next.delete(folderId);
                    } else {
                        next.add(folderId);
                    }
                    return { expandedFolders: next };
                }),
            setExpandedFolders: (folders: Set<string>) => set({ expandedFolders: folders }),
        }),
        {
            name: 'readspace-feed-switcher-state',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                // Convert Set to Array for JSON serialization
                expandedFolders: Array.from(state.expandedFolders),
            }),
            // Convert Array back to Set when hydrating
            merge: (persistedState: any, currentState) => ({
                ...currentState,
                expandedFolders: new Set(persistedState?.expandedFolders || []),
            }),
        }
    )
);
