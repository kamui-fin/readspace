import { AuthProvider, AuthQueryManager, useAuth } from '@/contexts/AuthProvider';
import { useFonts } from '@/hooks/useFonts';
import { useSettingsStore } from '@/stores/settings';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Toaster } from 'sonner-native';
import '../../global.css';
// Import API client to initialize it
import '@/lib/api/client';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Create QueryClient instance
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2,
            staleTime: 5 * 60 * 1000,
        },
    },
});

function RootLayoutNav() {
    const { isAuthenticated, loading } = useAuth();
    const segments = useSegments();
    const router = useRouter();
    const { settings } = useSettingsStore();

    useEffect(() => {
        console.log('[RootLayoutNav] Auth state:', { isAuthenticated, loading, segments });

        if (loading) {
            console.log('[RootLayoutNav] Still loading, waiting...');
            return;
        }

        const inAuthGroup = segments[0] === '(tabs)';
        const inOnboarding = segments[0] === 'onboarding';
        const inFeedOnboarding = inOnboarding && segments[1] === 'feeds';

        console.log('[RootLayoutNav] Route check:', {
            inAuthGroup,
            inOnboarding,
            inFeedOnboarding,
            currentSegment: segments[0],
            instanceType: settings.instance_type
        });

        if (!isAuthenticated && inAuthGroup) {
            // Redirect to welcome if trying to access protected routes
            console.log('[RootLayoutNav] Not authenticated, redirecting to welcome');
            router.replace('/welcome');
        }
    }, [isAuthenticated, segments, loading, router]);

    return (
        <BottomSheetModalProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                }}>
                <Stack.Screen name="welcome" />
                <Stack.Screen name="(tabs)" />
            </Stack>
        </BottomSheetModalProvider>
    );
}

export default function RootLayout() {
    const { loaded, error } = useFonts();

    useEffect(() => {
        if (error) throw error;
    }, [error]);

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);

    if (!loaded) {
        return null;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
                <QueryClientProvider client={queryClient}>
                    <AuthQueryManager />
                    <RootLayoutNav />
                    <Toaster
                        position="top-center"
                        offset={48}
                        toastOptions={{
                            style: {
                                borderRadius: 8,
                                paddingHorizontal: 20,
                                paddingVertical: 16,
                                backgroundColor: '#F9F9F9',
                                shadowColor: '#959DA5',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.2,
                                shadowRadius: 4,
                                elevation: 2,
                            },
                            titleStyle: {
                                fontFamily: 'Geist_500Medium',
                                fontSize: 15,
                                color: '#232222',
                            },
                            descriptionStyle: {
                                fontFamily: 'Geist_400Regular',
                                fontSize: 14,
                                color: '#90988B',
                            },
                        }}
                    />
                </QueryClientProvider>
            </AuthProvider>
        </GestureHandlerRootView>
    );
}
