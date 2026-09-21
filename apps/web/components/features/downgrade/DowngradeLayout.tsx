"use client"

import { Logo } from "@/components/ui/logo"
import {
    Stepper,
    StepperIndicator,
    StepperItem,
    StepperSeparator,
    StepperTitle,
    StepperTrigger,
} from "@/components/ui/stepper"
import { cn } from "@/lib/utils"
import { DISPLAY_SERIF } from "./constants"
import type { ReactNode } from "react"

interface DowngradeLayoutProps {
    /** Labels for every step, in order. */
    steps: string[]
    /** 1-based index of the current step. */
    step: number
    /** Jump back to an earlier (completed) step. */
    onStepSelect: (step: number) => void
    title: string
    subtitle?: ReactNode
    /** Widen the column for two-pane steps (the feed picker). */
    wide?: boolean
    children: ReactNode
    footer: ReactNode
}

/**
 * Editorial frame for the plan-downgrade flow: wordmark, a labelled stepper, a serif headline
 * (the flow speaks to the reader, so it reads rather than operates), content, and the actions
 * directly beneath it. Deliberately no close or skip affordance: the flow is the only way back
 * into the app until the user fits their plan again.
 */
export function DowngradeLayout({
    steps,
    step,
    onStepSelect,
    title,
    subtitle,
    wide,
    children,
    footer,
}: DowngradeLayoutProps) {
    return (
        <div className="min-h-dvh w-full bg-background">
            <div
                className={cn(
                    "mx-auto w-full px-4 sm:px-6 pt-6 pb-16 sm:pt-10",
                    wide ? "max-w-5xl" : "max-w-2xl"
                )}
            >
                <Logo iconSize={22} textSize="text-[15px]" />

                <Stepper
                    value={step}
                    onValueChange={(next) => next < step && onStepSelect(next)}
                    className="mt-10"
                    aria-label="Plan change progress"
                >
                    {steps.map((label, index) => {
                        const n = index + 1
                        return (
                            <StepperItem
                                key={label}
                                step={n}
                                disabled={n > step}
                                className="not-last:flex-1"
                            >
                                <StepperTrigger
                                    className="gap-2 rounded-md pr-1 disabled:opacity-100"
                                    aria-current={
                                        n === step ? "step" : undefined
                                    }
                                >
                                    <StepperIndicator className="size-6 text-[11px] tabular-nums data-[state=inactive]:bg-transparent data-[state=inactive]:border data-[state=inactive]:border-border" />
                                    <StepperTitle
                                        className={cn(
                                            "text-[13px] whitespace-nowrap transition-colors",
                                            n === step
                                                ? "text-foreground"
                                                : "hidden sm:block text-muted-foreground font-normal"
                                        )}
                                    >
                                        {label}
                                    </StepperTitle>
                                </StepperTrigger>
                                {n < steps.length && (
                                    <StepperSeparator className="mx-3 h-px! bg-border group-data-[state=completed]/step:bg-primary transition-colors duration-500" />
                                )}
                            </StepperItem>
                        )
                    })}
                </Stepper>

                {/* Keyed by step so each step settles in with one short, shared motion */}
                <main
                    key={step}
                    className="mt-12 sm:mt-14 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-1 duration-300 ease-out"
                >
                    <h1
                        className="text-[2.5rem] sm:text-[3.25rem] font-normal leading-[1.02] tracking-[-0.012em] text-foreground text-balance"
                        style={{ fontFamily: DISPLAY_SERIF }}
                    >
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-muted-foreground text-pretty">
                            {subtitle}
                        </p>
                    )}

                    <div className="mt-10">{children}</div>

                    <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {footer}
                    </div>
                </main>
            </div>
        </div>
    )
}
