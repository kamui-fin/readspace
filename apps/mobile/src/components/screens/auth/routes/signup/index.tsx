import { SelfHostSettingsBottomSheet } from '@components/bottom-sheets/self-hosted-settings.bottom-sheet';
import { SelfHostSettings } from '@components/modals/self-hosted-settings.modal';
import { Stepper, type StepperRef } from '@components/navigation/stepper';
import { EmailStep } from '@components/screens/auth/routes/email';
import { PasswordStep } from '@components/screens/auth/routes/password';
import { VerificationStep } from '@components/screens/auth/routes/verification';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useSession } from '@contexts/auth-context';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BUTTON_BORDER_RADIUS, SPACING } from '@lib/constants/app';
import { EmailSchema, PasswordSchema } from '@lib/validation/auth-schemas';
import { useSettingsStore } from '@stores/settings';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isIOS = Platform.OS === 'ios';

export function SignupScreen() {
  const stepperRef = useRef<StepperRef>(null);
  const selfHostSettingsRef = useRef<BottomSheetModal>(null);
  const { signUp } = useSession();
  const { setSelfHosted } = useSettingsStore();
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Track keyboard height to keep buttons above keyboard
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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
    <VerificationStep key="verification" email={email} />,
  ];

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
        toast.success('Verification email sent! Check your inbox.');
        // Move to verification screen
        stepperRef.current?.goToNext();
      } catch (error) {
        console.error('Sign up error:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to create account');
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
    if (currentStep === pages.length - 1) return null; // No button on verification screen
    if (currentStep === 1) return 'Create Account';
    return 'Continue';
  };

  const buttonText = getButtonText();

  return (
    <View className="dark:bg-screen_background flex-1 bg-background">
      <Stepper ref={stepperRef} pages={pages} onStepChange={setCurrentStep} initialStep={0} />

      {/* Fixed Buttons at Bottom - Hide on verification screen - Adjusts for keyboard */}
      {currentStep < pages.length - 1 && (
        <View
          className="dark:bg-screen_background absolute left-0 right-0 bg-background"
          style={{
            bottom: keyboardHeight > 0 ? keyboardHeight : 0,
            paddingHorizontal: Math.max(
              Math.min(SPACING.ONBOARDING_CONTENT_PADDING * (393 / 393), 36),
              20
            ),
            paddingBottom: keyboardHeight > 0 ? 20 : Math.max(insets.bottom + 20, 40),
          }}
          pointerEvents="box-none">
          <View className="gap-3">
            {/* Main Action Button */}
            {buttonText && (
              <Button
                variant="primary"
                size="large"
                onPress={handleNext}
                loading={isLoading}
                style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
                {buttonText}
              </Button>
            )}

            {/* Back Button or Sign In Link */}
            {currentStep > 0 ? (
              <Button
                variant="secondary"
                size="large"
                onPress={handleBack}
                disabled={isLoading}
                style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
                Back
              </Button>
            ) : (
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
            )}
          </View>
        </View>
      )}

      {/* Self-hosting modal/bottom sheet - rendered at screen level */}
      {isIOS ? (
        <SelfHostSettings ref={selfHostSettingsRef} onSave={handleSelfHostSave} />
      ) : (
        <SelfHostSettingsBottomSheet ref={selfHostSettingsRef} onSave={handleSelfHostSave} />
      )}
    </View>
  );
}
