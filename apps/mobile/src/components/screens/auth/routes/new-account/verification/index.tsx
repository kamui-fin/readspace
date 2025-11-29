import { Text } from '@components/ui/text';
import { View } from 'react-native';

interface VerificationStepProps {
  email: string;
}

export function VerificationStep({ email }: VerificationStepProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      {/* Header */}
      <View className="mb-4 items-center">
        <Text
          size="3xl"
          fontFamily="geist-bold"
          className="text-primary_foreground dark:text-primary_foreground mb-2 text-center">
          Check your inbox
        </Text>
        <Text size="lg" fontFamily="geist-medium" className="text-center text-grey dark:text-grey">
          We sent a verification email to
        </Text>
        <Text
          size="lg"
          fontFamily="geist-semibold"
          className="text-primary_foreground dark:text-primary_foreground mt-1 text-center">
          {email}
        </Text>
      </View>

      {/* Instructions */}
      <Text
        size="lg"
        fontFamily="geist-medium"
        className="text-center leading-5 text-grey dark:text-grey">
        Click the link in the email to verify your account and start using Readspace.
      </Text>
    </View>
  );
}
