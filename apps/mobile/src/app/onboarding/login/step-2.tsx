import { OnboardingLayout } from '@/components/OnboardingLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LockIcon } from '@/components/ui/icons/LockIcon';
import { useAuth } from '@/contexts/AuthProvider';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

export default function LoginStep2() {
    const router = useRouter();
    const { email } = useLocalSearchParams<{ email: string }>();
    const { signIn } = useAuth();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogIn = async () => {
        if (!email) {
            toast.error('Email is required');
            return;
        }

        setLoading(true);
        try {
            await signIn({ email, password });
            toast.success('Logged in successfully!');
            // Router will automatically redirect to tabs via auth guard
        } catch (error) {
            console.error('Log in error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to log in');
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
            title="Enter your password"
            subtitle="Enter your password to log in to your account">
            <View className="flex-1">
                <Input
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password"
                    textContentType="password"
                />

                <View className="flex-1" />

                <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onPress={handleLogIn}
                    disabled={!isPasswordValid || loading}>
                    {loading ? 'Logging In...' : 'Log In'}
                </Button>
            </View>
        </OnboardingLayout>
    );
}
