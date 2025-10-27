import { OnboardingLayout } from '@/components/OnboardingLayout';
import { Button } from '@/components/ui/Button';
import { OTPInput } from '@/components/ui/OTPInput';
import { ShieldCheckIcon } from '@/components/ui/icons/ShieldCheckIcon';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

export default function OnboardingStep3() {
  const router = useRouter();
  const [otp, setOtp] = useState('');

  const handleNext = () => {
    // Mock functionality - just navigate to next step
    router.push('/onboarding/step-4');
  };

  const isOtpComplete = otp.length === 6;

  return (
    <OnboardingLayout
      currentStep={2}
      totalSteps={5}
      icon={<ShieldCheckIcon size={24} color="#90988B" />}
      title="Verify your email"
      subtitle={
        <Text className="font-geist text-base text-grey">
          We sent a verification code to your email{'\n'}
          <Text className="font-geist-semibold text-black">account@readspace.ai</Text>
        </Text>
      }>
      <View className="flex-1">
        <OTPInput numberOfDigits={6} value={otp} onTextChange={setOtp} onFilled={setOtp} />

        <View className="flex-1" />

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleNext}
          disabled={!isOtpComplete}>
          Next
        </Button>
      </View>
    </OnboardingLayout>
  );
}
