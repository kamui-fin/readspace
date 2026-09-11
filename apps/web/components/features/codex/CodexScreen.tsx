"use client"

import { useCallback, useState, type ReactNode } from "react"
import { toast } from "react-hot-toast"
import { RefreshIcon } from "@solar-icons/react/bold"
import {
    CodexDigestStatus,
    isCodexNotEntitled,
    useCodexToday,
    useGenerateCodexDigest,
} from "@readspace/shared"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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
 * built. A regenerate control joins it only once a digest is showing (COMPLETED with a payload).
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
    } else if (
        generate.isPending &&
        digest?.status !== CodexDigestStatus.COMPLETED
    ) {
        // A generate/regenerate request is in flight and there's no already-completed digest to
        // keep showing (that case gets its own inline regenerate control instead) — jump
        // straight to the generating state rather than waiting on the query cache to reflect
        // the new PENDING row. setQueryData + the invalidate-triggered refetch in
        // useGenerateCodexDigest are both async, so gating only on digest.status can lag a
        // beat, or — if this call raced a background refetch that hadn't landed yet — never
        // visibly show at all. Real phase takes over once the cache catches up.
        content = <CodexGenerating phase={null} />
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
        content = <CodexGenerating phase={digest.progress_phase} />
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

    // The other terminal states (skipped/failed/empty) each carry their own "try again" action
    // in their Shell; a COMPLETED digest with content is the one state that reads today's
    // digest as final with no way back in, so this is the only place the corner control needs
    // a second affordance next to the settings gear.
    const isViewingCompletedDigest =
        !isLoading &&
        !notEntitled &&
        digest?.status === CodexDigestStatus.COMPLETED &&
        !!digest.payload

    return (
        <div className="relative">
            {/* Fixed-size controls pinned to the top-right corner; they only overlap the
                masthead's own right padding, so nothing underneath needs to stay clickable
                through them. Offsets mirror the digest's horizontal gutters. */}
            <div className="absolute right-4 top-4 z-10 flex items-center gap-1 sm:right-6 lg:right-8">
                {isViewingCompletedDigest && (
                    <RegenerateButton
                        onRegenerate={handleGenerate}
                        isGenerating={generate.isPending}
                    />
                )}
                <CodexSettingsDialog />
            </div>
            {content}
        </div>
    )
}

/**
 * Re-runs generation for a fresh edition without leaving the finished digest on screen — the
 * one gap the terminal states' own "try again" actions don't cover, since COMPLETED has no
 * action of its own. Idempotent/quota-checked server-side like every other generate call; a
 * spent allowance surfaces the same not-entitled state as the empty/failed/quiet actions do.
 */
function RegenerateButton({
    onRegenerate,
    isGenerating,
}: {
    onRegenerate: () => void
    isGenerating: boolean
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Regenerate Daily Digest"
            disabled={isGenerating}
            onClick={onRegenerate}
        >
            <RefreshIcon
                className={cn("size-5", isGenerating && "animate-spin")}
            />
        </Button>
    )
}
