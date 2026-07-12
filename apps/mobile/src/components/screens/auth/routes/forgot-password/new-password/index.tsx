import EyeBoldIcon from '@components/icons/solar/eye-bold';
import EyeClosedBoldIcon from '@components/icons/solar/eye-closed-bold';
import { Button } from '@components/ui/button';
import { Input, InputPressable } from '@components/ui/input';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import { useSession } from '@contexts/auth-context';
import { useAuthErrorHandler } from '@hooks/useAuthErrorHandler';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BUTTON_BORDER_RADIUS } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { type NewPasswordFormData, NewPasswordSchema } from '@lib/validation/auth-schemas';
import { router } from 'expo-router';
import { Formik, type FormikHelpers } from 'formik';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toFormikValidationSchema } from 'zod-formik-adapter';

export function NewPasswordStep() {
  const { updatePassword } = useSession();
  const { handleAuthError } = useAuthErrorHandler();
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const initialValues: NewPasswordFormData = {
    password: '',
    confirmPassword: '',
  };

  const handleSubmit = async (
    values: NewPasswordFormData,
    { setSubmitting }: FormikHelpers<NewPasswordFormData>
  ) => {
    try {
      await updatePassword(values.password);
      toast.success('Password updated successfully!');
      router.replace('/(auth)/login');
    } catch (error) {
      handleAuthError(error, 'signin');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={toFormikValidationSchema(NewPasswordSchema)}
      onSubmit={handleSubmit}
      validateOnMount={false}
      validateOnChange={false}
      validateOnBlur={true}>
      {({ values, errors, touched, handleChange, setFieldTouched, handleSubmit, isSubmitting }) => (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: Math.max(insets.bottom + 20, 40),
            }}
            keyboardShouldPersistTaps="handled">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View className="flex-1 justify-between px-6">
                <View>
                  <View className="mb-8">
                    <Text
                      size="3xl"
                      fontFamily="geist-bold"
                      className="text-primary_foreground dark:text-primary_foreground mb-2">
                      New password
                    </Text>
                    <Text size="lg" fontFamily="geist-regular" className="text-grey dark:text-grey">
                      Must be at least 6 characters
                    </Text>
                  </View>

                  <View className="gap-4">
                    <Input
                      placeholder="New password"
                      value={values.password}
                      onChangeText={handleChange('password')}
                      onBlur={() => setFieldTouched('password', true, false)}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="password-new"
                      textContentType="newPassword"
                      type="text"
                      isInvalid={touched.password && !!errors.password}
                      errorText={touched.password && errors.password ? errors.password : undefined}
                      borderRadius={12}
                      disabled={isSubmitting}
                      rightElement={
                        <InputPressable onPress={() => setShowPassword(!showPassword)}>
                          {(() => {
                            const IconObj = showPassword ? EyeBoldIcon : EyeClosedBoldIcon;
                            return <IconObj width={20} height={20} color={colors.grey} />;
                          })()}
                        </InputPressable>
                      }
                    />

                    <Input
                      placeholder="Confirm new password"
                      value={values.confirmPassword}
                      onChangeText={handleChange('confirmPassword')}
                      onBlur={() => setFieldTouched('confirmPassword', true, false)}
                      secureTextEntry={!showConfirm}
                      autoCapitalize="none"
                      autoComplete="password-new"
                      textContentType="newPassword"
                      type="text"
                      isInvalid={touched.confirmPassword && !!errors.confirmPassword}
                      errorText={
                        touched.confirmPassword && errors.confirmPassword
                          ? errors.confirmPassword
                          : undefined
                      }
                      borderRadius={12}
                      disabled={isSubmitting}
                      rightElement={
                        <InputPressable onPress={() => setShowConfirm(!showConfirm)}>
                          {(() => {
                            const IconObj = showConfirm ? EyeBoldIcon : EyeClosedBoldIcon;
                            return <IconObj width={20} height={20} color={colors.grey} />;
                          })()}
                        </InputPressable>
                      }
                    />
                  </View>
                </View>

                <View className="mt-12">
                  <Button
                    variant="primary"
                    size="large"
                    onPress={() => handleSubmit()}
                    loading={isSubmitting}
                    style={{ borderRadius: BUTTON_BORDER_RADIUS }}>
                    Update password
                  </Button>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Formik>
  );
}
