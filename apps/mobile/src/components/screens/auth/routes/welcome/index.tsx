import { GoogleIcon } from '@components/icons/google';
import { ReadspaceLogo } from '@components/icons/readspace-logo';
import { Button } from '@components/ui/button';
import { ThreeDotsAnimation } from '@components/ui/three-dots';
import { toast } from '@components/ui/toast';
import { useSession } from '@contexts/auth-context';
import { useGoogleAuth } from '@hooks/useGoogleAuth';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { SPACING } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { Monicon } from '@monicon/native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isDark = useIsDarkMode();
  const { signInWithGoogle } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  // TODO: Replace with your actual Google OAuth client ID
  // You'll need to provide this from your environment variables

  // Debug: Log the client ID
  useEffect(() => {
    console.log('==========================================');
    console.log('Google OAuth Configuration:');
    console.log('Client ID:', process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);
    console.log('==========================================');
  }, []);

  const { response, promptAsync } = useGoogleAuth({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    // Use the same ID as fallback for web, though typically these differ
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      // expo-auth-session/providers/google returns tokens in response.authentication or response.params
      const { id_token } = response.params;
      const { accessToken } = response.authentication || {};

      // Use id_token from params or authentication object
      const token = id_token || response.authentication?.idToken;

      if (token) {
        setIsLoading(true);

        signInWithGoogle(token, accessToken || '')
          .then(() => {
            toast.success('Successfully signed in with Google');
          })
          .catch((error) => {
            console.error('Google sign in error:', error);
            // Show a friendly error message to the user
            toast.error('Unable to sign in with Google. Please try again.');
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
    } else if (response?.type === 'error') {
      console.error('OAuth error:', response.error);
      toast.error('Google sign in was cancelled or failed. Please try again.');
    }
  }, [response, signInWithGoogle]);

  const widthRatio = width / 393;
  const logoSize = Math.max(Math.min(60 * widthRatio, 80), 50);
  const horizontalPadding = Math.max(
    Math.min(SPACING.ONBOARDING_CONTENT_PADDING * widthRatio, 36),
    SPACING.ONBOARDING_CONTENT_PADDING
  );
  const topPadding = Math.max(
    insets.top + SPACING.ONBOARDING_SECTION_SPACING * 2,
    SPACING.getOnboardingTopPadding(height) * 0.25
  );

  const handleGoogleSignIn = async () => {
    try {
      await promptAsync();
    } catch (error) {
      console.error('Error prompting Google auth:', error);
      toast.error('Failed to open Google sign in');
    }
  };

  return (
    <SafeAreaView className="dark:bg-screen_background flex-1 bg-background" edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View
        className="flex-1 items-start justify-center"
        style={{ paddingHorizontal: horizontalPadding, paddingTop: topPadding }}>
        <View className="mb-6 flex-row items-center">
          <View
            className="items-center justify-center rounded-xl bg-black dark:bg-black"
            style={{ width: logoSize, height: logoSize }}>
            <ReadspaceLogo size={logoSize} />
          </View>
          <Text className="text-primary_foreground dark:text-primary_foreground ml-4 font-figtree-medium text-4xl">
            readspace
          </Text>
        </View>

        <Text className="text-primary_foreground dark:text-primary_foreground font-geist-semibold text-[28px] leading-9">
          Your favorite interests, blogs, and news in a distraction-free inbox
        </Text>
      </View>

      <View
        className="items-center justify-center gap-3"
        style={{
          paddingBottom: Math.max(insets.bottom + 20, 40),
          paddingHorizontal: horizontalPadding,
        }}>
        <Button
          variant="primary"
          size="large"
          onPress={() => router.push('/(auth)/login')}
          leftIcon={<Monicon name="solar:letter-bold" size={20} color={COLORS.white} />}>
          Continue with Email
        </Button>

        <Button
          variant="secondary"
          size="large"
          onPress={handleGoogleSignIn}
          disabled={isLoading}
          leftIcon={
            !isLoading ? (
              <GoogleIcon size={20} color={isDark ? COLORS.dark.white : COLORS.light.black} />
            ) : undefined
          }>
          {isLoading ? (
            <ThreeDotsAnimation
              color={isDark ? COLORS.dark.secondary : COLORS.light.secondary}
              dotStyle={{ width: 6, height: 6, borderRadius: 6, marginLeft: 4 }}
            />
          ) : (
            'Continue with Google'
          )}
        </Button>
      </View>
    </SafeAreaView>
  );
}
