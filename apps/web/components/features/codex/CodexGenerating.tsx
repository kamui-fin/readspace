"use client"

import { useEffect, useState } from "react"
import { parseISO } from "date-fns"
import humanizeDuration from "humanize-duration"
import { CheckCircleIcon, StarsIcon } from "@solar-icons/react/bold"
import { CodexDigestPhase } from "@readspace/shared"
import { cn } from "@/lib/utils"

/**
 * Compact elapsed-time formatter: `"12s"` under a minute, `"2m 5s"` above it, `"1h 4m"` once
 * it's dragged on (a stuck job across a reload). Keeps the two largest units so it never
 * balloons to "22 minutes, 31 seconds".
 */
const humanizeElapsed = humanizeDuration.humanizer({
    language: "shortEn",
    languages: {
        shortEn: {
            h: () => "h",
            m: () => "m",
            s: () => "s",
        },
    },
    delimiter: " ",
    spacer: "",
    units: ["h", "m", "s"],
    largest: 2,
    round: true,
})

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
    /** ISO `requested_at` from the digest row, so the timer reflects the real wait even
     *  across a reload. Falls back to mount time when absent. */
    requestedAt?: string | null
}

export function CodexGenerating({ phase, requestedAt }: CodexGeneratingProps) {
    const activeIndex = Math.max(
        0,
        PHASES.findIndex((p) => p.phase === phase)
    )
    const elapsed = useElapsedSeconds(requestedAt)

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
                    {elapsed >= 5 && (
                        <>
                            {" · "}
                            <span className="font-mono tabular-nums">
                                {humanizeElapsed(elapsed * 1000)}
                            </span>
                        </>
                    )}
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

/**
 * Wall-clock seconds since the job was requested (from the persisted `requested_at`), so a
 * reload mid-generation still shows the true wait. Falls back to mount time if the timestamp
 * is missing or clock skew puts it in the future.
 */
function useElapsedSeconds(requestedAt?: string | null): number {
    const [seconds, setSeconds] = useState(0)
    useEffect(() => {
        let start = Date.now()
        if (requestedAt) {
            const parsed = parseISO(requestedAt).getTime()
            if (Number.isFinite(parsed) && parsed <= Date.now()) start = parsed
        }
        const tick = () =>
            setSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)))
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [requestedAt])
    return seconds
}
