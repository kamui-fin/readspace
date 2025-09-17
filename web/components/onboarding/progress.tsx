import { useOnboardingStore } from "@/stores/onboarding"
import React from "react"

const OnboardingProgress: React.FC = () => {
    const { currentStep, totalSteps } = useOnboardingStore()

    return (
        <div className="w-full max-w-lg mb-8 mx-auto">
            <div className="flex items-center justify-center gap-3 mb-4">
                {Array.from({ length: totalSteps }).map((_, index) => {
                    const stepNumber = index + 1
                    const isActive = stepNumber === currentStep
                    const isCompleted = stepNumber < currentStep

                    return (
                        <div key={stepNumber} className="flex items-center">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                                    isCompleted
                                        ? "bg-primary text-primary-foreground"
                                        : isActive
                                          ? "bg-accent text-accent-foreground"
                                          : "bg-gray-100 text-muted-foreground"
                                }`}
                            >
                                {isCompleted ? "✓" : stepNumber}
                            </div>
                            {stepNumber < totalSteps && (
                                <div
                                    className={`w-12 h-0.5 mx-2 transition-all duration-300 ${
                                        isCompleted
                                            ? "bg-primary"
                                            : "bg-gray-200"
                                    }`}
                                />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default OnboardingProgress
