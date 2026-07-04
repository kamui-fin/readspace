import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface PreferencesState {
  openInBrowser: boolean;
}

interface PreferencesActions {
  setOpenInBrowser: (value: boolean) => void;
}

export type PreferencesStore = PreferencesState & PreferencesActions;

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      openInBrowser: false,

      setOpenInBrowser: (value) => set({ openInBrowser: value }),
    }),
    {
      name: 'readspace-preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);