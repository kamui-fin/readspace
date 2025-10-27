import { Button } from '@/components/ui/Button';
import { GoogleIcon } from '@/components/ui/icons/GoogleIcon';
import { LogoIcon } from '@/components/ui/icons/LogoIcon';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
    const router = useRouter();

    const handleGoogleSignIn = () => {
        // TODO: Implement Google Sign In
        console.log('Google Sign In pressed');
    };

    const handleSignUp = () => {
        router.push('/onboarding/signup/step-1');
    };

    const handleLogIn = () => {
        router.push('/onboarding/login/step-1');
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 items-center justify-between px-6 py-16">
                {/* Logo and Text */}
                <View className="flex-1 items-center justify-center">
                    <LogoIcon size={120} />
                    <Text className="mt-6 font-figtree text-[42px] tracking-heading text-black">
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
                        <Text className="font-geist-medium text-lg text-white">
                            Continue with Google
                        </Text>
                    </Button>

                    <Button variant="secondary" fullWidth size="lg" onPress={handleSignUp}>
                        <Text className="font-geist-medium text-lg">Sign up with Email</Text>
                    </Button>

                    {/* Log in link */}
                    <Pressable onPress={handleLogIn} className="items-center">
                        <Text className="font-geist text-sm text-grey">
                            Already have an account?{' '}
                            <Text className="font-geist-semibold text-primary">Log In</Text>
                        </Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}
