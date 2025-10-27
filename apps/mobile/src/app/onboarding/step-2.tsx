import { OnboardingLayout } from '@/components/OnboardingLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LockIcon } from '@/components/ui/icons/LockIcon';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

export default function OnboardingStep2() {
  const router = useRouter();
  const [password, setPassword] = useState('');

  const handleNext = () => {
    // Mock functionality - just navigate to next step
    router.push('/onboarding/step-3');
  };

  const isPasswordValid = password.length >= 6;

  return (
    <OnboardingLayout
      currentStep={1}
      totalSteps={5}
      icon={<LockIcon size={24} color="#90988B" />}
      title="Create a password"
      subtitle="Your password must have atleast 6 characters">
      <View className="flex-1">
        <Input
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password-new"
          textContentType="newPassword"
        />

        <View className="flex-1" />

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleNext}
          disabled={!isPasswordValid}>
          Next
        </Button>
      </View>
    </OnboardingLayout>
  );
}
