import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Formik, type FormikHelpers } from 'formik';
import { toFormikValidationSchema } from 'zod-formik-adapter';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef } from 'react';

import { Button } from '@components/ui/button';
import { TextInput } from '@components/ui/input';
import { toast } from '@components/ui/toast';
import { SelfHostSettings } from '@/components/modals/self-hosted-settings.modal';
import { SelfHostSettingsBottomSheet } from '@/components/bottom-sheets/self-hosted-settings.bottom-sheet';
import { useSession } from '@contexts/auth-context';
import { useSettingsStore } from '@stores/settings';
import { LoginSchema, type LoginFormData } from '@lib/validation/auth-schemas';

const isIOS = Platform.OS === 'ios';

export default function LoginScreen() {
  const { signIn } = useSession();
  const insets = useSafeAreaInsets();
  const selfHostSettingsRef = useRef<BottomSheetModal>(null);
  const { settings, setSelfHosted, resetToCloud } = useSettingsStore();

  const isSelfHosted = settings.instance_type === 'self-hosted';

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
      toast.success('Welcome back!');
      // Auth provider will handle redirect to protected routes automatically
    } catch (error) {
      console.error('Sign in error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelfHosting = () => {
    console.log('[Login] Self-hosting button pressed');
    console.log('[Login] Modal ref exists:', !!selfHostSettingsRef.current);
    if (selfHostSettingsRef.current) {
      console.log('[Login] Calling present() on modal');
      selfHostSettingsRef.current.present();
    } else {
      console.error('[Login] Modal ref is null - cannot present');
    }
  };

  const handleSelfHostSave = (data: {
    apiUrl: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
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
      className="dark:bg-screen_background flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Formik
        initialValues={initialValues}
        validationSchema={toFormikValidationSchema(LoginSchema)}
        onSubmit={handleSubmit}
        validateOnMount={false}
        validateOnChange={false}
        validateOnBlur={true}>
        {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
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
                    <Text className="text-primary_foreground dark:text-primary_foreground mb-2 font-geist-bold text-[28px]">
                      Welcome back
                    </Text>
                    <Text className="font-geist mb-4 text-base text-grey dark:text-grey">
                      Sign in to your account to continue
                    </Text>
                  </View>

                  {/* Form */}
                  <View className="gap-4">
                    <View>
                      <TextInput
                        placeholder="address@example.com"
                        value={values.email}
                        onChangeText={handleChange('email')}
                        onBlur={handleBlur('email')}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        textContentType="emailAddress"
                        editable={!isSubmitting}
                        size="large"
                        error={touched.email && !!errors.email}
                      />
                      {touched.email && errors.email && (
                        <Text className="font-geist mt-1 text-xs text-destructive dark:text-destructive">
                          {errors.email}
                        </Text>
                      )}
                    </View>

                    <View>
                      <TextInput
                        placeholder="your password"
                        value={values.password}
                        onChangeText={handleChange('password')}
                        onBlur={handleBlur('password')}
                        secureTextEntry
                        autoCapitalize="none"
                        autoComplete="password"
                        textContentType="password"
                        editable={!isSubmitting}
                        size="large"
                        error={touched.password && !!errors.password}
                      />
                      {touched.password && errors.password && (
                        <Text className="font-geist mt-1 text-xs text-destructive dark:text-destructive">
                          {errors.password}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Self-hosting option */}
                  <View className="mt-4 flex-row items-center justify-between">
                    {isSelfHosted ? (
                      <>
                        <View className="flex-1">
                          <Text className="font-geist-medium text-md text-primary-foreground dark:text-primary-foreground-dark">
                            Using{' '}
                            <Text className="font-geist-mono text-md text-grey dark:text-grey">
                              {settings.readspace_url}
                            </Text>
                          </Text>
                        </View>
                        <Button
                          variant="text"
                          size="medium"
                          fullWidth={false}
                          onPress={handleSwitchToCloud}>
                          Switch to cloud
                        </Button>
                      </>
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

            {/* Fixed Buttons at Bottom */}
            <View
              className="dark:bg-screen_background absolute bottom-0 left-0 right-0 bg-background"
              style={{
                paddingHorizontal: Math.max(Math.min(24 * (393 / 393), 36), 20),
                paddingBottom: Math.max(insets.bottom + 20, 40),
              }}>
              <View className="gap-3">
                {/* Sign In Button */}
                <Button
                  variant="primary"
                  size="large"
                  onPress={() => handleSubmit()}
                  loading={isSubmitting}>
                  Sign In
                </Button>

                {/* Sign Up Link */}
                <View className="flex-row items-center justify-center gap-1 py-3">
                  <Text className="font-geist text-md text-grey dark:text-grey">
                    Don't have an account?
                  </Text>
                  <Pressable
                    onPress={() => router.replace('/(auth)/signup')}
                    disabled={isSubmitting}>
                    <Text className="font-geist-semibold text-md text-primary dark:text-primary">
                      Sign up
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </>
        )}
      </Formik>
      {isIOS ? (
        <SelfHostSettings ref={selfHostSettingsRef} onSave={handleSelfHostSave} />
      ) : (
        <SelfHostSettingsBottomSheet ref={selfHostSettingsRef} onSave={handleSelfHostSave} />
      )}
    </KeyboardAvoidingView>
  );
}
