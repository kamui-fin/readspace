import { create } from "zustand"

type SidebarModalsState = {
    isFeedModalOpen: boolean
    setIsFeedModalOpen: (open: boolean) => void
    selectedFolderId: string | null
    setSelectedFolderId: (id: string | null) => void
    isFolderModalOpen: boolean
    setIsFolderModalOpen: (open: boolean) => void
}

export const useSidebarModals = create<SidebarModalsState>((set) => ({
    isFeedModalOpen: false,
    setIsFeedModalOpen: (open) => set({ isFeedModalOpen: open }),
    selectedFolderId: null,
    setSelectedFolderId: (id) => set({ selectedFolderId: id }),
    isFolderModalOpen: false,
    setIsFolderModalOpen: (open) => set({ isFolderModalOpen: open }),
}))
