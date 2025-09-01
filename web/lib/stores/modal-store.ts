import { create } from 'zustand'

interface ModalStore {
  isFolderModalOpen: boolean
  openFolderModal: () => void
  closeFolderModal: () => void
}

export const useModalStore = create<ModalStore>((set) => ({
  isFolderModalOpen: false,
  openFolderModal: () => set({ isFolderModalOpen: true }),
  closeFolderModal: () => set({ isFolderModalOpen: false }),
}))