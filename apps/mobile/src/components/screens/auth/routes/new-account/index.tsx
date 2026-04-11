import { SelfHostSettingsBottomSheet } from '@components/bottom-sheets/self-hosted-settings.bottom-sheet';
import { Stepper, type StepperRef } from '@components/navigation/stepper';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useSession } from '@contexts/auth-context';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useAuthErrorHandler } from '@hooks/useAuthErrorHandler';
import { BUTTON_BORDER_RADIUS, SPACING } from '@lib/constants/app';
import { EmailSchema, PasswordSchema } from '@lib/validation/auth-schemas';
import { useSettingsStore } from '@stores/settings';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmailStep } from '@/components/screens/auth/routes/new-account/email';
import { PasswordStep } from '@/components/screens/auth/routes/new-account/password';
// import { VerificationStep } from '@/components/screens/auth/routes/new-account/verification';

export function SignupScreen() {
  const stepperRef = useRef<StepperRef>(null);
  const selfHostSettingsRef = useRef<BottomSheetModal>(null);
  const { signUp } = useSession();
  const { setSelfHosted } = useSettingsStore();
  const insets = useSafeAreaInsets();
  const { handleAuthError } = useAuthErrorHandler();

  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const buttonBottomAnim = useRef(new Animated.Value(0)).current;

  // Track keyboard height and animate button position
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      Animated.timing(buttonBottomAnim, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    const hideSubscription = Keyboard.addListener('keyboardWillHide', (e) => {
      setKeyboardHeight(0);
      Animated.timing(buttonBottomAnim, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [buttonBottomAnim]);

  const handleSelfHostSave = (data: {
    apiUrl: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
  }) => {
    setSelfHosted(data);
    toast.success('Self-hosted instance configured');
  };

  const pages = [
    <EmailStep
      key="email"
      initialEmail={email}
      onEmailChange={setEmail}
      selfHostSettingsRef={selfHostSettingsRef}
    />,
    <PasswordStep key="password" initialPassword={password} onPasswordChange={setPassword} />,
    // <VerificationStep key="verification" email={email} />,
  ];

  const isValid = () => {
    if (currentStep === 0) return EmailSchema.safeParse({ email }).success;
    if (currentStep === 1) return PasswordSchema.safeParse({ password }).success;
    return true;
  };

  const validateCurrentStep = () => {
    try {
      switch (currentStep) {
        case 0: // Email
          EmailSchema.parse({ email });
          return true;
        case 1: // Password
          PasswordSchema.parse({ password });
          return true;
        case 2: // Verification (no validation needed)
          return true;
        default:
          return false;
      }
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

  const handleNext = async () => {
    // Validation
    if (!validateCurrentStep()) {
      return;
    }

    if (currentStep === 1) {
      // Last step before verification - create account
      setIsLoading(true);
      try {
        await signUp({ email: email.trim(), password });
        // toast.success('Verification email sent! Check your inbox.');
        // Move to verification screen
        stepperRef.current?.goToNext();
      } catch (error) {
        handleAuthError(error, 'signup');
      } finally {
        setIsLoading(false);
      }
    } else if (currentStep < pages.length - 1) {
      // Move to next step
      stepperRef.current?.goToNext();
    }
    // On verification screen (step 2), do nothing - user must click email link
    // Auth provider will handle the redirect once they verify
  };

  const handleBack = () => {
    if (currentStep > 0 && currentStep < pages.length - 1) {
      stepperRef.current?.goToPrevious();
    } else {
      router.back();
    }
  };

  const getButtonText = () => {
    if (currentStep === 1) return 'Create Account';
    return 'Continue';
  };

  const buttonText = getButtonText();

  return (
    <View className="flex-1 bg-screen">
      <Stepper ref={stepperRef} pages={pages} onStepChange={setCurrentStep} initialStep={0} />

      {/* Fixed Buttons at Bottom - Hide on verification screen - Adjusts for keyboard with smooth animation */}
      {currentStep < pages.length && (
        <Animated.View
          className="absolute left-0 right-0"
          style={{
            bottom: buttonBottomAnim,
            paddingHorizontal: Math.max(
              Math.min(SPACING.ONBOARDING_CONTENT_PADDING * (393 / 393), 36),
              20
            ),
            paddingBottom: keyboardHeight > 0 ? 20 : Math.max(insets.bottom + 20, 40),
            backgroundColor: 'transparent',
          }}
          pointerEvents="box-none">
          <View className="gap-3">
            {/* Main Action Button */}
            {buttonText && (
              <Button
                variant="primary"
                size="large"
                onPress={handleNext}
                disabled={!isValid() || isLoading}
                loading={isLoading}
                style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
                {buttonText}
              </Button>
            )}

            {/* Back Button or Sign In Link - Hide sign in link when keyboard is visible */}
            {currentStep === 0 && (
              keyboardHeight === 0 && (
                <View className="flex-row items-center justify-center gap-1 py-3">
                  <Text size="base" fontFamily="geist" className="text-grey dark:text-grey">
                    Already have an account?
                  </Text>
                  <Pressable onPress={() => router.replace('/(auth)/login')} disabled={isLoading}>
                    <Text
                      size="base"
                      fontFamily="geist-semibold"
                      className="text-primary dark:text-primary">
                      Sign in
                    </Text>
                  </Pressable>
                </View>
              )
            )}
          </View>
        </Animated.View>
      )}

      {/* Self-hosting modal/bottom sheet - rendered at screen level */}
      <SelfHostSettingsBottomSheet ref={selfHostSettingsRef} onSave={handleSelfHostSave} />
    </View>
  );
}
