import { useCallback, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';

/** Two presses of the same tab within this window count as a double tap. */
const DOUBLE_TAP_DELAY_MS = 300;

/**
 * Emits `bottom-tab-double-tap:<routeName>` when a tab is pressed twice quickly — the event the
 * Following list (scroll to top) and Discover (focus search) already listen for. Shared by the
 * native tab bar so screens don't care which tab bar is in use.
 */
export function useTabDoubleTap(): (routeName: string) => void {
  const lastTapRef = useRef<Record<string, number>>({});

  return useCallback((routeName: string) => {
    const now = Date.now();
    const last = lastTapRef.current[routeName];
    if (last && now - last < DOUBLE_TAP_DELAY_MS) {
      DeviceEventEmitter.emit(`bottom-tab-double-tap:${routeName}`);
    }
    lastTapRef.current[routeName] = now;
  }, []);
}
