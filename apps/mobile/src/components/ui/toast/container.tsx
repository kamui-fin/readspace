import { Spinner } from '@components/ui/spinner';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { CheckCircleIcon, CloseCircleIcon, InfoCircleIcon } from '@solar-icons/react-native/bold';
import { useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { getToastBackgroundColor, getToastBorderColor, getToastTextColor } from './utils';

export type ToastType = 'success' | 'error' | 'promise' | 'info' | 'custom';

export interface CustomToastConfig {
  icon?: React.ReactNode;
  iconColor?: string;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
}

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  duration?: number;
  from?: 'top' | 'bottom';
  custom?: CustomToastConfig;
}

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export const ToastItem = ({ toast, onDismiss }: ToastItemProps) => {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const translateY = useSharedValue(toast.from === 'top' ? -100 : 100);
  const opacity = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const iconShakeX = useSharedValue(0);
  const previousTypeRef = useRef(toast.type);

  const duration = toast.duration || 3000;
  const isFirstRenderRef = useRef(true);

  // Detect if we're in a tab route (tab bar is visible)
  // Check if segments[1] === "(tabs)" to determine if tab bar is shown
  const isInTabRoute = useMemo(() => {
    // segments structure: ["(protected)", "(tabs)", "index"] for tab routes
    // segments structure: ["(protected)", "articles", "id"] for non-tab routes
    if (segments.length < 2) {
      return false;
    }
    // TypeScript needs explicit array access after length check
    const segmentsArray = segments as string[];
    return segmentsArray[1] === '(tabs)';
  }, [segments]);

  // Calculate bottom offset based on whether tab bar is visible
  const bottomOffset = useMemo(() => {
    if (toast.from === 'top') {
      return undefined;
    }

    if (isInTabRoute) {
      // Tab bar is visible: position above tab bar
      return BOTTOM_TABBAR_BASE_HEIGHT + 32;
    }

    // No tab bar: position above bottom inset with small padding
    return insets.bottom + 16;
  }, [isInTabRoute, insets.bottom, toast.from]);

  const handleDismiss = useCallback(() => {
    translateY.value = withTiming(
      toast.from === 'top' ? -100 : 100,
      { duration: 250 },
      (finished) => {
        if (finished) {
          scheduleOnRN(onDismiss, toast.id);
        }
      }
    );
    opacity.value = withTiming(0, { duration: 250 });
    // SharedValues are stable references - adding them to dependencies won't cause re-renders
  }, [toast.from, onDismiss, toast.id, translateY, opacity]);

  useEffect(() => {
    // Entry animation - smooth fade in without bounce (only on mount)
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      translateY.value = withTiming(0, { duration: 300 });
      opacity.value = withTiming(1, { duration: 300 });

      // Cascade animation for icon and text
      iconOpacity.value = withDelay(100, withTiming(1, { duration: 400 }));
      textOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    } else if (previousTypeRef.current === 'promise' && toast.type !== 'promise') {
      // Transition animation when promise resolves to success/error
      iconOpacity.value = 0;
      textOpacity.value = 0;

      // Fade in icon and text with cascade
      iconOpacity.value = withDelay(50, withTiming(1, { duration: 300 }));
      textOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    }

    // Update the previous type
    previousTypeRef.current = toast.type;

    // Shake animation for error icon (with delay for transition)
    if (toast.type === 'error') {
      const shakeDelay = previousTypeRef.current === 'promise' ? 200 : 150;
      iconShakeX.value = withDelay(
        shakeDelay,
        withTiming(4, { duration: 70 }, () => {
          iconShakeX.value = withTiming(-4, { duration: 70 }, () => {
            iconShakeX.value = withTiming(3, { duration: 60 }, () => {
              iconShakeX.value = withTiming(-3, { duration: 60 }, () => {
                iconShakeX.value = withTiming(2, { duration: 50 }, () => {
                  iconShakeX.value = withTiming(0, { duration: 50 });
                });
              });
            });
          });
        })
      );
    }

    // Auto dismiss - restart timer when toast updates
    if (duration < 999999) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
    // SharedValues are stable references - adding them to dependencies won't cause re-renders
  }, [
    toast.type,
    duration,
    handleDismiss,
    translateY,
    opacity,
    iconOpacity,
    textOpacity,
    iconShakeX,
  ]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconOpacity.value }, { translateX: iconShakeX.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateX: (1 - textOpacity.value) * -10 }],
  }));

  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const renderIcon = () => {
    if (toast.type === 'custom' && toast.custom?.icon) {
      return toast.custom.icon;
    }
    if (toast.type === 'success') {
      return <CheckCircleIcon size={20} color={colors.secondary} />;
    }
    if (toast.type === 'promise') {
      return (
        <View
          style={{
            width: 20,
            height: 20,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: 0.65 }],
          }}>
          <Spinner
            size="small"
            color={colors.secondary}
            secondaryColor={isDark ? 'rgba(106, 153, 78, 0.3)' : 'rgba(106, 153, 78, 0.15)'}
          />
        </View>
      );
    }
    if (toast.type === 'info') {
      return <InfoCircleIcon size={20} color={colors.orange} />;
    }
    return <CloseCircleIcon size={20} color={colors.red} />;
  };

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          alignSelf: 'center',
          maxWidth: '85%',
          marginHorizontal: 16,
          ...(toast.from === 'top'
            ? { top: insets.top + 16 }
            : {
                bottom: bottomOffset,
              }),
          zIndex: 9999,
        },
        containerStyle,
      ]}>
      <Pressable onPress={handleDismiss}>
        <View
          className="flex-row items-center rounded-full py-[10px] pl-4 pr-[18px]"
          style={{
            backgroundColor: getToastBackgroundColor(toast.type, colors, toast.custom),
            borderWidth: 1,
            borderColor: getToastBorderColor(toast.type, colors, toast.custom),
            shadowColor: isDark ? '#000' : '#8A9A9D',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.35 : 0.08,
            shadowRadius: 12,
            elevation: 3,
          }}>
          <Animated.View className="mr-1 flex-shrink-0" style={iconAnimatedStyle}>
            {renderIcon()}
          </Animated.View>

          <Animated.View style={[{ flexShrink: 1 }, textAnimatedStyle]}>
            <Text
              className="text-[14px]"
              style={{
                color: getToastTextColor(toast.type, colors, toast.custom),
                fontFamily: 'Geist_500Medium',
              }}
              numberOfLines={2}>
              {toast.title}
            </Text>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
};
