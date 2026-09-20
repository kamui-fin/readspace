/** Where a new subscription comes from: an RSS URL, or the user's private newsletter alias. */
export type AddFeedMode = 'rss' | 'newsletter';

export const ADD_FEED_MODE_LABELS: Record<AddFeedMode, string> = {
  rss: 'RSS Feed',
  newsletter: 'Newsletter',
};

export const ADD_FEED_MODES: AddFeedMode[] = ['rss', 'newsletter'];

export interface SourceModeToggleProps {
  mode: AddFeedMode;
  onModeChange: (mode: AddFeedMode) => void;
}
