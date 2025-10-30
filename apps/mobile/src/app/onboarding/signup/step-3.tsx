import { OnboardingLayout } from '@/components/OnboardingLayout';
import { MailIcon } from '@/components/ui/icons/MailIcon';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function SignupStep3() {
    const { email } = useLocalSearchParams<{ email: string }>();

    return (
        <OnboardingLayout
            currentStep={2}
            totalSteps={2}
            icon={<MailIcon size={24} color="#90988B" />}
            title="Check your inbox"
            subtitle={
                <Text className="font-geist text-base text-grey">
                    We sent a verification email to{'\n'}
                    <Text className="font-geist-semibold text-black dark:text-white">
                        {email || 'your email'}
                    </Text>
                </Text>
            }>
            <View className="flex-1">
                <Text className="font-geist text-base text-grey text-center">
                    Click the link in the email to verify your account and continue setting up your
                    feed.
                </Text>
            </View>
        </OnboardingLayout>
    );
}
