import { Stepper, type StepperRef } from '@components/navigation/stepper';
import { CategorySelectionStep } from '@components/screens/onboarding/categories';
import { FeedSelectionStep } from '@components/screens/onboarding/feeds';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { useRef, useState } from 'react';
import { View } from 'react-native';

export default function OnboardingScreen() {
  const stepperRef = useRef<StepperRef>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

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
