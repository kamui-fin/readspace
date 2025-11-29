import { Platform } from 'react-native';
import { useKeyboardHandler as useRNKeyboardHandler } from 'react-native-keyboard-controller';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

/**
 * A comprehensive hook for handling keyboard interactions.
 * Provides shared values for keyboard height, visibility, and progress.
 * Optimized for performance using Reanimated worklets.
 */
export function useKeyboardHandler() {
  const height = useSharedValue(0);
  const progress = useSharedValue(0);
  const duration = useSharedValue(250);
  const isVisible = useDerivedValue(() => {
    return height.value > 0;
  });

  useRNKeyboardHandler(
    {
      onStart: (e) => {
        'worklet';
        // On iOS, we want to animate with the keyboard
        if (Platform.OS === 'ios') {
          height.value = e.height;
          progress.value = e.progress;
          duration.value = e.duration;
        } else {
          // On Android, we might want to animate immediately or let the OS handle it (adjustResize)
          // For manual handling:
          height.value = withTiming(e.height, {
            duration: e.duration,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          });
        }
      },
      onMove: (e) => {
        'worklet';
        if (Platform.OS === 'ios') {
          height.value = e.height;
          progress.value = e.progress;
        }
      },
      onEnd: (e) => {
        'worklet';
        if (Platform.OS === 'ios') {
          height.value = e.height;
          progress.value = e.progress;
        } else {
           height.value = e.height;
        }
      },
    },
    []
  );

  return {
    height,
    progress,
    duration,
    isVisible,
  };
}

