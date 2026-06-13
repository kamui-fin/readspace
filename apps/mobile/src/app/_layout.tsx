import 'global.css';
import { SessionProvider, useSession } from '@contexts/auth-context';
import { RevenueCatProvider } from '@contexts/revenuecat-context';
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
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { ApiError } from '@readspace/shared';
import * as Sentry from '@sentry/react-native';
import { useThemeStore } from '@stores/theme';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import clsx from 'clsx';
import * as Font from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import '@lib/api-client';
import { UpgradePaywallModal } from '@components/bottom-sheets/upgrade';
import { configureApiClient } from '@lib/api-client';
import { useUpgradeDialog } from '@stores/upgrade-dialog';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

Sentry.init({
  dsn: 'https://71c98634e6904ab52224714c8664fec9@o4511544654036992.ingest.us.sentry.io/4511544655609856',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const handleGlobalError = (error: unknown) => {
  if (error instanceof ApiError && error.status === 429) {
    useUpgradeDialog.getState().open({
      title: 'Upgrade to Readspace Pro',
      description: error.message || 'You have reached a limit on your current plan.',
    });
  }
};

// Create QueryClient instance
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleGlobalError,
  }),
  mutationCache: new MutationCache({
    onError: handleGlobalError,
  }),
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function RootLayout() {
  // Configure API client on app startup
  useEffect(() => {
    configureApiClient();
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SessionProvider>
            <RevenueCatProvider>
              <RootNavigator />
            </RevenueCatProvider>
          </SessionProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, isLoading: isAuthLoading, isNewSignup } = useSession();
  const segments = useSegments();
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontError, setFontError] = useState<Error | null>(null);
  const isDark = useIsDarkMode();
  const isHydrated = useThemeStore((state) => state.isHydrated);

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
    const isRedirectRoute = segments[0] === 'oauthredirect' || segments[0] === 'oauth2redirect';

    // Wait until router is mounted and navigation completes
    // Only redirect if user is in the wrong section, or they are stuck on the empty index placeholder
    if (!session && (inProtectedGroup || isRoot || isRedirectRoute)) {
      // Not logged in but in protected area (or root) - redirect to auth
      router.replace('/(auth)');
    } else if (session && (inAuthGroup || isRoot || isRedirectRoute)) {
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
    if ((fontsLoaded || fontError) && !isAuthLoading && isHydrated) {
      const inAuthGroup = segments[0] === '(auth)';
      const inProtectedGroup = segments[0] === '(protected)';

      // Prevent hiding Splash Screen until the navigation finishes redirecting
      // to the appropriate group based on auth state
      if (session && !inProtectedGroup) return;
      if (!session && !inAuthGroup) return;

      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isAuthLoading, session, segments, isHydrated]);

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
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack
              key={isDark ? 'dark' : 'light'}
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(protected)" />
              <Stack.Screen name="(auth)" />
            </Stack>
            <UpgradePaywallModal />
          </ToastProvider>
        </BottomSheetModalProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
