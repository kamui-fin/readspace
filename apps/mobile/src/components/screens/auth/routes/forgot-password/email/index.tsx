import { Input } from '@components/ui/input';
import { Text } from '@components/ui/text';
import { EmailSchema } from '@lib/validation/auth-schemas';
import { Formik, type FormikProps } from 'formik';
import { useEffect } from 'react';
import { Keyboard, TouchableWithoutFeedback, View } from 'react-native';
import { toFormikValidationSchema } from 'zod-formik-adapter';

interface ForgotPasswordEmailStepProps {
  initialEmail?: string;
  onEmailChange?: (email: string) => void;
}

type EmailFormValues = { email: string };

function EmailFormContent({
  values,
  errors,
  touched,
  handleChange,
  setFieldTouched,
  onEmailChange,
  initialEmail,
}: FormikProps<EmailFormValues> & {
  onEmailChange?: (email: string) => void;
  initialEmail: string;
}) {
  useEffect(() => {
    if (onEmailChange && values.email !== initialEmail) {
      onEmailChange(values.email);
    }
  }, [values.email, onEmailChange, initialEmail]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 px-6">
        <View className="mb-8">
          <Text
            size="3xl"
            fontFamily="geist-bold"
            className="text-primary_foreground dark:text-primary_foreground mb-2">
            Forgot password?
          </Text>
          <Text size="lg" fontFamily="geist-regular" className="text-grey dark:text-grey">
            Enter your email and we'll send you a reset code
          </Text>
        </View>

        <Input
          placeholder="address@example.com"
          value={values.email}
          onChangeText={handleChange('email')}
          onBlur={() => setFieldTouched('email', true, false)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          type="email"
          isInvalid={touched.email && !!errors.email}
          errorText={touched.email && errors.email ? errors.email : undefined}
          borderRadius={12}
        />


      </View>
    </TouchableWithoutFeedback>
  );
}

export function ForgotPasswordEmailStep({
  initialEmail = '',
  onEmailChange,
}: ForgotPasswordEmailStepProps) {
  return (
    <Formik
      initialValues={{ email: initialEmail || '' }}
      validationSchema={toFormikValidationSchema(EmailSchema)}
      onSubmit={() => {}}
      validateOnMount={false}
      validateOnChange={false}
      validateOnBlur={false}>
      {(formikProps) => (
        <EmailFormContent
          {...formikProps}
          {...(formikProps as unknown as { setFieldTouched: any })}
          onEmailChange={onEmailChange}
          initialEmail={initialEmail}
        />
      )}
    </Formik>
  );
}
