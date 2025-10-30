import { OnboardingLayout } from '@/components/OnboardingLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LockIcon } from '@/components/ui/icons/LockIcon';
import { useAuth } from '@/contexts/AuthProvider';
import { useSettingsStore } from '@/stores/settings';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { getSupabaseClient } from '@/lib/supabase/client';
import * as Linking from 'expo-linking';

export default function SignupStep2() {
    const router = useRouter();
    const { email } = useLocalSearchParams<{ email: string }>();
    const { signUp } = useAuth();
    const { settings } = useSettingsStore();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignUp = async () => {
        if (!email) {
            toast.error('Email is required');
            return;
        }

        setLoading(true);
        try {
            if (settings.instance_type === 'cloud') {
                // Cloud: Use Supabase directly with email confirmation
                const supabase = getSupabaseClient();
                const redirectTo = Linking.createURL('onboarding/feeds/categories');

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: redirectTo,
                    },
                });

                if (error) {
                    throw new Error(error.message);
                }

                // Navigate to email verification notice
                router.push({
                    pathname: '/onboarding/signup/step-3',
                    params: { email },
                });
            } else {
                // Self-hosted: Use existing signUp method (no email verification)
                await signUp({ email, password });
                toast.success('Account created successfully!');
                router.replace('/(tabs)');
            }
        } catch (error) {
            console.error('Sign up error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    const isPasswordValid = password.length >= 6;

    return (
        <OnboardingLayout
            currentStep={1}
            totalSteps={2}
            icon={<LockIcon size={24} color="#90988B" />}
            title="Create a password"
            subtitle="Your password must have at least 6 characters">
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
                    onPress={handleSignUp}
                    disabled={!isPasswordValid || loading}>
                    {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
            </View>
        </OnboardingLayout>
    );
}
