import WifiOffIcon from '@components/icons/local/wifi-off';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useNetworkConnectivity } from '@hooks/useNetworkConnectivity';
import { COLORS } from '@lib/constants/colors';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function OfflineBanner() {
  const { isOnline, isLoading } = useNetworkConnectivity();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  if (isLoading || isOnline) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingTop: insets.top,
      }}>
      <View
        className="flex-row items-center justify-center gap-2 border-b"
        style={{
          backgroundColor: colors.grey5,
          borderBottomColor: colors.grey4,
          paddingVertical: 8,
          paddingHorizontal: 16,
        }}>
        <WifiOffIcon width={16} height={16} color={colors.grey} />
        <Text size="sm" fontFamily="geist" className="text-grey" numberOfLines={1}>
          No internet connection
        </Text>
      </View>
    </Animated.View>
  );
}
