import { useFonts } from '@/hooks/useFonts';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';
import '../../global.css';
import { AuthProvider, AuthQueryManager, useAuth } from '@/contexts/AuthProvider';
import { useColorScheme } from 'nativewind';
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
    const { colorScheme } = useColorScheme();

    useEffect(() => {
        if (loading) return;

        const inAuthGroup = segments[0] === '(tabs)';
        const inOnboarding = segments[0] === 'onboarding';

        if (!isAuthenticated && inAuthGroup) {
            // Redirect to welcome if trying to access protected routes
            router.replace('/welcome');
        } else if (isAuthenticated && (segments[0] === 'welcome' || inOnboarding)) {
            // Redirect to tabs if authenticated and on welcome/onboarding
            router.replace('/(tabs)');
        }
    }, [isAuthenticated, segments, loading]);

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
                </ThemeProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
