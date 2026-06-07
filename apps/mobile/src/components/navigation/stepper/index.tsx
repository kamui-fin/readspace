import ArrowLeftLinearIcon from '@components/icons/solar/arrow-left-linear';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { PAGE_INDICATOR, SPACING } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import type React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageIndicator } from '../page-indicator';

interface StepperProps {
  pages: React.ReactNode[];
  onStepChange?: (currentStep: number) => void;
  initialStep?: number;
  onFirstStepBack?: () => void;
}

export interface StepperRef {
  goToNext: () => void;
  goToPrevious: () => void;
  goToStep: (step: number) => void;
  getCurrentStep: () => number;
}

export const Stepper = forwardRef<StepperRef, StepperProps>(
  ({ pages, onStepChange, initialStep = 0, onFirstStepBack }, ref) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const indicatorSize = PAGE_INDICATOR.BASE_SIZE;
    const stepperHorizontalPadding = 20;
    const indicatorWidth = width - stepperHorizontalPadding * 2;
    const dashSize = PAGE_INDICATOR.getDashSize(indicatorWidth, pages.length, indicatorSize);
    const [current, setCurrent] = useState(initialStep);
    const animatedCurrent = useRef(new Animated.Value(initialStep)).current;

    const topPadding = SPACING.getOnboardingTopPadding(height) * 0.7;

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
          {/* Page Indicator and Back Button */}
          <View
            style={{
              paddingHorizontal: stepperHorizontalPadding,
              paddingTop: 1.2 * insets.top,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {(current > 0 || onFirstStepBack) && (
              <TouchableOpacity
                onPress={() => {
                  if (current > 0) {
                    goToPrevious();
                  } else if (onFirstStepBack) {
                    onFirstStepBack();
                  }
                }}
                style={{
                  position: 'absolute',
                  left: stepperHorizontalPadding,
                  padding: 8,
                  zIndex: 10,
                }}
                activeOpacity={0.7}>
                <ArrowLeftLinearIcon
                  width={24}
                  height={24}
                  strokeWidth={2.4}
                  color={colors.primary_foreground}
                />
              </TouchableOpacity>
            )}
            <PageIndicator
              gap={8}
              color={colors.grey4}
              activeColor={colors.primary}
              size={indicatorSize}
              dashSize={dashSize}
              count={pages.length}
              current={animatedCurrent}
            />
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
