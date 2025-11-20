import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';

import { MotiView } from 'moti';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Extrapolation } from 'react-native-reanimated';

const PRESET_SIZE = {
  small: {
    width: 44.5,
    height: 21.5,
    thumbHeight: 17.5,
    thumbWidth: 17.5,
    thumbOffset: 2,
  },
  regular: {
    width: 50,
    height: 28,
    thumbHeight: 24,
    thumbWidth: 24,
    thumbOffset: 2,
  },
};

export type SwitchProps = {
  checked?: boolean;
  onChange?: (nextValue: boolean) => void;
  size?: 'small' | 'regular';
};

export const Switch = (props: SwitchProps) => {
  const { checked, onChange, size = 'regular', ...rest } = props;

  const isDark = useIsDarkMode();
  const width = PRESET_SIZE[size].width;
  const height = PRESET_SIZE[size].height;
  const thumbHeight = PRESET_SIZE[size].thumbHeight;
  const thumbWidth = PRESET_SIZE[size].thumbWidth;
  const thumbOffset = PRESET_SIZE[size].thumbOffset;

  const backgroundColor = checked
    ? COLORS.light.secondary
    : isDark
      ? COLORS.dark.grey4
      : COLORS.light.grey4;

  return (
    <Pressable
      style={[{ width }, styles.pressableStyle]}
      onPress={useCallback(() => {
        if (onChange) {
          onChange(!checked);
        }
      }, [onChange, checked])}
      role="switch"
      accessibilityState={{ checked }}
      {...rest}>
      <View style={[styles.backgroundWrapper, { width, height, backgroundColor }]} />
      <MotiView
        style={[{ height: thumbHeight, width: thumbWidth }, styles.thumbStyle]}
        animate={{
          translateX: checked ? width - thumbWidth - thumbOffset : thumbOffset,
        }}
        // @ts-expect-error
        transition={{ overshootClamping: Extrapolation.CLAMP }}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  thumbStyle: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 999,
  },
  pressableStyle: {
    justifyContent: 'center',
  },
  backgroundWrapper: {
    overflow: 'hidden',
    borderRadius: 999,
  },
});
