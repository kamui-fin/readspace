import { Google, ReadspaceLogo } from '@components/icons/svg';
import { Button } from '@components/ui/button';
import { Text } from '@components/ui/text';
import { ThreeDotsAnimation } from '@components/ui/three-dots';
import { toast } from '@components/ui/toast';
import { useSession } from '@contexts/auth-context';
import { useGoogleAuth } from '@hooks/useGoogleAuth';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { SPACING } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';
import { useSettingsStore } from '@stores/settings';
import { LetterIcon } from '@solar-icons/react-native/bold';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text as RNText, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isDark = useIsDarkMode();
  const { signInWithGoogle } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [hasSignedIn, setHasSignedIn] = useState(false);
  const { settings, resetToCloud } = useSettingsStore();

  // TODO: Replace with your actual Google OAuth client ID
  // You'll need to provide this from your environment variables

  // Debug: Log the client IDs
  useEffect(() => {
    console.log('==========================================');
    console.log('Google OAuth Configuration:');
    console.log('iOS Client ID:', process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
    console.log('Android Client ID:', process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
    console.log('==========================================');
  }, []);

  const { response, promptAsync } = useGoogleAuth({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    // Web client ID is typically used for backend token validation
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success' && !hasSignedIn) {
      // expo-auth-session/providers/google returns tokens in response.authentication or response.params
      const { id_token } = response.params;
      const { accessToken } = response.authentication || {};

      // Use id_token from params or authentication object
      const token = id_token || response.authentication?.idToken;

      if (token) {
        setHasSignedIn(true);
        setIsLoading(true);

        signInWithGoogle(token, accessToken || '')
          .then(() => {
            toast.success('Successfully signed in with Google');
          })
          .catch((error) => {
            console.error('Google sign in error:', error);
            setHasSignedIn(false);
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
  }, [response, signInWithGoogle, hasSignedIn]);

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
      if (settings.instance_type === 'self-hosted') {
        resetToCloud();
        toast.success('Switched to cloud for Google sign-in');
      }
      await promptAsync();
    } catch (error) {
      console.error('Error prompting Google auth:', error);
      toast.error('Failed to open Google sign in');
    }
  };

  const colors = COLORS[isDark ? 'dark' : 'light'];

  return (
    <View
      className="bg-screen flex-1"
      style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
      <View
        className="flex-1 items-start justify-center"
        style={{ paddingHorizontal: horizontalPadding, paddingTop: topPadding }}>
        <View className="mb-8 flex-row items-center">
          <View
            className="items-center justify-center overflow-hidden rounded-xl"
            style={{ width: logoSize, height: logoSize, backgroundColor: '#232222' }}>
            <ReadspaceLogo width={logoSize} height={logoSize} />
          </View>
          <Text className="text-primary-foreground font-figtree-semibold ml-4 text-4xl">
            readspace
          </Text>
        </View>

        <View>
          <Text className="text-grey2 font-figtree-medium text-[24px] leading-9 ">
            follow your favorite news, blogs, people in a{' '}
            <RNText
              className="font-figtree-semibold"
              style={{ color: isDark ? COLORS.dark.secondary : COLORS.light.secondary }}>
              calm
            </RNText>{' '}
            inbox.
          </Text>
        </View>
      </View>

      <View
        className="w-full items-center justify-center gap-3"
        style={{
          paddingBottom: Math.max(insets.bottom + 20, 40),
          paddingHorizontal: horizontalPadding,
        }}>
        <Button
          variant="primary"
          size="large"
          onPress={handleGoogleSignIn}
          disabled={isLoading}
          leftIcon={
            !isLoading ? (
              <Google width={20} height={20} color={COLORS.white} />
            ) : undefined
          }>
          {isLoading ? (
            <ThreeDotsAnimation
              color={COLORS.white}
              dotStyle={{ width: 6, height: 6, borderRadius: 6, marginLeft: 4 }}
            />
          ) : (
            'Continue with Google'
          )}
        </Button>

        <Button
          variant="secondary"
          size="large"
          onPress={() => router.push('/(auth)/login')}
          leftIcon={<LetterIcon size={20} color={isDark ? COLORS.dark.primary_foreground : COLORS.light.primary_foreground} />}>
          Continue with Email
        </Button>
      </View>
    </View>
  );
}
