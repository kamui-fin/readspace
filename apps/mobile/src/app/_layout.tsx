import 'global.css';
import { SplashScreenController } from '@components/screens/splash';
import { SessionProvider } from '@contexts/auth-context';
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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Font from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// Import API client to initialize it
import '@lib/api/client';
import { configureApiClient } from '@lib/api/config';

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
      <SessionProvider>
        <SplashScreenController />
        <RootNavigator />
      </SessionProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontError, setFontError] = useState<Error | null>(null);

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
      } finally {
        // Hide splash screen after fonts are loaded
        await SplashScreen.hideAsync();
      }
    }

    loadFonts();
  }, []);

  // Prevent rendering until the fonts have loaded (or errored)
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(protected)" />
            <Stack.Screen name="(auth)" />
          </Stack>
        </ToastProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
