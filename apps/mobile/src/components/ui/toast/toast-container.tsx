import CheckCircleIcon from '@components/icons/local/check-circle';
import CloseCircleIcon from '@components/icons/local/close-circle';
import { COLORS } from '@lib/constants/colors';
import { useCallback, useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

export type ToastType = 'success' | 'error';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  duration?: number;
  from?: 'top' | 'bottom';
}

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export const ToastItem = ({ toast, onDismiss }: ToastItemProps) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(toast.from === 'top' ? -100 : 100);
  const opacity = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  const duration = toast.duration || 3000;

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
  }, [toast.from, toast.id, onDismiss, translateY, opacity]);

  useEffect(() => {
    // Entry animation - smooth fade in without bounce
    translateY.value = withTiming(0, { duration: 300 });
    opacity.value = withTiming(1, { duration: 300 });

    // Cascade animation for icon and text
    iconOpacity.value = withDelay(100, withTiming(1, { duration: 400 }));
    textOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));

    // Auto dismiss
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, translateY, opacity, handleDismiss, iconOpacity, textOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconOpacity.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateX: (1 - textOpacity.value) * -10 }],
  }));

  const getBackgroundColor = () => {
    if (toast.type === 'success') {
      // Light shade of secondary green
      return 'rgba(106, 153, 78, 0.1)'; // secondary at 10% opacity
    }
    // Light shade of red
    return 'rgba(234, 67, 53, 0.1)'; // red at 10% opacity
  };

  const getTextColor = () => {
    if (toast.type === 'success') {
      return COLORS.light.secondary;
    }
    return COLORS.light.red;
  };

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          alignSelf: 'center',
          ...(toast.from === 'top' ? { top: insets.top + 16 } : { bottom: insets.bottom + 8 }),
          zIndex: 9999,
        },
        containerStyle,
      ]}>
      <Pressable onPress={handleDismiss}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: getBackgroundColor(),
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 5,
          }}>
          <Animated.View style={[{ marginRight: 12 }, iconAnimatedStyle]}>
            {toast.type === 'success' ? (
              <CheckCircleIcon width={24} height={24} fill={COLORS.light.secondary} />
            ) : (
              <CloseCircleIcon width={24} height={24} fill={COLORS.light.red} />
            )}
          </Animated.View>

          <Animated.View style={textAnimatedStyle}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: getTextColor(),
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
