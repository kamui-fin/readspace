import { BookmarkIcon, HistoryIcon, InboxIcon } from '@solar-icons/react-native/broken';

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
    icon: InboxIcon,
    title: 'Nothing to read here',
    description: 'Explore trending topics or import your subscriptions to get started.',
  },
  1: {
    icon: InboxIcon,
    title: 'All caught up',
    description: 'No new articles published today. Check back later for fresh updates!',
  },
  2: {
    icon: BookmarkIcon,
    title: 'No saved articles',
    description: 'Swipe right on articles in your feed to bookmark them for later reading.',
  },
  3: {
    icon: HistoryIcon,
    title: 'No reading history',
    description: 'Articles you read will show up here so you can easily find them again.',
  },
};

export const DEFAULT_EMPTY_STATE_CONFIG: EmptyStateConfig = {
  icon: InboxIcon,
  title: 'No articles available',
  description: 'There are no articles to display in this section.',
};
