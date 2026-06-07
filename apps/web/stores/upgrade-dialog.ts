import { create } from "zustand"

interface UpgradeDialogStore {
    isOpen: boolean
    title: string
    description: string
    open: (options: { title: string; description: string }) => void
    close: () => void
}

export const useUpgradeDialog = create<UpgradeDialogStore>((set) => ({
    isOpen: false,
    title: "Upgrade to Readspace Pro",
    description:
        "Unlock unlimited feeds, advanced AI features, and seamless syncing.",
    open: ({ title, description }) => set({ isOpen: true, title, description }),
    close: () => set({ isOpen: false }),
}))
