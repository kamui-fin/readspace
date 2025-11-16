/** biome-ignore-all assist/source/organizeImports: false positive */
import { router } from 'expo-router';
import { View, Text, StatusBar, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Monicon } from '@monicon/native';

import { Button } from '@components/ui/button';
import { GoogleIcon } from '@components/icons/google';
import { ReadspaceLogo } from '@components/icons/readspace-logo';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDark = useIsDarkMode();

  // Responsive calculations
  const baseWidth = 393;
  const widthRatio = width / baseWidth;
  const logoSize = Math.max(Math.min(60 * widthRatio, 80), 50);
  const horizontalPadding = Math.max(Math.min(24 * widthRatio, 32), 20);

  return (
    <SafeAreaView className="dark:bg-screen_background flex-1 bg-background" edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Main Content */}
      <View
        className="flex-1 items-start justify-center"
        style={{ paddingHorizontal: horizontalPadding }}>
        {/* Logo and Brand */}
        <View className="mb-6 flex-row items-center">
          <View
            className="items-center justify-center rounded-2xl bg-black dark:bg-black"
            style={{ width: logoSize, height: logoSize }}>
            <ReadspaceLogo size={logoSize} />
          </View>
          <Text className="text-primary_foreground dark:text-primary_foreground ml-4 font-figtree-medium text-4xl">
            readspace
          </Text>
        </View>

        {/* Tagline */}
        <Text className="text-primary_foreground dark:text-primary_foreground font-geist-semibold text-[28px] leading-9">
          Your favorite interests, blogs, and news in a distraction-free inbox
        </Text>
      </View>

      {/* Footer with Buttons */}
      <View
        className="items-center justify-center gap-3"
        style={{
          paddingBottom: Math.max(insets.bottom + 20, 40),
          paddingHorizontal: horizontalPadding,
        }}>
        {/* Continue with Email Button */}
        <Button
          variant="primary"
          size="large"
          onPress={() => router.push('/(auth)/login')}
          leftIcon={<Monicon name="solar:letter-bold" size={20} color={COLORS.white} />}>
          Continue with Email
        </Button>

        {/* Continue with Google Button */}
        <Button
          variant="secondary"
          size="large"
          onPress={() => {
            // TODO: Implement Google Sign In
            console.log('Google sign in pressed');
          }}
          leftIcon={
            <GoogleIcon size={20} color={isDark ? COLORS.dark.white : COLORS.light.black} />
          }>
          Continue with Google
        </Button>
      </View>
    </SafeAreaView>
  );
}
