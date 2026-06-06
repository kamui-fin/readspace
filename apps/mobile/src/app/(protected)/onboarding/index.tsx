import { Stepper, type StepperRef } from '@components/navigation/stepper';
import { CategorySelectionStep } from '@components/screens/onboarding/categories';
import { FeedSelectionStep } from '@components/screens/onboarding/feeds';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';

export default function OnboardingScreen() {
  const stepperRef = useRef<StepperRef>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  // Handle hardware back button on Android
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const onBackPress = () => {
        if (currentStep > 0) {
          stepperRef.current?.goToPrevious();
          return true; // Intercept & go back in stepper
        }
        return false; // Let default back handle (exit app)
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [currentStep])
  );

  const pages = [
    <CategorySelectionStep key="categories" onNext={() => stepperRef.current?.goToNext()} />,
    <FeedSelectionStep key="feeds" onNext={() => {}} />,
  ];

  return (
    <View className="bg-screen flex-1" style={{ backgroundColor: colors.background }}>
      <Stepper ref={stepperRef} pages={pages} onStepChange={setCurrentStep} initialStep={0} />
    </View>
  );
}
