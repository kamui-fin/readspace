import { GOOGLE_WEB_CLIENT_ID } from '@/constants/Config';
import { AuthProvider, AuthQueryManager, useAuth } from '@/contexts/AuthProvider';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { useFonts } from '@/hooks/useFonts';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';
import '../../global.css';
// Import API client to initialize it
import '@/lib/api/client';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Configure Google Sign-In
GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
});

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
    const { isAuthenticated, loading, needsOnboarding } = useAuth();
    const segments = useSegments();
    const router = useRouter();
    const { colorScheme } = useColorScheme();

    useEffect(() => {
        // Wait for both auth loading and onboarding status check
        if (loading || (isAuthenticated && needsOnboarding === null)) {
            console.log('[RootLayoutNav] Waiting for auth/onboarding status:', {
                loading,
                isAuthenticated,
                needsOnboarding,
            });
            return;
        }

        const inAuthGroup = segments[0] === '(tabs)';
        const inOnboarding = segments[0] === 'onboarding';
        const onWelcome = segments[0] === 'welcome';

        console.log('[RootLayoutNav] Navigation check:', {
            isAuthenticated,
            needsOnboarding,
            currentSegment: segments[0],
            inAuthGroup,
            inOnboarding,
            onWelcome,
        });

        if (!isAuthenticated && inAuthGroup) {
            // Not authenticated but trying to access protected routes → redirect to welcome
            console.log('[RootLayoutNav] Redirecting to welcome (not authenticated)');
            router.replace('/welcome');
        } else if (isAuthenticated && needsOnboarding && !inOnboarding && onWelcome) {
            // Authenticated but needs onboarding and on welcome screen → redirect to onboarding
            // Only redirect from welcome screen to avoid navigation loops
            console.log('[RootLayoutNav] Redirecting to onboarding (needs onboarding from welcome)');
            router.replace('/onboarding/feeds/categories');
        } else if (isAuthenticated && !needsOnboarding && (onWelcome || inOnboarding)) {
            // Authenticated, doesn't need onboarding, but on welcome/onboarding → redirect to tabs
            // Exception: Don't redirect if on signup step-3 (email verification notice)
            const onEmailVerification = segments[0] === 'onboarding' && 
                                       segments[1] === 'signup' && 
                                       segments[2] === 'step-3';
            
            if (!onEmailVerification) {
                console.log('[RootLayoutNav] Redirecting to tabs (authenticated and onboarded)');
                router.replace('/(tabs)');
            }
        }
        // router is stable in Expo Router and doesn't need to be in deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, segments, loading, needsOnboarding]);

    return (
        <>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <BottomSheetModalProvider>
                <Stack
                    screenOptions={{
                        headerShown: false,
                    }}>
                    <Stack.Screen name="welcome" />
                    <Stack.Screen name="(tabs)" />
                </Stack>
            </BottomSheetModalProvider>
        </>
    );
}

export default function RootLayout() {
    const { loaded, error } = useFonts();
    const { colorScheme } = useColorScheme();

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
            <SafeAreaProvider>
                <ThemeProvider>
                    <AuthProvider>
                        <QueryClientProvider client={queryClient}>
                            <AuthQueryManager />
                            <RootLayoutNav />
                            <Toaster
                                theme={colorScheme === 'dark' ? 'dark' : 'light'}
                                position="top-center"
                                offset={48}
                                toastOptions={{
                                    style: {
                                        borderRadius: 8,
                                        paddingHorizontal: 20,
                                        paddingVertical: 16,
                                        backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#F9F9F9',
                                        shadowColor: colorScheme === 'dark' ? '#000000' : '#959DA5',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.2,
                                        shadowRadius: 4,
                                        elevation: 2,
                                    },
                                    titleStyle: {
                                        fontFamily: 'Geist_500Medium',
                                        fontSize: 15,
                                        color: colorScheme === 'dark' ? '#FFFFFF' : '#232222',
                                    },
                                    descriptionStyle: {
                                        fontFamily: 'Geist_400Regular',
                                        fontSize: 14,
                                        color: colorScheme === 'dark' ? '#A0A0A0' : '#90988B',
                                    },
                                }}
                            />
                        </QueryClientProvider>
                    </AuthProvider>
                </ThemeProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
