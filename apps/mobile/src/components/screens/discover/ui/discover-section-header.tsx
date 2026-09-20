import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import clsx from 'clsx';
import { Pressable, StyleSheet, View } from 'react-native';

interface DiscoverSectionHeaderProps {
  title: string;
  /** Renders a chevron affordance and makes the whole row tappable. */
  onPress?: () => void;
  /** Hairline above the title, separating this section from the one before it. */
  showRule?: boolean;
  className?: string;
}

/**
 * Section heading for the Discover landing screen, cut to the proportions Apple uses in
 * Podcasts and Music: a heavy title just under nav-bar size, a hairline rule marking where the
 * previous section ended, and enough space above that sections read as separate surfaces rather
 * than as one continuous list.
 *
 * The old headings were body-sized semibold with no rule, so they sat at the same visual weight
 * as the feed titles underneath and stopped registering as structure.
 */
export function DiscoverSectionHeader({
  title,
  onPress,
  showRule = true,
  className,
}: DiscoverSectionHeaderProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const heading = (
    <View className="flex-row items-center justify-between px-6 pb-3 pt-5">
      <Text
        fontFamily="geist-bold"
        className="text-primary-foreground"
        style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.6 }}>
        {title}
      </Text>
      {onPress && (
        <Text
          size="sm"
          fontFamily="geist-medium"
          style={{ color: colors.secondary }}
          accessibilityRole="button">
          See all
        </Text>
      )}
    </View>
  );

  return (
    <View className={clsx(className)}>
      {showRule && (
        <View
          className="mx-6"
          style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.grey4 }}
        />
      )}
      {onPress ? (
        <Pressable onPress={onPress} className="active:opacity-60">
          {heading}
        </Pressable>
      ) : (
        heading
      )}
    </View>
  );
}
