import { View, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useEffect } from 'react';
import { Formik, type FormikProps } from 'formik';
import { toFormikValidationSchema } from 'zod-formik-adapter';
import { BottomSheetModal } from '@gorhom/bottom-sheet';

import { Text } from '@components/ui/text';
import { Input } from '@components/ui/input';
import { Button } from '@components/ui/button';
import { toast } from '@components/ui/toast';
import { useSettingsStore, type AppSettings } from '@stores/settings';
import { EmailSchema } from '@lib/validation/auth-schemas';

interface EmailStepProps {
  initialEmail?: string;
  onEmailChange?: (email: string) => void;
  selfHostSettingsRef?: React.RefObject<BottomSheetModal | null>;
}

type EmailFormValues = { email: string };

function EmailFormContent({
  values,
  errors,
  touched,
  handleChange,
  handleBlur,
  onEmailChange,
  initialEmail,
  isSelfHosted,
  settings,
  handleSelfHosting,
  handleSwitchToCloud,
}: FormikProps<EmailFormValues> & {
  onEmailChange?: (email: string) => void;
  initialEmail: string;
  isSelfHosted: boolean;
  settings: AppSettings;
  handleSelfHosting: () => void;
  handleSwitchToCloud: () => void;
}) {
  // Notify parent of email changes
  useEffect(() => {
    if (onEmailChange && values.email !== initialEmail) {
      onEmailChange(values.email);
    }
  }, [values.email, onEmailChange, initialEmail]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 px-6">
        {/* Header */}
        <View className="mb-8">
          <Text
            size="3xl"
            fontFamily="geist-bold"
            className="text-primary_foreground dark:text-primary_foreground mb-2">
            What's your email?
          </Text>
          <Text size="lg" fontFamily="geist-medium" className="text-grey dark:text-grey">
            We'll use this to create your account
          </Text>
        </View>

        {/* Email Input */}
        <Input
          placeholder="address@example.com"
          value={values.email}
          onChangeText={handleChange('email')}
          onBlur={handleBlur('email')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          autoFocus
          type="email"
          isInvalid={touched.email && !!errors.email}
          errorText={touched.email && errors.email ? errors.email : undefined}
          borderRadius={12}
        />

        {/* Self-hosting option */}
        <View className="mt-4 flex-row items-center justify-between">
          {isSelfHosted ? (
            <>
              <View className="flex-1">
                <Text
                  size="md"
                  fontFamily="geist-medium"
                  className="text-primary-foreground dark:text-primary-foreground-dark">
                  Using{' '}
                  <Text size="md" fontFamily="mono" className="text-grey dark:text-grey">
                    {settings.readspace_url}
                  </Text>
                </Text>
              </View>
              <Button variant="text" size="medium" fullWidth={false} onPress={handleSwitchToCloud}>
                Switch to cloud
              </Button>
            </>
          ) : (
            <Button variant="text" size="medium" fullWidth={false} onPress={handleSelfHosting}>
              Self-hosting?
            </Button>
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

export function EmailStep({
  initialEmail = '',
  onEmailChange,
  selfHostSettingsRef,
}: EmailStepProps) {
  const { settings, resetToCloud } = useSettingsStore();
  const isSelfHosted = settings.instance_type === 'self-hosted';

  const handleSelfHosting = () => {
    selfHostSettingsRef?.current?.present();
  };

  const handleSwitchToCloud = () => {
    resetToCloud();
    toast.success('Switched to cloud instance');
  };

  return (
    <Formik
      initialValues={{ email: initialEmail || '' }}
      validationSchema={toFormikValidationSchema(EmailSchema)}
      onSubmit={() => {}}
      validateOnMount={false}
      validateOnChange={false}
      validateOnBlur={true}>
      {(formikProps) => (
        <EmailFormContent
          {...formikProps}
          onEmailChange={onEmailChange}
          initialEmail={initialEmail}
          isSelfHosted={isSelfHosted}
          settings={settings}
          handleSelfHosting={handleSelfHosting}
          handleSwitchToCloud={handleSwitchToCloud}
        />
      )}
    </Formik>
  );
}
