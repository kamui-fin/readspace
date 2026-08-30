import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { EyeIcon } from '@solar-icons/react-native/bold';
import { View } from 'react-native';

interface FeedPreviewBannerProps {
  feedTitle: string;
  onFollow: () => void;
}

export function FeedPreviewBanner({ feedTitle: _feedTitle, onFollow }: FeedPreviewBannerProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  // Use same color scheme as toast info type
  const backgroundColor = isDark
    ? 'rgb(45, 40, 25)' // Dark mode equivalent of orange background
    : 'rgb(255, 245, 230)'; // Light orange background from toast
  const textColor = isDark ? COLORS.dark.orange : COLORS.light.orange;
  const iconColor = textColor;

  return (
    <View
      className="w-80 flex-row items-center justify-between rounded-full py-[10px] pl-4 pr-[18px] shadow-none"
      style={{
        backgroundColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        alignSelf: 'center', // Not full-width, centered like toast
      }}>
      {/* Solar Eye Icon */}
      <View className="flex-row items-center gap-2">
        <EyeIcon size={20} color={iconColor} />
        <Text
          size="lg"
          fontFamily="geist-semibold"
          className="leading-5"
          style={{ color: textColor }}>
          Preview Mode
        </Text>
      </View>

      {/* Preview Text */}

      {/* Full-rounded Follow Button */}
      <View className="ml-3">
        <Button
          variant="primary"
          size="small"
          fullWidth={false}
          style={{ backgroundColor: colors.orange }}
          className="rounded-full px-4 py-2"
          onPress={onFollow}>
          Follow
        </Button>
      </View>
    </View>
  );
}
