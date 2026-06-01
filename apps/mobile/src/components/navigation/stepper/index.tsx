import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { PAGE_INDICATOR, SPACING } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import type React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageIndicator } from '../page-indicator';

interface StepperProps {
  pages: React.ReactNode[];
  onStepChange?: (currentStep: number) => void;
  initialStep?: number;
}

export interface StepperRef {
  goToNext: () => void;
  goToPrevious: () => void;
  goToStep: (step: number) => void;
  getCurrentStep: () => number;
}

export const Stepper = forwardRef<StepperRef, StepperProps>(
  ({ pages, onStepChange, initialStep = 0 }, ref) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const indicatorSize = PAGE_INDICATOR.BASE_SIZE;
    const stepperHorizontalPadding = 20;
    const indicatorWidth = width - stepperHorizontalPadding * 2;
    const dashSize = PAGE_INDICATOR.getDashSize(indicatorWidth, pages.length, indicatorSize);
    const [current, setCurrent] = useState(initialStep);
    const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
    const animatedCurrent = useRef(new Animated.Value(initialStep)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const topPadding = SPACING.getOnboardingTopPadding(height) * 0.7;

    // Expose methods to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        goToNext: () => {
          if (current < pages.length - 1) {
            setDirection('forward');
            setCurrent(current + 1);
          }
        },
        goToPrevious: () => {
          if (current > 0) {
            setDirection('backward');
            setCurrent(current - 1);
          }
        },
        goToStep: (step: number) => {
          if (step >= 0 && step < pages.length) {
            setDirection(step > current ? 'forward' : 'backward');
            setCurrent(step);
          }
        },
        getCurrentStep: () => current,
      }),
      [current, pages.length]
    );

    // Update animated value when current changes with transitions
    useEffect(() => {
      // Reset animations for the new page
      const startOffset = direction === 'forward' ? width : -width;
      slideAnim.setValue(startOffset);
      fadeAnim.setValue(0);

      // Animate page indicator
      Animated.timing(animatedCurrent, {
        toValue: current,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Animate page transition
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, [current, animatedCurrent, slideAnim, fadeAnim, direction, width]);

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
        <View className="bg-screen flex-1">
          {/* Page Indicator */}
          <View
            style={{
              paddingHorizontal: stepperHorizontalPadding,
              paddingTop: 1.2 * insets.top,
            }}>
            <PageIndicator
              gap={0}
              color={colors.grey4}
              activeColor={colors.primary}
              size={indicatorSize}
              dashSize={dashSize}
              count={pages.length}
              current={animatedCurrent}
            />
          </View>

          {/* Current Page with Transition */}
          <View className="pt-22 flex-1">
            <Animated.View
              className="relative flex-1"
              style={{
                width,
                transform: [{ translateX: slideAnim }],
                opacity: fadeAnim,
              }}>
              {pages[current]}
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }
);

Stepper.displayName = 'Stepper';
