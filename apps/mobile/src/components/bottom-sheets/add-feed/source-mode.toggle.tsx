import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { FeedIcon, LetterOpenedIcon } from '@solar-icons/react-native/linear';
import { CrownIcon } from '@solar-icons/react-native/bold';
import { MotiView } from 'moti';
import { useCallback, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Easing } from 'react-native-reanimated';
import {
  ADD_FEED_MODE_LABELS,
  ADD_FEED_MODES,
  type SourceModeToggleProps,
} from './source-mode.toggle.types';

export type { SourceModeToggleProps } from './source-mode.toggle.types';

const TRACK_PADDING = 3;

/**
 * Android / default: our own segmented control, matching `SearchModeToggle` in Discover rather
 * than inventing a third look. iOS uses a real `UISegmentedControl` instead.
 */
export function SourceModeToggle({ mode, onModeChange }: SourceModeToggleProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const [trackWidth, setTrackWidth] = useState(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / 2 : 0;
  const activeIndex = ADD_FEED_MODES.indexOf(mode);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Source"
      onLayout={handleLayout}
      style={[styles.track, { backgroundColor: colors.grey6 }]}>
      {segmentWidth > 0 && (
        <MotiView
          animate={{ translateX: segmentWidth * activeIndex }}
          transition={{ type: 'timing', duration: 200, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }}
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: segmentWidth,
              backgroundColor: isDark ? colors.grey4 : COLORS.light.white,
            },
          ]}
        />
      )}
      {ADD_FEED_MODES.map((value) => {
        const isActive = mode === value;
        const color = isActive
          ? isDark
            ? colors.primary_foreground
            : colors.primary
          : isDark
            ? colors.grey2
            : colors.grey;
        const Icon = value === 'rss' ? FeedIcon : LetterOpenedIcon;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={value === 'newsletter' ? 'Newsletter, Pro feature' : 'RSS feed'}
            accessibilityState={{ selected: isActive }}
            onPress={() => onModeChange(value)}
            style={styles.segment}>
            <Icon size={13} color={color} strokeWidth={1.8} />
            <Text
              fontFamily={isActive ? 'geist-semibold' : 'geist-medium'}
              size={13}
              style={{ color }}>
              {ADD_FEED_MODE_LABELS[value]}
            </Text>
            {value === 'newsletter' && <CrownIcon size={13} color={color} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'relative',
    flexDirection: 'row',
    borderRadius: 12,
    padding: TRACK_PADDING,
    marginTop: 4,
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 9,
    zIndex: 1,
  },
});
