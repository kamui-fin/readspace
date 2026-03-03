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
  message: string;
}

export const EMPTY_STATE_CONFIGS: Record<number, EmptyStateConfig> = {
  0: {
    icon: InboxBrokenIcon,
    message: 'No articles yet. Add some feeds to get started!',
  },
  1: {
    icon: InboxBrokenIcon,
    message: 'No articles for today yet. Check back later!',
  },
  2: {
    icon: BookmarkBrokenIcon,
    message: 'No saved articles. Swipe right on articles to bookmark them.',
  },
  3: {
    icon: HistoryBrokenIcon,
    message: 'No recently read articles.',
  },
};

export const DEFAULT_EMPTY_STATE_CONFIG: EmptyStateConfig = {
  icon: InboxBrokenIcon,
  message: 'No articles available.',
};
