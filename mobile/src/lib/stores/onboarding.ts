import { create } from "zustand";

interface OnboardingState {
	step: number;
	nextStep: () => void;
	prevStep: () => void;
	reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
	step: 1,
	nextStep: () => set((state) => ({ step: state.step + 1 })),
	prevStep: () => set((state) => ({ step: state.step - 1 })),
	reset: () => set({ step: 1 }),
}));
