import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export interface KeyboardContextValue {
  keyboardHeight: SharedValue<number>;
  isKeyboardVisible: SharedValue<boolean>;
  keyboardProgress: SharedValue<number>;
}

export const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function useKeyboardContext() {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboardContext must be used within a KeyboardProvider');
  }
  return context;
}
