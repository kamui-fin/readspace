import { FOLLOWING_TAB, NO_ACTIVE_TAB } from '@lib/constants/tabs';
import { create } from 'zustand';
import { useFollowingStore } from './following';

type ViewType = 'default' | 'feed' | 'folder' | 'feedPreview';

interface FeedViewState {
  viewType: ViewType;
  selectedId: string | null;
  selectedName: string | null;
  activeTab: number; // FOLLOWING_TAB index, or NO_ACTIVE_TAB while a feed/folder is selected
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
  activeTab: FOLLOWING_TAB.ALL,
  isPreviewMode: false,
  previewSourceRoute: null,
};

export const useFeedViewStore = create<FeedViewStore>((set) => ({
  ...initialState,

  selectFeed: (feedId, feedName) => {
    useFollowingStore.getState().setActiveTab(FOLLOWING_TAB.ALL);
    set({
      viewType: 'feed',
      selectedId: feedId,
      selectedName: feedName,
      activeTab: NO_ACTIVE_TAB,
      isPreviewMode: false,
      previewSourceRoute: null,
    });
  },

  selectFolder: (folderId, folderName) => {
    useFollowingStore.getState().setActiveTab(FOLLOWING_TAB.ALL);
    set({
      viewType: 'folder',
      selectedId: folderId,
      selectedName: folderName,
      activeTab: NO_ACTIVE_TAB,
      isPreviewMode: false,
      previewSourceRoute: null,
    });
  },

  selectFeedPreview: (feedId, feedName, sourceRoute) => {
    useFollowingStore.getState().setActiveTab(FOLLOWING_TAB.ALL);
    set({
      viewType: 'feedPreview',
      selectedId: feedId,
      selectedName: feedName,
      activeTab: NO_ACTIVE_TAB,
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
      activeTab: FOLLOWING_TAB.ALL,
      isPreviewMode: false,
      previewSourceRoute: null,
    });
  },

  reset: () => {
    set(initialState);
  },
}));
