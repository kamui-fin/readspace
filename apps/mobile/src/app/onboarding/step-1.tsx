import { OnboardingLayout } from '@/components/OnboardingLayout';
import { SelfHostSettings } from '@/components/SelfHostSettings';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MailIcon } from '@/components/ui/icons/MailIcon';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

export default function OnboardingStep1() {
    const router = useRouter();
    const selfHostSettingsRef = useRef<BottomSheetModal>(null);
    const [email, setEmail] = useState('');

    const handleNext = () => {
        // Mock functionality - just navigate to next step
        router.push('/onboarding/step-2');
    };

    const handleSelfHosting = () => {
        selfHostSettingsRef.current?.present();
    };

    const handleSelfHostSave = (data: {
        apiUrl: string;
        supabaseUrl: string;
        supabaseAnonKey: string;
    }) => {
        // TODO: Save self-hosting configuration for onboarding
        console.log('Self-hosting configuration saved during onboarding:', data);
    };

    return (
        <>
            <OnboardingLayout
                currentStep={0}
                totalSteps={5}
                icon={<MailIcon size={24} color="#90988B" />}
                title="Continue with Email"
                subtitle="Sign in or sign up with your email address.">
                <View className="flex-1">
                    <Input
                        placeholder="example@gmail.com"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        textContentType="emailAddress"
                    />

                    <Pressable onPress={handleSelfHosting} className="mt-4">
                        <Text className="font-geist-medium text-sm text-primary">
                            Self-hosting?
                        </Text>
                    </Pressable>

                    <View className="flex-1" />

                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        onPress={handleNext}
                        disabled={!email.trim()}>
                        Next
                    </Button>
                </View>
            </OnboardingLayout>
            <SelfHostSettings ref={selfHostSettingsRef} onSave={handleSelfHostSave} />
        </>
    );
}
