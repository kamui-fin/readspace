"use client"

import { ArrowRightIcon } from "lucide-react"
import React, { useState } from "react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export interface OnboardingStep {
    title: string
    description: string | React.ReactNode
    image?: {
        src: string
        width?: number
        height?: number
        alt: string
    }
}

interface OnboardingProps {
    steps: OnboardingStep[]
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onComplete?: () => void
    onSkip?: () => void
    className?: string
    dialogClassName?: string
    showProgress?: boolean
    skipButtonText?: string
    nextButtonText?: string
    completeButtonText?: string
}

export function Onboarding({
    steps,
    trigger,
    open,
    onOpenChange,
    onComplete,
    onSkip,
    className,
    dialogClassName,
    showProgress = true,
    skipButtonText = "Skip",
    nextButtonText = "Next",
    completeButtonText = "Okay",
}: OnboardingProps) {
    const [step, setStep] = useState(1)
    const totalSteps = steps.length

    const handleContinue = () => {
        if (step < totalSteps) {
            setStep(step + 1)
        } else {
            onComplete?.()
        }
    }

    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) {
            setStep(1)
        }
        onOpenChange?.(isOpen)
    }

    const currentStep = steps[step - 1]

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent
                className={cn(
                    "gap-0 p-0 pt-4 [&>button:last-child]:text-white",
                    dialogClassName
                )}
            >
                {currentStep.image && (
                    <div className="p-2">
                        <img
                            className="rounded-md max-h-[400px] object-cover"
                            src={currentStep.image.src}
                            width={currentStep.image.width}
                            height={currentStep.image.height}
                            alt={currentStep.image.alt}
                        />
                    </div>
                )}
                <div className={cn("space-y-6 px-6 pt-3 pb-6", className)}>
                    <DialogHeader>
                        <DialogTitle>{currentStep.title}</DialogTitle>
                        <DialogDescription>
                            {currentStep.description}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        {showProgress && (
                            <div className="flex justify-center space-x-1.5 max-sm:order-1">
                                {[...Array(totalSteps)].map((_, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "bg-primary size-1.5 rounded-full",
                                            index + 1 === step
                                                ? "bg-primary"
                                                : "opacity-20"
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={onSkip}
                                >
                                    {skipButtonText}
                                </Button>
                            </DialogClose>
                            {step < totalSteps ? (
                                <Button
                                    className="group"
                                    type="button"
                                    onClick={handleContinue}
                                >
                                    {nextButtonText}
                                    <ArrowRightIcon
                                        className="-me-1 opacity-60 transition-transform group-hover:translate-x-0.5"
                                        size={16}
                                        aria-hidden="true"
                                    />
                                </Button>
                            ) : (
                                <DialogClose asChild>
                                    <Button type="button" onClick={onComplete}>
                                        {completeButtonText}
                                    </Button>
                                </DialogClose>
                            )}
                        </DialogFooter>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
