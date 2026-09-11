"use client"

import { CheckCircleIcon, StarsIcon } from "@solar-icons/react/bold"
import { CodexDigestPhase } from "@readspace/shared"
import { cn } from "@/lib/utils"

/**
 * Ordered phases with display copy. `gathering` is typically sub-second and easy to miss;
 * `triaging` and `synthesizing` (the two Gemini calls) dominate wall-clock time, `reading`
 * scales with cluster count. The skeleton must not assume a minimum dwell time per phase.
 */
const PHASES: { phase: CodexDigestPhase; label: string }[] = [
    { phase: CodexDigestPhase.GATHERING, label: "Reading your feeds" },
    { phase: CodexDigestPhase.TRIAGING, label: "Finding the patterns" },
    { phase: CodexDigestPhase.READING, label: "Reading the full stories" },
    { phase: CodexDigestPhase.SYNTHESIZING, label: "Writing your digest" },
]

interface CodexGeneratingProps {
    /** Null before the worker picks the task up — treated as the first phase. */
    phase: CodexDigestPhase | null
}

export function CodexGenerating({ phase }: CodexGeneratingProps) {
    const activeIndex = Math.max(
        0,
        PHASES.findIndex((p) => p.phase === phase)
    )

    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16">
            {/* One column, one left edge — the mark centers over it, everything else hangs
                from the same rule so the block reads aligned, not scattered. */}
            <div className="flex w-full max-w-xs flex-col items-center">
                <div className="mb-6 flex size-11 items-center justify-center rounded-full bg-secondary/10 motion-safe:animate-[thin-pulse_2s_ease-in-out_infinite]">
                    <StarsIcon className="size-5 text-secondary" />
                </div>

                <h1 className="text-center text-lg font-semibold text-foreground">
                    Building your Daily Digest
                </h1>
                <p className="mt-1 text-center text-sm text-muted-foreground">
                    This usually takes under a minute
                </p>

                {/* Centered as a block; items keep a single left edge so the checklist reads
                    as one aligned column under the centered heading. */}
                <ol className="mt-8 w-fit space-y-3.5">
                    {PHASES.map((p, i) => {
                        const done = i < activeIndex
                        const active = i === activeIndex
                        return (
                            <li
                                key={p.phase}
                                className="flex items-center gap-3 text-sm"
                            >
                                {done ? (
                                    <CheckCircleIcon className="size-5 shrink-0 text-secondary/70" />
                                ) : (
                                    <span
                                        className={cn(
                                            "flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold leading-none tabular-nums",
                                            active
                                                ? "border-secondary text-secondary"
                                                : "border-border text-muted-foreground/40"
                                        )}
                                    >
                                        {i + 1}
                                    </span>
                                )}
                                <span
                                    className={cn(
                                        "leading-none",
                                        active &&
                                            "font-medium text-foreground motion-safe:animate-[shimmer_2.4s_linear_infinite] motion-safe:bg-[linear-gradient(100deg,hsl(var(--muted-foreground))_35%,hsl(var(--foreground))_50%,hsl(var(--muted-foreground))_65%)] motion-safe:bg-[length:200%_100%] motion-safe:bg-clip-text motion-safe:text-transparent",
                                        !active &&
                                            done &&
                                            "text-muted-foreground",
                                        !active &&
                                            !done &&
                                            "text-muted-foreground/40"
                                    )}
                                >
                                    {p.label}
                                </span>
                            </li>
                        )
                    })}
                </ol>
            </div>
        </div>
    )
}
