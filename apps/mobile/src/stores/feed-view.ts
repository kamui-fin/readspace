import { create } from 'zustand';

type ViewType = 'default' | 'feed' | 'folder' | 'feedPreview';

interface FeedViewState {
  viewType: ViewType;
  selectedId: string | null;
  selectedName: string | null;
  activeTab: number; // 0=Today, 1=Saved, 2=All, 3=Recent, -1=none when feed/folder selected
  isPreviewMode: boolean; // True when viewing an unsubscribed feed
  previewSourceRoute: string | null; // Route to return to when exiting preview mode
}

interface FeedViewActions {
  selectFeed: (feedId: string, feedName: string) => void;
  selectFolder: (folderId: string, folderName: string) => void;
  selectFeedPreview: (feedId: string, feedName: string, sourceRoute?: string) => void;
  selectTab: (tabIndex: number) => void;
  clearView: () => void;
  reset: () => void;
}

export type FeedViewStore = FeedViewState & FeedViewActions;

const initialState: FeedViewState = {
  viewType: 'default',
  selectedId: null,
  selectedName: null,
  activeTab: 0,
  isPreviewMode: false,
  previewSourceRoute: null,
};

export const useFeedViewStore = create<FeedViewStore>((set) => ({
  ...initialState,

  selectFeed: (feedId, feedName) => {
    set({
      viewType: 'feed',
      selectedId: feedId,
      selectedName: feedName,
      activeTab: -1,
      isPreviewMode: false,
      previewSourceRoute: null,
    });
  },

  selectFolder: (folderId, folderName) => {
    set({
      viewType: 'folder',
      selectedId: folderId,
      selectedName: folderName,
      activeTab: -1,
      isPreviewMode: false,
      previewSourceRoute: null,
    });
  },

  selectFeedPreview: (feedId, feedName, sourceRoute) => {
    set({
      viewType: 'feedPreview',
      selectedId: feedId,
      selectedName: feedName,
      activeTab: -1,
      isPreviewMode: true,
      previewSourceRoute: sourceRoute || null,
    });
  },

  selectTab: (tabIndex) => {
    set({
      activeTab: tabIndex,
      viewType: 'default',
      selectedId: null,
      selectedName: null,
      isPreviewMode: false,
      previewSourceRoute: null,
    });
  },

  clearView: () => {
    set({
      viewType: 'default',
      selectedId: null,
      selectedName: null,
      activeTab: 0,
      isPreviewMode: false,
      previewSourceRoute: null,
    });
  },

  reset: () => {
    set(initialState);
  },
}));
