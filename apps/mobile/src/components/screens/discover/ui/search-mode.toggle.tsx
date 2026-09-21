import { Sparkle } from '@components/icons/svg';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { DiscoverSearchMode } from '@stores/discover-preferences';
import { MotiView } from 'moti';
import { useCallback, useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';
import { Easing } from 'react-native-reanimated';

interface SearchModeToggleProps {
  mode: DiscoverSearchMode;
  onModeChange: (mode: DiscoverSearchMode) => void;
}

const TRACK_PADDING = 3;

/**
 * Segmented control between Keywords and Smart (hybrid semantic) search.
 *
 * Lives only in places with room to breathe — the suggestions panel and the
 * options sheet — never in the search field itself, where it competed with the
 * clear button for a field that needs to stay mostly text. A segmented control
 * rather than a switch because a lone toggle's label is ambiguous: you can't
 * tell whether it names the current mode or the one tapping would switch to.
 */
export function SearchModeToggle({ mode, onModeChange }: SearchModeToggleProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const [trackWidth, setTrackWidth] = useState(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const isSmart = mode === 'smart';
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / 2 : 0;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Search mode"
      onLayout={handleLayout}
      className="flex-row rounded-full"
      style={{ backgroundColor: colors.grey6, padding: TRACK_PADDING }}>
      {segmentWidth > 0 && (
        <MotiView
          animate={{ translateX: isSmart ? segmentWidth : 0 }}
          transition={{ type: 'timing', duration: 200, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: TRACK_PADDING,
            bottom: TRACK_PADDING,
            left: TRACK_PADDING,
            width: segmentWidth,
            borderRadius: 9999,
            backgroundColor: isDark ? colors.grey4 : COLORS.light.white,
          }}
        />
      )}

      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: !isSmart }}
        onPress={() => onModeChange('keywords')}
        className="flex-1 items-center justify-center py-2"
        hitSlop={6}>
        <Text
          size="sm"
          fontFamily={isSmart ? 'geist-medium' : 'geist-semibold'}
          numberOfLines={1}
          style={{ color: isSmart ? colors.grey : colors.black }}>
          Keywords
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: isSmart }}
        onPress={() => onModeChange('smart')}
        className="flex-1 flex-row items-center justify-center gap-1.5 py-2"
        hitSlop={6}>
        <Sparkle width={15} height={15} color={isSmart ? colors.secondary : colors.grey} />
        <Text
          size="sm"
          fontFamily={isSmart ? 'geist-semibold' : 'geist-medium'}
          numberOfLines={1}
          style={{ color: isSmart ? colors.secondary : colors.grey }}>
          Smart
        </Text>
      </Pressable>
    </View>
  );
}
