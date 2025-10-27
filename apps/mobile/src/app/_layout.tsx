import { useFonts } from '@/hooks/useFonts';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Toaster } from 'sonner-native';
import '../../global.css';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

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
      <BottomSheetModalProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
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
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
