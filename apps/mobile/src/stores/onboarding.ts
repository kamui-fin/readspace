import { create } from 'zustand';

export interface OnboardingData {
    selectedCategories?: string[];
    followedFeeds?: string[];
}

interface OnboardingStore {
    currentStep: number;
    totalSteps: number;
    onboardingData: OnboardingData;
    updateOnboardingData: (data: Partial<OnboardingData>) => void;
    nextStep: () => void;
    prevStep: () => void;
    goToStep: (step: number) => void;
    resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
    currentStep: 1,
    totalSteps: 2,
    onboardingData: {
        selectedCategories: [],
        followedFeeds: [],
    },

    updateOnboardingData: (data) =>
        set((state) => ({
            onboardingData: { ...state.onboardingData, ...data },
        })),

    nextStep: () =>
        set((state) => ({
            currentStep:
                state.currentStep < state.totalSteps ? state.currentStep + 1 : state.currentStep,
        })),

    prevStep: () =>
        set((state) => ({
            currentStep: state.currentStep > 1 ? state.currentStep - 1 : state.currentStep,
        })),

    goToStep: (step) =>
        set(() => ({
            currentStep: step >= 1 && step <= 2 ? step : 1,
        })),

    resetOnboarding: () =>
        set(() => ({
            currentStep: 1,
            onboardingData: {
                selectedCategories: [],
                followedFeeds: [],
            },
        })),
}));
