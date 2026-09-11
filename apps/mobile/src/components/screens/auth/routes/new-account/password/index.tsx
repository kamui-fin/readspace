import { Input, InputPressable } from '@components/ui/input';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { PasswordConfirmationSchema } from '@lib/validation/auth-schemas';
import { EyeClosedIcon, EyeIcon } from '@solar-icons/react-native/bold';
import { Formik, type FormikProps } from 'formik';
import { useEffect, useState } from 'react';
import { Keyboard, TouchableWithoutFeedback, View } from 'react-native';
import { toFormikValidationSchema } from 'zod-formik-adapter';

interface PasswordStepProps {
  initialPassword?: string;
  initialConfirmPassword?: string;
  onConfirmPasswordChange?: (password: string) => void;
  onPasswordChange?: (password: string) => void;
}

type PasswordFormValues = { password: string; confirmPassword: string };

function PasswordFormContent({
  values,
  errors,
  touched,
  handleChange,
  setFieldTouched,
  onPasswordChange,
  onConfirmPasswordChange,
}: FormikProps<PasswordFormValues> & {
  onPasswordChange?: (password: string) => void;
  onConfirmPasswordChange?: (password: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  useEffect(() => {
    onPasswordChange?.(values.password);
  }, [values.password, onPasswordChange]);

  useEffect(() => {
    onConfirmPasswordChange?.(values.confirmPassword);
  }, [values.confirmPassword, onConfirmPasswordChange]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 px-6">
        {/* Header */}
        <View className="mb-8">
          <Text
            size="3xl"
            fontFamily="geist-bold"
            className="text-primary_foreground dark:text-primary_foreground mb-2">
            Create a password
          </Text>
          <Text size="lg" fontFamily="geist-regular" className="text-grey dark:text-grey">
            Must be at least 6 characters
          </Text>
        </View>

        {/* Password Input */}
        <Input
          placeholder="Enter your password"
          value={values.password}
          onChangeText={handleChange('password')}
          onBlur={() => setFieldTouched('password', true)}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="password-new"
          textContentType="newPassword"
          type="text"
          isInvalid={touched.password && !!errors.password}
          errorText={touched.password && errors.password ? errors.password : undefined}
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
        <View className="mt-4">
          <Input
            placeholder="Confirm your password"
            accessibilityLabel="Confirm password"
            value={values.confirmPassword}
            onChangeText={handleChange('confirmPassword')}
            onBlur={() => setFieldTouched('confirmPassword', true)}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            type="text"
            isInvalid={touched.confirmPassword && !!errors.confirmPassword}
            errorText={
              touched.confirmPassword && errors.confirmPassword ? errors.confirmPassword : undefined
            }
            borderRadius={12}
            rightElement={
              <InputPressable onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? (
                  <EyeIcon size={20} color={colors.grey} />
                ) : (
                  <EyeClosedIcon size={20} color={colors.grey} />
                )}
              </InputPressable>
            }
          />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

export function PasswordStep({
  initialPassword = '',
  initialConfirmPassword = '',
  onPasswordChange,
  onConfirmPasswordChange,
}: PasswordStepProps) {
  return (
    <Formik
      initialValues={{ password: initialPassword, confirmPassword: initialConfirmPassword }}
      validationSchema={toFormikValidationSchema(PasswordConfirmationSchema)}
      onSubmit={() => {}}
      validateOnMount
      validateOnChange
      validateOnBlur>
      {(formikProps) => (
        <PasswordFormContent
          {...formikProps}
          onPasswordChange={onPasswordChange}
          onConfirmPasswordChange={onConfirmPasswordChange}
        />
      )}
    </Formik>
  );
}
