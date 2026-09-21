import { useIsDarkMode, useOnFocus, useOnHover } from '@hooks/index';
import { COLORS } from '@lib/constants/colors';

import { MotiView } from 'moti';
import { useCallback } from 'react';
import { Platform, Pressable, PressableProps } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Path, Svg } from 'react-native-svg';

const CHECK_PATH = 'M5 12.5l4.5 4.5L19 7.5';
// One short tween for fill + tick: reads as an instant, tactile snap rather than a bounce.
const TICK_TRANSITION = { type: 'timing', duration: 120 } as const;

interface CheckboxIndicatorProps {
  checked: boolean;
  disabled?: boolean;
  size?: number;
}

/**
 * The visual checkbox alone: a rounded square that fills with brand green and snaps a white
 * tick in when checked. Use it inside a larger pressable row that owns the press + a11y role.
 */
export const CheckboxIndicator = ({ checked, disabled, size = 22 }: CheckboxIndicatorProps) => {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  return (
    <MotiView
      animate={{
        backgroundColor: checked ? colors.secondary : 'transparent',
        borderColor: checked ? colors.secondary : isDark ? colors.grey3 : colors.grey2,
        opacity: disabled ? 0.4 : 1,
      }}
      transition={TICK_TRANSITION}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <MotiView
        animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : 0.8 }}
        transition={TICK_TRANSITION}>
        <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 24 24" fill="none">
          <Path
            d={CHECK_PATH}
            stroke="#FFFFFF"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </MotiView>
    </MotiView>
  );
};

export type CheckboxProps = Omit<PressableProps, 'onChange'> & {
  onChange: (checked: boolean) => void;
  checked: boolean;
  hitSlop?: number;
  id?: string;
  disabled?: boolean;
  size?: number;
};

export const Checkbox = ({
  checked,
  onChange,
  hitSlop = 14,
  disabled,
  size,
  ...rest
}: CheckboxProps) => {
  const handleChange = useCallback(() => {
    onChange(!checked);
  }, [onChange, checked]);
  const isDark = useIsDarkMode();

  const { onHoverIn, onHoverOut } = useOnHover();
  const { onFocus, onBlur, focused } = useOnFocus();

  const focusStyle = useAnimatedStyle(
    () => ({
      boxShadow: focused.value
        ? isDark
          ? '0px 0px 0px 3px rgba(106, 153, 78, 0.35)'
          : '0px 0px 0px 3px rgba(106, 153, 78, 0.25)'
        : undefined,
    }),
    [focused, isDark]
  );

  return (
    <Pressable
      onPress={handleChange}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      onFocus={onFocus}
      onBlur={onBlur}
      role="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      hitSlop={hitSlop}
      //@ts-expect-error - web only - checkbox toggle on spacebar press
      onKeyDown={Platform.select({
        web: (e: any) => {
          if (e.code === 'Space') handleChange();
        },
        default: undefined,
      })}
      {...rest}>
      <Animated.View style={[{ borderRadius: 8 }, focusStyle]}>
        <CheckboxIndicator checked={checked} disabled={disabled} size={size} />
      </Animated.View>
    </Pressable>
  );
};
