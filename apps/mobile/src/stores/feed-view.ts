import { create } from 'zustand';

export type ViewType = 'following' | 'feed' | 'folder';

interface FeedViewState {
    viewType: ViewType;
    selectedId: string | null;
    selectedName: string | null;
    activeTab: number; // 0=Today, 1=Saved, 2=All, 3=Recent, -1=none when feed/folder selected
}

interface FeedViewActions {
    selectFeed: (feedId: string, feedName: string) => void;
    selectFolder: (folderId: string, folderName: string) => void;
    selectTab: (tabIndex: number) => void;
    reset: () => void;
}

type FeedViewStore = FeedViewState & FeedViewActions;

const initialState: FeedViewState = {
    viewType: 'following',
    selectedId: null,
    selectedName: null,
    activeTab: 0, // Default to "Today"
};

export const useFeedViewStore = create<FeedViewStore>((set) => ({
    ...initialState,

    selectFeed: (feedId, feedName) =>
        set({
            viewType: 'feed',
            selectedId: feedId,
            selectedName: feedName,
            activeTab: -1, // Deselect tabs when feed is selected
        }),

    selectFolder: (folderId, folderName) =>
        set({
            viewType: 'folder',
            selectedId: folderId,
            selectedName: folderName,
            activeTab: -1, // Deselect tabs when folder is selected
        }),

    selectTab: (tabIndex) =>
        set({
            viewType: 'following',
            selectedId: null,
            selectedName: null,
            activeTab: tabIndex,
        }),

    reset: () => set(initialState),
}));
