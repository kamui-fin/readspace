import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

export function useNetworkConnectivity() {
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkConnectivity = async () => {
      try {
        const isConnected = await Network.getNetworkStateAsync();
        if (isMounted) {
          setIsOnline(isConnected.isConnected ?? true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[NetworkConnectivity] Error checking connectivity:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkConnectivity();

    const subscription = Network.addNetworkStateListener((state) => {
      if (isMounted) {
        setIsOnline(state.isConnected ?? true);
      }
    });

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, []);

  return { isOnline, isLoading };
}
