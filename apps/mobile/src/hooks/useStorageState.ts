import { useEffect, useCallback, useReducer } from 'react';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({
  id: 'auth-storage',
});

type UseStateHook<T> = [[boolean, T | null], (value: T | null) => void];

function useAsyncState<T>(initialValue: [boolean, T | null] = [true, null]): UseStateHook<T> {
  return useReducer(
    (state: [boolean, T | null], action: T | null = null): [boolean, T | null] => [false, action],
    initialValue
  ) as UseStateHook<T>;
}

export async function setStorageItemAsync(key: string, value: string | null) {
  try {
    if (value === null) {
      storage.remove(key);
    } else {
      storage.set(key, value);
    }
  } catch (e) {
    console.error('MMKV storage error:', e);
  }
}

export function useStorageState(key: string): UseStateHook<string> {
  const [state, setState] = useAsyncState<string>();

  // Get
  useEffect(() => {
    try {
      const value = storage.getString(key);
      setState(value ?? null);
    } catch (e) {
      console.error('MMKV storage is unavailable:', e);
      setState(null);
    }
  }, [key]);

  // Set
  const setValue = useCallback(
    (value: string | null) => {
      setState(value);
      setStorageItemAsync(key, value);
    },
    [key]
  );

  return [state, setValue];
}
