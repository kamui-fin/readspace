"use client"

import { useState } from "react"
import { notFound } from "next/navigation"
import {
    SAMPLE_CODEX_DIGEST,
    SAMPLE_CODEX_DIGEST_HERO_HEAVY,
    SAMPLE_CODEX_DIGEST_IN_PROGRESS,
    SAMPLE_CODEX_DIGEST_QUIET,
    SAMPLE_CODEX_DIGEST_TEXT_ONLY,
    SAMPLE_CODEX_NOT_ENTITLED_AI_DISABLED,
    SAMPLE_CODEX_NOT_ENTITLED_PRO_RATE_LIMITED,
    SAMPLE_CODEX_NOT_ENTITLED_QUOTA,
} from "@readspace/shared"
import { CodexView } from "@/components/features/codex/CodexView"
import { CodexGenerating } from "@/components/features/codex/CodexGenerating"
import {
    CodexEmptyState,
    CodexFailedState,
    CodexNotEntitledState,
    CodexQuietDayState,
} from "@/components/features/codex/CodexStates"
import { cn } from "@/lib/utils"

type PreviewKey =
    | "busy"
    | "hero-heavy"
    | "text-only"
    | "quiet-day"
    | "generating"
    | "empty"
    | "skipped"
    | "failed"
    | "paywall-quota"
    | "paywall-pro-rate-limited"
    | "paywall-ai-off"

const OPTIONS: { key: PreviewKey; label: string }[] = [
    { key: "busy", label: "Busy day" },
    { key: "hero-heavy", label: "Image-rich (bento)" },
    { key: "text-only", label: "No images" },
    { key: "quiet-day", label: "Quiet day (0 clusters)" },
    { key: "generating", label: "Generating" },
    { key: "empty", label: "Empty" },
    { key: "skipped", label: "Skipped (no articles)" },
    { key: "failed", label: "Failed" },
    { key: "paywall-quota", label: "Paywall · out of digests" },
    { key: "paywall-pro-rate-limited", label: "Paywall · Pro rate limited" },
    { key: "paywall-ai-off", label: "Paywall · AI disabled" },
]

/**
 * Static preview of every Daily Digest state — no network. Build UI against this before wiring the
 * live route. Guarded to `next dev` only — a production build 404s here so the mock never ships
 * on `app.readspace.ai`. The guard is its own component so the inner hooks stay unconditional.
 */
export default function CodexPreviewPage() {
    if (process.env.NODE_ENV === "production") notFound()
    return <CodexPreview />
}

function CodexPreview() {
    const [key, setKey] = useState<PreviewKey>("busy")

    return (
        <div className="min-h-screen bg-background">
            <div className="sticky top-0 z-10 flex flex-wrap gap-1.5 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur">
                {OPTIONS.map((o) => (
                    <button
                        key={o.key}
                        type="button"
                        onClick={() => setKey(o.key)}
                        className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                            key === o.key
                                ? "bg-secondary text-secondary-foreground"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
            <Preview variant={key} />
        </div>
    )
}

function Preview({ variant }: { variant: PreviewKey }) {
    switch (variant) {
        case "busy":
            return <CodexView digest={SAMPLE_CODEX_DIGEST} />
        case "hero-heavy":
            return <CodexView digest={SAMPLE_CODEX_DIGEST_HERO_HEAVY} />
        case "text-only":
            return <CodexView digest={SAMPLE_CODEX_DIGEST_TEXT_ONLY} />
        case "quiet-day":
            return <CodexView digest={SAMPLE_CODEX_DIGEST_QUIET} />
        case "generating":
            return <CodexGenerating phase={SAMPLE_CODEX_DIGEST_IN_PROGRESS.progress_phase} />
        case "empty":
            return <CodexEmptyState />
        case "skipped":
            return <CodexQuietDayState />
        case "failed":
            return <CodexFailedState />
        case "paywall-quota":
            // The "See Pro" button opens the real UpgradeDialog (mounted in the protected
            // layout) — click through to see the full conversion modal.
            return (
                <CodexNotEntitledState
                    reason={SAMPLE_CODEX_NOT_ENTITLED_QUOTA.reason}
                    errorCode={SAMPLE_CODEX_NOT_ENTITLED_QUOTA.error_code}
                />
            )
        case "paywall-pro-rate-limited":
            return (
                <CodexNotEntitledState
                    reason={SAMPLE_CODEX_NOT_ENTITLED_PRO_RATE_LIMITED.reason}
                    errorCode={SAMPLE_CODEX_NOT_ENTITLED_PRO_RATE_LIMITED.error_code}
                />
            )
        case "paywall-ai-off":
            return (
                <CodexNotEntitledState
                    reason={SAMPLE_CODEX_NOT_ENTITLED_AI_DISABLED.reason}
                    errorCode={SAMPLE_CODEX_NOT_ENTITLED_AI_DISABLED.error_code}
                />
            )
        default:
            return null
    }
}
