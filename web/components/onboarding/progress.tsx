import { useOnboardingStore } from "@/stores/onboarding"
import React from "react"

const OnboardingProgress: React.FC = () => {
    const { currentStep, totalSteps } = useOnboardingStore()
    const progress = (currentStep / totalSteps) * 100

    return (
        <div className="w-full max-w-lg mb-8">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className="h-1.5 bg-primary transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>
                    Step {currentStep} of {totalSteps}
                </span>
                <span>{Math.round(progress)}%</span>
            </div>
        </div>
    )
}

export default OnboardingProgress
