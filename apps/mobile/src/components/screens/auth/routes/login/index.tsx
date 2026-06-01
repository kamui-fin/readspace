import { SelfHostSettingsBottomSheet } from '@components/bottom-sheets/self-hosted-settings.bottom-sheet';
import EyeBoldIcon from '@components/icons/solar/eye-bold';
import EyeClosedBoldIcon from '@components/icons/solar/eye-closed-bold';
import { Button } from '@components/ui/button';
import { Input, InputPressable } from '@components/ui/input';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useSession } from '@contexts/auth-context';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useAuthErrorHandler } from '@hooks/useAuthErrorHandler';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { type LoginFormData, LoginSchema } from '@lib/validation/auth-schemas';
import { useSettingsStore } from '@stores/settings';
import { router } from 'expo-router';
import { Formik, type FormikHelpers } from 'formik';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const buttonBottomAnim = useRef(new Animated.Value(0)).current;
  const { handleAuthError } = useAuthErrorHandler();

  const isSelfHosted = settings.instance_type === 'self-hosted';

  // Track keyboard height and animate button position - DISABLED when modal is open
  useEffect(() => {
    if (isModalOpen) return; // Don't handle keyboard when modal is open

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
  }, [buttonBottomAnim, isModalOpen]);

  const initialValues: LoginFormData = {
    email: '',
    password: '',
  };

  const handleSubmit = async (
    values: LoginFormData,
    { setSubmitting }: FormikHelpers<LoginFormData>
  ) => {
    try {
      await signIn({ email: values.email.trim(), password: values.password });
      // Auth provider will handle redirect to protected routes automatically
    } catch (error) {
      handleAuthError(error, 'signin');
    } finally {
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

  const handleSelfHostSave = (data: {
    apiUrl: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    meilisearchUrl?: string;
    meilisearchSearchKey?: string;
  }) => {
    setSelfHosted(data);
    toast.success('Self-hosted instance configured');
  };

  const handleSwitchToCloud = () => {
    resetToCloud();
    toast.success('Switched to cloud instance');
  };

  return (
    <KeyboardAvoidingView
      className="bg-screen flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={!isModalOpen}
      style={{ backgroundColor: colors.background }}>
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
          <>
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                paddingTop: insets.top + 60,
                paddingBottom: Math.max(insets.bottom + 20, 40) + 120, // Add space for fixed buttons
              }}
              keyboardShouldPersistTaps="handled">
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View className="flex-1 px-6">
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
                      errorText={touched.password && errors.password ? errors.password : undefined}
                      borderRadius={12}
                      rightElement={
                        <InputPressable onPress={() => setShowPassword(!showPassword)}>
                          {(() => {
                            const IconObj = showPassword ? EyeBoldIcon : EyeClosedBoldIcon;
                            return <IconObj width={20} height={20} color={colors.grey} />;
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
              </TouchableWithoutFeedback>
            </ScrollView>

            {/* Fixed Buttons at Bottom - Adjusts for keyboard with smooth animation */}
            <Animated.View
              className="absolute left-0 right-0"
              style={{
                bottom: buttonBottomAnim,
                paddingHorizontal: Math.max(Math.min(24 * (393 / 393), 36), 20),
                paddingBottom: keyboardHeight > 0 ? 20 : Math.max(insets.bottom + 20, 40),
                backgroundColor: 'transparent',
              }}
              pointerEvents="box-none">
              <View className="gap-3">
                <Button
                  variant="primary"
                  size="large"
                  onPress={() => handleSubmit()}
                  loading={isSubmitting}>
                  Sign In
                </Button>

                {/* Sign Up Link - Hidden when keyboard is visible */}
                {keyboardHeight === 0 && (
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
                )}
              </View>
            </Animated.View>
          </>
        )}
      </Formik>
      <SelfHostSettingsBottomSheet
        ref={selfHostSettingsRef}
        onSave={handleSelfHostSave}
        onClose={handleModalClose}
      />
    </KeyboardAvoidingView>
  );
}
