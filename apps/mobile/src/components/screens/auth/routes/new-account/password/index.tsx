import EyeBoldIcon from '@components/icons/solar/eye-bold';
import EyeClosedBoldIcon from '@components/icons/solar/eye-closed-bold';
import { Input, InputPressable } from '@components/ui/input';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { PasswordSchema } from '@lib/validation/auth-schemas';
import { Formik, type FormikProps } from 'formik';
import { useEffect, useState } from 'react';
import { Keyboard, TouchableWithoutFeedback, View } from 'react-native';
import { toFormikValidationSchema } from 'zod-formik-adapter';

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
  setFieldTouched,
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
          <Text size="lg" fontFamily="geist-regular" className="text-grey dark:text-grey">
            Must be atleast 6 characters
          </Text>
        </View>

        {/* Password Input */}
        <Input
          placeholder="Enter your password"
          value={values.password}
          onChangeText={handleChange('password')}
          onBlur={() => setFieldTouched('password', true, true)}
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
                const IconObj = showPassword ? EyeBoldIcon : EyeClosedBoldIcon;
                return <IconObj width={20} height={20} color={colors.grey} />;
              })()}
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
      onSubmit={() => { }}
      validateOnMount={false}
      validateOnChange={false}
      validateOnBlur={false}>
      {(formikProps) => (
        <PasswordFormContent
          {...formikProps}
          {...(formikProps as unknown as { setFieldTouched: any })}
          onPasswordChange={onPasswordChange}
          initialPassword={initialPassword}
        />
      )}
    </Formik>
  );
}
