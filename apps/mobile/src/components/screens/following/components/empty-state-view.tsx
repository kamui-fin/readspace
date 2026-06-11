import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui/empty-state';

import {
  DEFAULT_EMPTY_STATE_CONFIG,
  EMPTY_STATE_CONFIGS,
  type EmptyStateConfig,
} from '../../../../lib/constants/empty-states';

interface EmptyStateViewProps {
  isLoading: boolean;
  activeTab: number;
  // refreshing/onRefresh/refreshColor are kept for API compatibility but
  // refresh is now handled by the parent InfiniteScrollList's RefreshControl
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshColor?: string;
  contentPaddingTop?: number;
  contentPaddingBottom?: number;
}

export function EmptyStateView({
  isLoading,
  activeTab,
  contentPaddingTop = 0,
  contentPaddingBottom = 0,
}: EmptyStateViewProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  if (isLoading) {
    return null;
  }

  const config: EmptyStateConfig =
    EMPTY_STATE_CONFIGS[activeTab as keyof typeof EMPTY_STATE_CONFIGS] ||
    DEFAULT_EMPTY_STATE_CONFIG;

  return (
    <View
      style={{
        flex: 1,
        paddingTop: contentPaddingTop,
        paddingBottom: contentPaddingBottom,
        backgroundColor: colors.background,
      }}>
      <EmptyState
        variant="centered"
        icon={config.icon}
        title={config.title}
        description={config.description}
      />
    </View>
  );
}
