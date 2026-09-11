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
import { LetterIcon } from '@solar-icons/react-native/bold';
import { useSettingsStore } from '@stores/settings';
import * as AppleAuthentication from 'expo-apple-authentication';
import { BlurView } from 'expo-blur';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Text as RNText, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isDark = useIsDarkMode();
  const { signInWithGoogle, signInWithApple } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(Platform.OS === 'ios');
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

  useEffect(() => {
    // isAvailableAsync() resolves false on Android and on iOS devices/OS
    // versions that don't support Apple sign-in — safer than trusting
    // Platform.OS alone, per Expo's docs on gating the button.
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable);
  }, []);

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

  const handleAppleSignIn = async () => {
    try {
      if (settings.instance_type === 'self-hosted') {
        resetToCloud();
        toast.success('Switched to cloud for Apple sign-in');
      }
      setIsAppleLoading(true);

      // Apple requires the nonce passed to its native request to be a SHA-256
      // hash; Supabase then verifies the raw nonce against the hash embedded
      // in the identity token's `nonce` claim, so both values must be sent.
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error('No identity token returned from Apple.');
      }

      // Apple only includes the user's name on the very first authorization —
      // every later sign-in returns null here, so we must capture it now.
      await signInWithApple(credential.identityToken, rawNonce, credential.fullName);
      toast.success('Successfully signed in with Apple');
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled the sign-in flow — no toast needed
      } else {
        console.error('Apple sign in error:', error);
        toast.error('Unable to sign in with Apple. Please try again.');
      }
    } finally {
      setIsAppleLoading(false);
    }
  };

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
        {isAppleAvailable && (
          // Apple's own ASAuthorizationAppleIDButton — required verbatim by the
          // App Store Human Interface Guidelines (only WHITE/WHITE_OUTLINE/BLACK
          // are approved button styles). A custom-styled button here is a real
          // App Store rejection risk under Guideline 4.8, so this can't be
          // restyled to match the Button component beyond buttonStyle/cornerRadius.
          <View
            className="w-full"
            style={{ opacity: isAppleLoading ? 0.6 : 1 }}
            pointerEvents={isAppleLoading ? 'none' : 'auto'}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                isDark
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={28}
              style={{ width: '100%', height: 56 }}
              onPress={handleAppleSignIn}
            />
          </View>
        )}

        <Button
          variant="primary"
          size="large"
          onPress={handleGoogleSignIn}
          disabled={isLoading}
          leftIcon={
            !isLoading ? <Google width={20} height={20} color={COLORS.white} /> : undefined
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
          leftIcon={
            <LetterIcon
              size={20}
              color={isDark ? COLORS.dark.primary_foreground : COLORS.light.primary_foreground}
            />
          }>
          Continue with Email
        </Button>
      </View>
    </View>
  );
}
