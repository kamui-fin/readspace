import { Stepper, type StepperRef } from '@components/navigation/stepper';
import { CategorySelectionStep } from '@components/screens/onboarding/categories';
import { FeedSelectionStep } from '@components/screens/onboarding/feeds';
import { useSession } from '@contexts/auth-context';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { ApiClient } from '@readspace/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';

export default function OnboardingScreen() {
  const stepperRef = useRef<StepperRef>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const { setIsOnboarded } = useSession();
  const router = useRouter();

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

  const handleSkip = async () => {
    try {
      await ApiClient.patch('/api/users/profile', { is_onboarded: true });
    } catch (e) {
      console.warn('[Onboarding] Failed to mark user as onboarded on skip:', e);
    }
    setIsOnboarded(true);
    router.replace('/(protected)/(tabs)');
  };

  const pages = [
    <CategorySelectionStep
      key="categories"
      onNext={() => stepperRef.current?.goToNext()}
      onSkip={handleSkip}
    />,
    <FeedSelectionStep key="feeds" onNext={() => {}} onSkip={handleSkip} />,
  ];

  return (
    <View className="bg-screen flex-1" style={{ backgroundColor: colors.background }}>
      <Stepper ref={stepperRef} pages={pages} onStepChange={setCurrentStep} initialStep={0} />
    </View>
  );
}
