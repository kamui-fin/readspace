import { OnboardingLayout } from '@/components/OnboardingLayout';
import { SelfHostSettings } from '@/components/SelfHostSettings';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MailIcon } from '@/components/ui/icons/MailIcon';
import { useSettingsStore } from '@/stores/settings';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

export default function LoginStep1() {
    const router = useRouter();
    const selfHostSettingsRef = useRef<BottomSheetModal>(null);
    const [email, setEmail] = useState('');
    const { settings, setSelfHosted, resetToCloud } = useSettingsStore();

    const isSelfHosted = settings.instance_type === 'self-hosted';

    const handleNext = () => {
        // Store email in router params and navigate to step 2
        router.push({
            pathname: '/onboarding/login/step-2',
            params: { email },
        });
    };

    const handleSelfHosting = () => {
        selfHostSettingsRef.current?.present();
    };

    const handleSelfHostSave = (data: {
        apiUrl: string;
        supabaseUrl: string;
        supabaseAnonKey: string;
    }) => {
        setSelfHosted(data);
    };

    const handleSwitchToCloud = () => {
        resetToCloud();
    };

    // Basic email validation
    const isValidEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    return (
        <>
            <OnboardingLayout
                currentStep={0}
                totalSteps={2}
                icon={<MailIcon size={24} color="#90988B" />}
                title="Log in with Email"
                subtitle="Enter your email address to log in.">
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

                    <View className="mt-4 flex-row items-center justify-between">
                        {isSelfHosted ? (
                            <>
                                <View className="flex-1">
                                    <Text className="font-geist-medium text-sm text-black">
                                        Using{' '}
                                        <Text className="font-geist-mono text-xs text-grey">
                                            {settings.readspace_url}
                                        </Text>
                                    </Text>
                                </View>
                                <Pressable onPress={handleSwitchToCloud}>
                                    <Text className="font-geist-medium text-sm text-primary">
                                        Switch to cloud
                                    </Text>
                                </Pressable>
                            </>
                        ) : (
                            <Pressable onPress={handleSelfHosting}>
                                <Text className="font-geist-medium text-sm text-primary">
                                    Self-hosting?
                                </Text>
                            </Pressable>
                        )}
                    </View>

                    <View className="flex-1" />

                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        onPress={handleNext}
                        disabled={!isValidEmail(email.trim())}>
                        Next
                    </Button>
                </View>
            </OnboardingLayout>
            <SelfHostSettings ref={selfHostSettingsRef} onSave={handleSelfHostSave} />
        </>
    );
}
