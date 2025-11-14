import { View, Text } from 'react-native';

interface VerificationStepProps {
  email: string;
}

export function VerificationStep({ email }: VerificationStepProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      {/* Icon */}
      <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-primary dark:bg-primary">
        <Text className="text-[32px]">✉️</Text>
      </View>

      {/* Header */}
      <View className="mb-4 items-center">
        <Text className="text-primary_foreground dark:text-primary_foreground mb-2 text-center font-geist-bold text-[28px]">
          Check your inbox
        </Text>
        <Text className="font-geist text-center text-base text-grey dark:text-grey">
          We sent a verification email to
        </Text>
        <Text className="text-primary_foreground dark:text-primary_foreground mt-1 text-center font-geist-semibold text-base">
          {email}
        </Text>
      </View>

      {/* Instructions */}
      <Text className="font-geist text-center text-sm leading-5 text-grey dark:text-grey">
        Click the link in the email to verify your account and start using Readspace.
      </Text>
    </View>
  );
}
