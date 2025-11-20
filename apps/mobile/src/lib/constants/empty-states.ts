export interface EmptyStateConfig {
  icon: string;
  message: string;
}

export const EMPTY_STATE_CONFIGS: Record<number, EmptyStateConfig> = {
  0: {
    icon: 'solar:inbox-broken',
    message: 'No articles for today yet. Check back later!',
  },
  1: {
    icon: 'solar:bookmark-broken',
    message: 'No saved articles. Swipe right on articles to bookmark them.',
  },
  2: {
    icon: 'solar:inbox-broken',
    message: 'No articles yet. Add some feeds to get started!',
  },
  3: {
    icon: 'solar:history-broken',
    message: 'No recently read articles.',
  },
};

export const DEFAULT_EMPTY_STATE_CONFIG: EmptyStateConfig = {
  icon: 'solar:inbox-broken',
  message: 'No articles available.',
};
