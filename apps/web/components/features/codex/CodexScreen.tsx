"use client"

import { useCallback, useState, type ReactNode } from "react"
import { toast } from "react-hot-toast"
import {
    CodexDigestStatus,
    isCodexNotEntitled,
    useCodexToday,
    useGenerateCodexDigest,
} from "@readspace/shared"
import { CodexView } from "./CodexView"
import { CodexGenerating } from "./CodexGenerating"
import { CodexSettingsDialog } from "./CodexSettingsDialog"
import { CodexSkeleton } from "./CodexSkeleton"
import {
    CodexEmptyState,
    CodexFailedState,
    CodexNotEntitledState,
    CodexQuietDayState,
} from "./CodexStates"

/**
 * Live Daily Digest route. Fetches the latest digest, polls while it generates (the hook stops on a
 * terminal status), and renders per state. Generation is idempotent server-side.
 *
 * The folder-scope settings gear is anchored at this level, above the per-state content, so it's
 * reachable on every state — including the first-run empty state, before a digest has ever been
 * built.
 */
export function CodexScreen() {
    const { data: digest, isLoading, error } = useCodexToday()
    const generate = useGenerateCodexDigest()
    /** A not-entitled 202 isn't an error and isn't a digest — hold it so we can render the
     *  full state (reset date, upgrade path) rather than a toast that leaves a dead end. */
    const [notEntitled, setNotEntitled] = useState<{
        reason: string
        errorCode: string
    } | null>(null)

    const handleGenerate = useCallback(async () => {
        try {
            const result = await generate.mutateAsync(undefined)
            if (isCodexNotEntitled(result)) {
                setNotEntitled({
                    reason: result.reason,
                    errorCode: result.error_code,
                })
            }
        } catch {
            toast.error("Couldn't start your Daily Digest. Please try again.")
        }
    }, [generate])

    let content: ReactNode
    if (isLoading) {
        content = <CodexSkeleton />
    } else if (notEntitled) {
        content = (
            <CodexNotEntitledState
                reason={notEntitled.reason}
                errorCode={notEntitled.errorCode}
            />
        )
    } else if (error) {
        // A hard error on the poll itself (not a 404 — the hook maps that to null).
        content = (
            <CodexFailedState
                onGenerate={handleGenerate}
                isGenerating={generate.isPending}
                connectionLost
            />
        )
    } else if (!digest) {
        content = (
            <CodexEmptyState
                onGenerate={handleGenerate}
                isGenerating={generate.isPending}
            />
        )
    } else if (
        digest.status === CodexDigestStatus.PENDING ||
        digest.status === CodexDigestStatus.IN_PROGRESS
    ) {
        content = (
            <CodexGenerating
                phase={digest.progress_phase}
                requestedAt={digest.requested_at}
            />
        )
    } else if (digest.status === CodexDigestStatus.SKIPPED) {
        content = (
            <CodexQuietDayState
                onGenerate={handleGenerate}
                isGenerating={generate.isPending}
            />
        )
    } else if (digest.status === CodexDigestStatus.FAILED) {
        content = (
            <CodexFailedState
                onGenerate={handleGenerate}
                isGenerating={generate.isPending}
            />
        )
    } else if (digest.status === CodexDigestStatus.COMPLETED) {
        content = digest.payload ? (
            <CodexView digest={digest} />
        ) : (
            <CodexQuietDayState
                onGenerate={handleGenerate}
                isGenerating={generate.isPending}
            />
        )
    } else {
        content = (
            <CodexNotEntitledState
                reason="This digest is in an unexpected state."
                errorCode="UNKNOWN"
            />
        )
    }

    return (
        <div className="relative">
            {/* The gear is a small fixed-size control pinned to the top-right corner; it only
                overlaps the masthead's own right padding, so nothing underneath needs to stay
                clickable through it. Offsets mirror the digest's horizontal gutters. */}
            <div className="absolute right-4 top-4 z-10 sm:right-6 lg:right-8">
                <CodexSettingsDialog />
            </div>
            {content}
        </div>
    )
}
