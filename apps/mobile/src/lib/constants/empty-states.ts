import BookmarkBrokenIcon from '@components/icons/solar/bookmark-broken';
import HistoryBrokenIcon from '@components/icons/solar/history-broken';
import InboxBrokenIcon from '@components/icons/solar/inbox-broken';

export interface EmptyStateConfig {
  icon: React.ComponentType<{
    width?: number;
    height?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  title: string;
  description: string;
}

export const EMPTY_STATE_CONFIGS: Record<number, EmptyStateConfig> = {
  0: {
    icon: InboxBrokenIcon,
    title: 'Your Feed is Empty',
    description: 'Explore trending topics or import your subscriptions to get started.',
  },
  1: {
    icon: InboxBrokenIcon,
    title: 'All Caught Up',
    description: 'No new articles published today. Check back later for fresh updates!',
  },
  2: {
    icon: BookmarkBrokenIcon,
    title: 'No Saved Articles',
    description: 'Swipe right on articles in your feed to bookmark them for later reading.',
  },
  3: {
    icon: HistoryBrokenIcon,
    title: 'No Reading History',
    description: 'Articles you read will show up here so you can easily find them again.',
  },
};

export const DEFAULT_EMPTY_STATE_CONFIG: EmptyStateConfig = {
  icon: InboxBrokenIcon,
  title: 'No Articles Available',
  description: 'There are no articles to display in this section.',
};
