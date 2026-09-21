import { BackButton } from '@components/ui/back-button';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BACK_BUTTON_SIZE } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import type React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StepperProps {
  pages: React.ReactNode[];
  onStepChange?: (currentStep: number) => void;
  initialStep?: number;
  onFirstStepBack?: () => void;
  renderHeaderRight?: () => React.ReactNode;
}

export interface StepperRef {
  goToNext: () => void;
  goToPrevious: () => void;
  goToStep: (step: number) => void;
  getCurrentStep: () => number;
}

export const Stepper = forwardRef<StepperRef, StepperProps>(
  ({ pages, onStepChange, initialStep = 0, onFirstStepBack, renderHeaderRight }, ref) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const stepperHorizontalPadding = 20;
    const [current, setCurrent] = useState(initialStep);
    const animatedCurrent = useRef(new Animated.Value(initialStep)).current;

    const goToNext = () => {
      if (current < pages.length - 1) {
        setCurrent(current + 1);
      }
    };

    const goToPrevious = () => {
      if (current > 0) {
        setCurrent(current - 1);
      }
    };

    const goToStep = (step: number) => {
      if (step >= 0 && step < pages.length) {
        setCurrent(step);
      }
    };

    // Expose methods to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        goToNext,
        goToPrevious,
        goToStep,
        getCurrentStep: () => current,
      }),
      [current, pages.length]
    );

    // Update animated value when current changes with transitions
    useEffect(() => {
      Animated.timing(animatedCurrent, {
        toValue: current,
        duration: 250,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        useNativeDriver: true,
      }).start();
    }, [current, animatedCurrent]);

    // Notify parent of step changes
    useEffect(() => {
      if (onStepChange) {
        onStepChange(current);
      }
    }, [current, onStepChange]);

    return (
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="bg-screen flex-1" style={{ backgroundColor: colors.background }}>
          {/* Keep the whole header row below the system UI, including its controls. */}
          <View
            style={{
              paddingTop: insets.top + 12,
              paddingLeft: Math.max(insets.left, stepperHorizontalPadding),
              paddingRight: Math.max(insets.right, stepperHorizontalPadding),
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: BACK_BUTTON_SIZE, minHeight: BACK_BUTTON_SIZE }}>
                {(current > 0 || onFirstStepBack) && (
                  <BackButton
                    color={colors.primary_foreground}
                    onPress={() => {
                      if (current > 0) {
                        goToPrevious();
                      } else {
                        onFirstStepBack?.();
                      }
                    }}
                  />
                )}
              </View>
              <View style={{ flex: 1 }} />
              <View
                style={{
                  minWidth: BACK_BUTTON_SIZE,
                  minHeight: BACK_BUTTON_SIZE,
                  justifyContent: 'center',
                }}>
                {renderHeaderRight?.()}
              </View>
            </View>
          </View>

          {/* Pages Container with Horizontal Slide */}
          <View className="pt-22 flex-1 overflow-hidden">
            <Animated.View
              style={{
                flexDirection: 'row',
                width: width * pages.length,
                flex: 1,
                transform: [
                  {
                    translateX: animatedCurrent.interpolate({
                      inputRange: pages.map((_, i) => i),
                      outputRange: pages.map((_, i) => -i * width),
                    }),
                  },
                ],
              }}>
              {pages.map((page, index) => (
                <View key={`page-${index}`} style={{ width, flex: 1 }}>
                  {page}
                </View>
              ))}
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }
);

Stepper.displayName = 'Stepper';
