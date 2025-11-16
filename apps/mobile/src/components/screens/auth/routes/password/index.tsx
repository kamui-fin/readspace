import { View, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useEffect, useState } from 'react';
import { Formik, type FormikProps } from 'formik';
import { toFormikValidationSchema } from 'zod-formik-adapter';
import { Monicon } from '@monicon/native';

import { Text } from '@components/ui/text';
import { Input, InputPressable } from '@components/ui/input';
import { PasswordSchema } from '@lib/validation/auth-schemas';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';

interface PasswordStepProps {
  initialPassword?: string;
  onPasswordChange?: (password: string) => void;
}

type PasswordFormValues = { password: string };

function PasswordFormContent({
  values,
  errors,
  touched,
  handleChange,
  handleBlur,
  onPasswordChange,
  initialPassword,
}: FormikProps<PasswordFormValues> & {
  onPasswordChange?: (password: string) => void;
  initialPassword: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  // Notify parent of password changes
  useEffect(() => {
    if (onPasswordChange && values.password !== initialPassword) {
      onPasswordChange(values.password);
    }
  }, [values.password, onPasswordChange, initialPassword]);

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
          <Text size="lg" fontFamily="geist-medium" className="text-grey dark:text-grey">
            Your password must be at least 6 characters
          </Text>
        </View>

        {/* Password Input */}
        <Input
          placeholder="Enter your password"
          value={values.password}
          onChangeText={handleChange('password')}
          onBlur={handleBlur('password')}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="password-new"
          textContentType="newPassword"
          autoFocus
          type="text"
          isInvalid={touched.password && !!errors.password}
          errorText={touched.password && errors.password ? errors.password : undefined}
          borderRadius={12}
          rightElement={
            <InputPressable onPress={() => setShowPassword(!showPassword)}>
              <Monicon
                name={showPassword ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
                size={20}
                color={colors.grey}
              />
            </InputPressable>
          }
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

export function PasswordStep({ initialPassword = '', onPasswordChange }: PasswordStepProps) {
  return (
    <Formik
      initialValues={{ password: initialPassword || '' }}
      validationSchema={toFormikValidationSchema(PasswordSchema)}
      onSubmit={() => {}}
      validateOnMount={false}
      validateOnChange={false}
      validateOnBlur={true}>
      {(formikProps) => (
        <PasswordFormContent
          {...formikProps}
          onPasswordChange={onPasswordChange}
          initialPassword={initialPassword}
        />
      )}
    </Formik>
  );
}
