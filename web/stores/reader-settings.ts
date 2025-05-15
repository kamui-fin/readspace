import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ReaderFontFamily = string

export type ReaderSettingsState = {
    fontSize: number
    fontFamily: ReaderFontFamily
    lineHeight: number
    marginSize: number
}

type Update = {
    updateFontSize: (fontSize: ReaderSettingsState["fontSize"]) => void
    updateFontFamily: (fontFamily: ReaderSettingsState["fontFamily"]) => void
    updateLineHeight: (lineHeight: ReaderSettingsState["lineHeight"]) => void
    updateMarginSize: (lineHeight: ReaderSettingsState["marginSize"]) => void
    setSettings: (settings: ReaderSettingsState) => void
}

const useReaderSettingsStore = create<ReaderSettingsState & Update>()(
    persist(
        (set, get) => ({
            fontSize: 27,
            fontFamily: "serif",
            lineHeight: 2,
            marginSize: 50,
            setSettings: (settings: Partial<ReaderSettingsState>) => {
                set({ ...settings })
            },
            updateFontSize: async (fontSize: number) => {
                set({ fontSize })
            },
            updateFontFamily: async (fontFamily: ReaderFontFamily) => {
                set({ fontFamily })
            },
            updateLineHeight: async (lineHeight: number) => {
                set({ lineHeight })
            },
            updateMarginSize: async (marginSize: number) => {
                set({ marginSize })
            },
        }),
        {
            name: "reader-settings", // name of the item in the storage (must be unique)
        }
    )
)

export default useReaderSettingsStore
