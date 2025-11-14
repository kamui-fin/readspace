import { SplashScreen } from 'expo-router';
import { useEffect } from 'react';

import { useSession } from '@contexts/auth-context';

SplashScreen.preventAutoHideAsync();

export function SplashScreenController() {
  const { isLoading } = useSession();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return null;
}
