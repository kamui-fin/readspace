import {
  READER_DEFAULT_FONT_SIZE_INDEX,
  READER_FONT_SIZES,
  type ReaderFontFamily,
  type ReaderLineHeight,
} from '@lib/constants/reader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ReaderPreferencesState {
  /** Index into READER_FONT_SIZES, not a px value — the scale can change. */
  fontSizeIndex: number;
  fontFamily: ReaderFontFamily;
  lineHeight: ReaderLineHeight;
}

interface ReaderPreferencesActions {
  setFontSizeIndex: (index: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  setFontFamily: (family: ReaderFontFamily) => void;
  setLineHeight: (lineHeight: ReaderLineHeight) => void;
  reset: () => void;
}

export type ReaderPreferencesStore = ReaderPreferencesState & ReaderPreferencesActions;

const initialState: ReaderPreferencesState = {
  fontSizeIndex: READER_DEFAULT_FONT_SIZE_INDEX,
  fontFamily: 'serif',
  lineHeight: 'normal',
};

const clampFontSizeIndex = (index: number) =>
  Math.min(Math.max(index, 0), READER_FONT_SIZES.length - 1);

export const useReaderPreferences = create<ReaderPreferencesStore>()(
  persist(
    (set) => ({
      ...initialState,

      setFontSizeIndex: (index) => set({ fontSizeIndex: clampFontSizeIndex(index) }),
      increaseFontSize: () =>
        set((state) => ({ fontSizeIndex: clampFontSizeIndex(state.fontSizeIndex + 1) })),
      decreaseFontSize: () =>
        set((state) => ({ fontSizeIndex: clampFontSizeIndex(state.fontSizeIndex - 1) })),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      reset: () => set(initialState),
    }),
    {
      name: 'readspace-reader-preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
