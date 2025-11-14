import { useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { scheduleOnRN } from 'react-native-worklets';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSegments } from 'expo-router';

import { CircleCheckIcon } from '@components/icons/circle-check';
import { CircleErrorIcon } from '@components/icons/circle-error';
import { CircleInfoIcon } from '@components/icons/circle-info';
import { Spinner } from '@components/ui/spinner';
import { COLORS } from '@lib/constants/colors';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';

export type ToastType = 'success' | 'error' | 'promise' | 'info' | 'custom';

export interface CustomToastConfig {
  icon?: React.ReactNode;
  iconColor?: string;
  textColor?: string;
  backgroundColor?: string;
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

  const getBackgroundColor = () => {
    if (toast.type === 'custom' && toast.custom?.backgroundColor) {
      return toast.custom.backgroundColor;
    }
    if (toast.type === 'success') {
      // Lighter solid shade of secondary green
      return 'rgb(235, 244, 230)'; // Even lighter green
    }
    if (toast.type === 'promise') {
      // Lighter solid shade of blue
      return 'rgb(237, 244, 254)'; // Even lighter blue
    }
    if (toast.type === 'info') {
      // Lighter solid shade of orange
      return 'rgb(255, 245, 230)'; // Even lighter orange
    }
    // Lighter solid shade of red
    return 'rgb(254, 243, 242)'; // Even lighter red
  };

  const getTextColor = () => {
    if (toast.type === 'custom' && toast.custom?.textColor) {
      return toast.custom.textColor;
    }
    if (toast.type === 'success') {
      return COLORS.light.secondary;
    }
    if (toast.type === 'promise') {
      return COLORS.light.blue;
    }
    if (toast.type === 'info') {
      return COLORS.light.orange;
    }
    return COLORS.light.red;
  };

  const renderIcon = () => {
    if (toast.type === 'custom' && toast.custom?.icon) {
      return toast.custom.icon;
    }
    if (toast.type === 'success') {
      return <CircleCheckIcon size={20} color={COLORS.light.secondary} />;
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
          <Spinner size="small" color={COLORS.light.blue} secondaryColor="rgb(190, 213, 252)" />
        </View>
      );
    }
    if (toast.type === 'info') {
      return <CircleInfoIcon size={20} color={COLORS.light.orange} />;
    }
    return <CircleErrorIcon size={20} color={COLORS.light.red} />;
  };

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          alignSelf: 'center',
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
          className="flex-row items-center rounded-full py-[10px] pl-4 pr-[18px] shadow-none"
          style={{
            backgroundColor: getBackgroundColor(),
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 5,
          }}>
          <Animated.View className="mr-1" style={iconAnimatedStyle}>
            {renderIcon()}
          </Animated.View>

          <Animated.View style={textAnimatedStyle}>
            <Text
              className="text-[15px] font-semibold leading-5"
              style={{ color: getTextColor() }}
              numberOfLines={2}>
              {toast.title}
            </Text>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
};
