import { SelfHostSettingsBottomSheet } from '@components/bottom-sheets/self-hosted-settings.bottom-sheet';
import { Button } from '@components/ui/button';
import { Input, InputPressable } from '@components/ui/input';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useSession } from '@contexts/auth-context';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useAuthErrorHandler } from '@hooks/useAuthErrorHandler';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { supabase } from '@lib/supabase/client';
import { type LoginFormData, LoginSchema } from '@lib/validation/auth-schemas';
import { EyeClosedIcon, EyeIcon } from '@solar-icons/react-native/bold';
import { useSettingsStore } from '@stores/settings';
import { type Href, router } from 'expo-router';
import { Formik, type FormikHelpers } from 'formik';
import { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toFormikValidationSchema } from 'zod-formik-adapter';

export function LoginScreen() {
  const { signIn } = useSession();
  const insets = useSafeAreaInsets();
  const selfHostSettingsRef = useRef<BottomSheetModal>(null);
  const { settings, setSelfHosted, resetToCloud } = useSettingsStore();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const [showPassword, setShowPassword] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { handleAuthError } = useAuthErrorHandler();

  const isSelfHosted = settings.instance_type === 'self-hosted';

  const initialValues: LoginFormData = {
    email: '',
    password: '',
  };

  const handleSubmit = async (
    values: LoginFormData,
    { setSubmitting }: FormikHelpers<LoginFormData>
  ) => {
    console.log('[Login] 🚀 Submission started for email:', values.email.trim());
    setIsLoading(true);
    try {
      console.log('[Login] 🔑 Calling signIn context method...');
      await signIn({ email: values.email.trim(), password: values.password });
      console.log('[Login] 🎉 signIn resolved successfully');
      // Auth provider will handle redirect to protected routes automatically
    } catch (error: unknown) {
      console.log('[Login] ❌ Caught sign-in error:', error);
      const err = error as { code?: string; message?: string };
      const isEmailNotConfirmed =
        err?.code === 'email_not_confirmed' ||
        err?.message?.toLowerCase().includes('confirm') ||
        err?.message?.toLowerCase().includes('verified') ||
        err?.message?.toLowerCase().includes('verification');

      console.log('[Login] 🔍 isEmailNotConfirmed check:', isEmailNotConfirmed);

      if (isEmailNotConfirmed) {
        try {
          console.log('[Login] 📩 Triggering verification resend for:', values.email.trim());
          // Trigger resending the verification code
          await supabase.auth.resend({
            type: 'signup',
            email: values.email.trim(),
          });
          toast.success("Verification required. We've sent a new code!");
        } catch (resendErr) {
          console.warn('[Login] Failed to resend code:', resendErr);
          toast.success('Verification required.');
        }

        console.log('[Login] 🔀 Redirecting to VerificationStep...');
        // Navigate to the verification step (step 2) of SignupScreen
        router.replace(
          `/(auth)/signup?email=${encodeURIComponent(values.email.trim())}&step=2` as Href
        );
      } else {
        console.log('[Login] 📣 Forwarding error to handleAuthError...');
        handleAuthError(error, 'signin');
      }
    } finally {
      console.log('[Login] 🧼 Finally block running. setIsLoading(false)...');
      setIsLoading(false);
      setSubmitting(false);
    }
  };

  const handleSelfHosting = () => {
    console.log('[Login] Self-hosting button pressed');
    console.log('[Login] Modal ref exists:', !!selfHostSettingsRef.current);
    if (selfHostSettingsRef.current) {
      console.log('[Login] Calling present() on modal');
      setIsModalOpen(true);
      selfHostSettingsRef.current.present();
    } else {
      console.error('[Login] Modal ref is null - cannot present');
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleSelfHostSave = async (data: {
    apiUrl: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    meilisearchUrl?: string;
    meilisearchSearchKey?: string;
  }) => {
    setSelfHosted(data);
    // Give AsyncStorage a moment to persist before returning
    // This ensures the settings are saved before the user can attempt login
    await new Promise((resolve) => setTimeout(resolve, 100));
    toast.success('Self-hosted instance configured');
  };

  const handleSwitchToCloud = () => {
    resetToCloud();
    toast.success('Switched to cloud instance');
  };

  return (
    <View className="bg-screen flex-1" style={{ backgroundColor: colors.background }}>
      <Formik
        initialValues={initialValues}
        validationSchema={toFormikValidationSchema(LoginSchema)}
        onSubmit={handleSubmit}
        validateOnMount={false}
        validateOnChange={false}
        validateOnBlur={false}>
        {({
          values,
          errors,
          touched,
          handleChange,
          setFieldTouched,
          handleSubmit,
          isSubmitting,
        }) => (
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            enabled={!isModalOpen}>
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                paddingTop: insets.top + 60,
                paddingBottom: Math.max(insets.bottom + 20, 40),
              }}
              keyboardShouldPersistTaps="handled">
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View className="flex-1 justify-between px-6">
                  <View>
                    {/* Header */}
                    <View className="mb-12">
                      <Text
                        size="3xl"
                        fontFamily="geist-bold"
                        className="text-primary_foreground dark:text-primary_foreground mb-2">
                        Welcome back
                      </Text>
                      <Text
                        size="lg"
                        fontFamily="geist-medium"
                        className="text-grey dark:text-grey mb-4">
                        Sign in to your account to continue
                      </Text>
                    </View>

                    {/* Form */}
                    <View className="gap-4">
                      <Input
                        placeholder="address@example.com"
                        value={values.email}
                        onChangeText={handleChange('email')}
                        onBlur={() => setFieldTouched('email', true, false)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        textContentType="emailAddress"
                        disabled={isSubmitting}
                        type="email"
                        isInvalid={touched.email && !!errors.email}
                        errorText={touched.email && errors.email ? errors.email : undefined}
                        borderRadius={12}
                      />

                      <Input
                        placeholder="your password"
                        value={values.password}
                        onChangeText={handleChange('password')}
                        onBlur={() => setFieldTouched('password', true, false)}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoComplete="password"
                        textContentType="password"
                        disabled={isSubmitting}
                        type="text"
                        isInvalid={touched.password && !!errors.password}
                        errorText={
                          touched.password && errors.password ? errors.password : undefined
                        }
                        borderRadius={12}
                        rightElement={
                          <InputPressable onPress={() => setShowPassword(!showPassword)}>
                            {(() => {
                              const IconObj = showPassword ? EyeIcon : EyeClosedIcon;
                              return <IconObj size={20} color={colors.grey} />;
                            })()}
                          </InputPressable>
                        }
                      />
                    </View>

                    {/* Self-hosting option */}
                    <View className="mt-4 flex-row items-center justify-between">
                      {isSelfHosted ? (
                        <Button
                          variant="text"
                          size="medium"
                          fullWidth={false}
                          onPress={handleSwitchToCloud}>
                          Switch to cloud
                        </Button>
                      ) : (
                        <Button
                          variant="text"
                          size="medium"
                          fullWidth={false}
                          onPress={handleSelfHosting}>
                          Self-hosting?
                        </Button>
                      )}
                    </View>
                  </View>

                  {/* Flow naturally in ScrollView */}
                  <View className="mt-12 gap-3">
                    <Button
                      variant="primary"
                      size="large"
                      onPress={() => handleSubmit()}
                      loading={isLoading}>
                      Sign In
                    </Button>

                    <View className="flex-row items-center justify-center gap-1 py-3">
                      <Text size="md" fontFamily="geist" className="text-grey dark:text-grey">
                        Don't have an account?
                      </Text>
                      <Pressable
                        onPress={() => router.replace('/(auth)/signup')}
                        disabled={isSubmitting}>
                        <Text
                          size="md"
                          fontFamily="geist-semibold"
                          className="text-primary dark:text-primary">
                          Sign up
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Formik>
      <SelfHostSettingsBottomSheet
        ref={selfHostSettingsRef}
        onSave={handleSelfHostSave}
        onClose={handleModalClose}
      />
    </View>
  );
}
