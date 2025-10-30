import { Button } from '@/components/ui/Button';
import { GoogleIcon } from '@/components/ui/icons/GoogleIcon';
import { LogoIcon } from '@/components/ui/icons/LogoIcon';
import { getSupabaseClient, resetSupabaseClient } from '@/lib/supabase/client';
import { useSettingsStore } from '@/stores/settings';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';


export default function WelcomeScreen() {
    const router = useRouter();
    const { settings, resetToCloud } = useSettingsStore();

    const handleGoogleSignIn = async () => {
        try {
            // Ensure we're using cloud configuration for Google OAuth
            // Google OAuth is only configured on the cloud instance
            if (settings.instance_type === 'self-hosted') {
                console.log('[GoogleSignIn] Switching from self-hosted to cloud for Google OAuth');
                resetToCloud();
                // Reset Supabase client to use cloud configuration
                resetSupabaseClient();
            }

            // Check if device supports Google Play Services
            await GoogleSignin.hasPlayServices();

            // Start the sign-in flow
            const { data } = await GoogleSignin.signIn();

            if (!data?.idToken) {
                throw new Error('No ID token returned from Google Sign In');
            }

            // Get fresh Supabase client with cloud configuration
            const supabase = getSupabaseClient();

            // Sign in to Supabase with the Google ID token
            const { error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: data.idToken,
            });

            if (error) {
                console.error('[GoogleSignIn] Supabase sign in error:', error);
                toast.error('Failed to sign in with Google', {
                    description: error.message,
                });
                return;
            }

            console.log('[GoogleSignIn] Successfully signed in with Google');
            
            // Navigation will be handled by AuthProvider and _layout.tsx
            // based on the needsOnboarding state
            // The layout will redirect to onboarding if user has no feed subscriptions
        } catch (error: any) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                console.log('[GoogleSignIn] User cancelled the sign-in flow');
            } else if (error.code === statusCodes.IN_PROGRESS) {
                console.log('[GoogleSignIn] Sign in is already in progress');
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                console.error('[GoogleSignIn] Play services not available');
                toast.error('Google Play Services not available');
            } else {
                console.error('[GoogleSignIn] Error:', error);
                toast.error('Failed to sign in with Google', {
                    description: error.message || 'An unexpected error occurred',
                });
            }
        }
    };

    const handleSignUp = () => {
        router.push('/onboarding/signup/step-1');
    };

    const handleLogIn = () => {
        router.push('/onboarding/login/step-1');
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-white-dark">
            <View className="flex-1 items-center justify-between px-6 py-16">
                {/* Logo and Text */}
                <View className="flex-1 items-center justify-center">
                    <LogoIcon size={120} />
                    <Text className="mt-6 font-figtree text-[42px] tracking-heading text-black dark:text-black-dark">
                        readspace
                    </Text>
                </View>

                {/* Action Buttons */}
                <View className="w-full gap-4">
                    <Button
                        variant="black"
                        fullWidth
                        size="lg"
                        onPress={handleGoogleSignIn}
                        className="flex-row gap-3">
                        <GoogleIcon size={24} />
                        <Text className="font-geist-medium text-lg text-white dark:text-black">
                            Continue with Google
                        </Text>
                    </Button>

                    <Button variant="secondary" fullWidth size="lg" onPress={handleSignUp}>
                        <Text className="font-geist-medium text-lg dark:text-white">Sign up with Email</Text>
                    </Button>

                    {/* Log in link */}
                    <Pressable onPress={handleLogIn} className="items-center">
                        <Text className="font-geist text-sm text-grey dark:text-grey-dark">
                            Already have an account?{' '}
                            <Text className="font-geist-semibold text-primary">Log In</Text>
                        </Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}
