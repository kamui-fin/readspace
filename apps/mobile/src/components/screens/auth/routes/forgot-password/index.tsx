import { Stepper, type StepperRef } from '@components/navigation/stepper';
import { Button } from '@components/ui/button';
import { toast } from '@components/ui/toast';
import { useSession } from '@contexts/auth-context';
import { useAuthErrorHandler } from '@hooks/useAuthErrorHandler';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BUTTON_BORDER_RADIUS, SPACING } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { EmailSchema } from '@lib/validation/auth-schemas';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ForgotPasswordEmailStep } from '@/components/screens/auth/routes/forgot-password/email';
import { ForgotPasswordVerificationStep } from '@/components/screens/auth/routes/forgot-password/verification';
import { NewPasswordStep } from '@/components/screens/auth/routes/forgot-password/new-password';

export function ForgotPasswordScreen() {
  const stepperRef = useRef<StepperRef>(null);
  const { sendPasswordReset } = useSession();
  const { handleAuthError } = useAuthErrorHandler();
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const onBackPress = () => {
        handleBack();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [currentStep])
  );

  const validateEmail = () => {
    try {
      EmailSchema.parse({ email });
      return true;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errors' in error) {
        const zodError = error as { errors: { message: string }[] };
        if (zodError.errors?.[0]?.message) {
          toast.error(zodError.errors[0].message);
        }
      }
      return false;
    }
  };

  const isEmailValid = () => EmailSchema.safeParse({ email }).success;

  const handleNext = async () => {
    if (currentStep === 0) {
      if (!validateEmail()) return;

      setIsLoading(true);
      try {
        await sendPasswordReset(email.trim());
        toast.success('Reset code sent! Check your inbox.');
        stepperRef.current?.goToNext();
      } catch (error) {
        handleAuthError(error, 'signin');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleVerified = () => {
    stepperRef.current?.goToNext();
  };

  const handleBack = () => {
    if (currentStep > 0 && currentStep < 2) {
      stepperRef.current?.goToPrevious();
    } else {
      router.back();
    }
  };

  const pages = [
    <ForgotPasswordEmailStep
      key="email"
      initialEmail={email}
      onEmailChange={setEmail}
    />,
    <ForgotPasswordVerificationStep
      key="verification"
      email={email}
      onVerified={handleVerified}
    />,
    <NewPasswordStep key="new-password" />,
  ];

  const showBottomButton = currentStep === 0;

  return (
    <View className="bg-screen flex-1" style={{ backgroundColor: colors.background }}>
      <Stepper
        ref={stepperRef}
        pages={pages}
        onStepChange={setCurrentStep}
        initialStep={0}
        onFirstStepBack={handleBack}
        headerPaddingTop={Math.max(insets.top + 60, 80)}
      />

      {showBottomButton && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
          }}
          pointerEvents="box-none">
          <View
            className="gap-3"
            style={{
              paddingHorizontal: Math.max(
                Math.min(SPACING.ONBOARDING_CONTENT_PADDING * (393 / 393), 36),
                20
              ),
              paddingBottom: isKeyboardVisible ? 20 : Math.max(insets.bottom + 20, 40),
              backgroundColor: 'transparent',
            }}
            pointerEvents="box-none">
            <Button
              variant="primary"
              size="large"
              onPress={handleNext}
              disabled={!isEmailValid() || isLoading}
              loading={isLoading}
              style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
              Send reset code
            </Button>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
