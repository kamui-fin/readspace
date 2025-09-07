"use client"

import { useOnboardingStore } from "@/stores/onboarding"
import React from "react"
import StepOne from "./steps/StepOne"
import StepTwo from "./steps/StepTwo"

const Onboarding: React.FC = () => {
    const currentStep = useOnboardingStore((state) => state.currentStep)

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <StepOne />
            case 2:
                return <StepTwo />
            default:
                return <StepOne />
        }
    }

    return <div className="min-h-screen">{renderStep()}</div>
}

export default Onboarding
