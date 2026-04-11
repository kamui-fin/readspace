import 'global.css';
import { SessionProvider, useSession } from '@contexts/auth-context';
import { ThemeProvider } from '@contexts/theme-provider';
import { ToastProvider } from '@contexts/toast-provider';
import {
  EBGaramond_400Regular,
  EBGaramond_400Regular_Italic,
  EBGaramond_500Medium,
  EBGaramond_500Medium_Italic,
  EBGaramond_600SemiBold,
  EBGaramond_600SemiBold_Italic,
  EBGaramond_700Bold,
  EBGaramond_700Bold_Italic,
} from '@expo-google-fonts/eb-garamond';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
  GeistMono_700Bold,
} from '@expo-google-fonts/geist-mono';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { COLORS } from '@lib/constants/colors';
import { useThemeStore } from '@stores/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import clsx from 'clsx';
import * as Font from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import '@lib/api-client';
import { configureApiClient } from '@lib/api-client';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function RootLayout() {
  // Configure API client on app startup
  useEffect(() => {
    configureApiClient();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { session, isLoading: isAuthLoading, isNewSignup } = useSession();
  const segments = useSegments();
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontError, setFontError] = useState<Error | null>(null);
  const getEffectiveColorScheme = useThemeStore((state) => state.getEffectiveColorScheme);
  const isDark = getEffectiveColorScheme() === 'dark';

  useEffect(() => {
    async function loadFonts() {
      try {
        // Load critical fonts first (Geist - primary UI font)
        await Font.loadAsync({
          Geist_400Regular,
          Geist_500Medium,
          Geist_600SemiBold,
          Geist_700Bold,
        });

        // Load remaining fonts in parallel after critical fonts are loaded
        await Promise.all([
          Font.loadAsync({
            GeistMono_400Regular,
            GeistMono_500Medium,
            GeistMono_600SemiBold,
            GeistMono_700Bold,
          }),
          Font.loadAsync({
            Figtree_400Regular,
            Figtree_500Medium,
            Figtree_600SemiBold,
            Figtree_700Bold,
          }),
          Font.loadAsync({
            EBGaramond_400Regular,
            EBGaramond_500Medium,
            EBGaramond_600SemiBold,
            EBGaramond_700Bold,
            EBGaramond_400Regular_Italic,
            EBGaramond_500Medium_Italic,
            EBGaramond_600SemiBold_Italic,
            EBGaramond_700Bold_Italic,
          }),
        ]);

        setFontsLoaded(true);
      } catch (e) {
        console.warn('Error loading fonts:', e);
        setFontError(e as Error);
      }
    }

    loadFonts();
  }, []);

  const router = useRouter();

  // Handle navigation based on auth state changes globally here
  useEffect(() => {
    if (isAuthLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inProtectedGroup = segments[0] === '(protected)';
    const isRoot = !segments.length || segments[0] === 'index';

    // Wait until router is mounted and navigation completes
    // Only redirect if user is in the wrong section, or they are stuck on the empty index placeholder
    if (!session && (inProtectedGroup || isRoot)) {
      // Not logged in but in protected area (or root) - redirect to auth
      router.replace('/(auth)');
    } else if (session && (inAuthGroup || isRoot)) {
      // Logged in but in auth area (or root) - redirect to protected area
      if (isNewSignup) {
        router.replace('/(protected)/onboarding');
      } else {
        router.replace('/(protected)/(tabs)');
      }
    }
  }, [session, segments, isAuthLoading, router, isNewSignup]);

  // Handle splash screen hiding
  useEffect(() => {
    if ((fontsLoaded || fontError) && !isAuthLoading) {
      const inAuthGroup = segments[0] === '(auth)';
      const inProtectedGroup = segments[0] === '(protected)';

      // Prevent hiding Splash Screen until the navigation finishes redirecting
      // to the appropriate group based on auth state
      if (session && !inProtectedGroup) return;
      if (!session && !inAuthGroup) return;

      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isAuthLoading, session, segments]);

  // Prevent rendering until the fonts have loaded (or errored)
  if (!fontsLoaded && !fontError) {
    return null;
  }

  const backgroundColor = isDark ? COLORS.dark.background : COLORS.light.background;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} className={clsx(isDark && 'dark')}>
      <KeyboardProvider>
        <BottomSheetModalProvider>
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(protected)" />
              <Stack.Screen name="(auth)" />
            </Stack>
          </ToastProvider>
        </BottomSheetModalProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
