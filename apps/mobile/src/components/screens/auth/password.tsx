import { View, Text, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useEffect } from 'react';
import { Formik, type FormikProps } from 'formik';
import { toFormikValidationSchema } from 'zod-formik-adapter';

import { TextInput } from '@components/ui/input';
import { PasswordSchema } from '@lib/validation/auth-schemas';

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
          <Text className="text-primary_foreground dark:text-primary_foreground mb-2 font-geist-bold text-[28px]">
            Create a password
          </Text>
          <Text className="font-geist text-base text-grey dark:text-grey">
            Your password must be at least 6 characters
          </Text>
        </View>

        {/* Password Input */}
        <View>
          <TextInput
            placeholder="Enter your password"
            value={values.password}
            onChangeText={handleChange('password')}
            onBlur={handleBlur('password')}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            autoFocus
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
