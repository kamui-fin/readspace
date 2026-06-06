import { create } from 'zustand';

interface UpgradeDialogState {
  isOpen: boolean;
  title: string;
  description: string;
}

interface UpgradeDialogActions {
  open: (config?: { title?: string; description?: string }) => void;
  close: () => void;
}

export type UpgradeDialogStore = UpgradeDialogState & UpgradeDialogActions;

export const useUpgradeDialog = create<UpgradeDialogStore>((set) => ({
  isOpen: false,
  title: 'Upgrade to Pro',
  description: 'Unlock unlimited access to all features, including AI summaries and unlimited feed subscriptions.',

  open: (config) => {
    set({
      isOpen: true,
      title: config?.title ?? 'Upgrade to Pro',
      description: config?.description ?? 'Unlock unlimited access to all features, including AI summaries and unlimited feed subscriptions.',
    });
  },

  close: () => {
    set({ isOpen: false });
  },
}));
