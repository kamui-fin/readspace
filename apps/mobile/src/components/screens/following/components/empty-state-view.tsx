import WifiOffIcon from '@components/icons/local/wifi-off';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useNetworkConnectivity } from '@hooks/useNetworkConnectivity';
import { COLORS } from '@lib/constants/colors';
import { useWindowDimensions, View } from 'react-native';
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

const OFFLINE_CONFIG: EmptyStateConfig = {
  icon: WifiOffIcon,
  title: 'No internet',
  description: 'Connect to the internet to load new articles.',
};

export function EmptyStateView({
  isLoading,
  activeTab,
  contentPaddingTop = 0,
  contentPaddingBottom = 0,
}: EmptyStateViewProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { isOnline, isLoading: isConnectivityLoading } = useNetworkConnectivity();

  if (isLoading) {
    return null;
  }

  const config: EmptyStateConfig =
    !isOnline && !isConnectivityLoading
      ? OFFLINE_CONFIG
      : EMPTY_STATE_CONFIGS[activeTab as keyof typeof EMPTY_STATE_CONFIGS] ||
        DEFAULT_EMPTY_STATE_CONFIG;

  // Hard pixel dimensions + explicit centering. Inside the list's ScrollView on
  // Android, `flex: 1` / `width: "100%"` on the ListEmptyComponent resolve to a
  // near-zero box, which forced the title to wrap ("Your Feed is" / "Empty") and
  // hid the second line. The list's contentContainerStyle already offsets this
  // by the header (top) and tab bar (bottom), so subtract those from the window.
  const height = Math.max(windowHeight - contentPaddingTop - contentPaddingBottom, 360);

  return (
    <View
      style={{
        width: windowWidth,
        height,
        justifyContent: 'center',
        backgroundColor: colors.background,
      }}>
      {/* No alignItems here: EmptyState keeps the default `stretch` so its
          px-6 content box spans the full window width. Centering it instead
          shrink-wraps it and the title wraps to "Your Feed is" / "Empty". */}
      <EmptyState icon={config.icon} title={config.title} description={config.description} />
    </View>
  );
}
