"use client"

import { useCallback, useState } from "react"
import { toast } from "react-hot-toast"
import {
    CodexDigestStatus,
    isCodexNotEntitled,
    useCodexToday,
    useGenerateCodexDigest,
} from "@readspace/shared"
import { CodexView } from "./CodexView"
import { CodexGenerating } from "./CodexGenerating"
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

    if (isLoading) {
        return <CodexSkeleton />
    }

    if (notEntitled) {
        return (
            <CodexNotEntitledState
                reason={notEntitled.reason}
                errorCode={notEntitled.errorCode}
            />
        )
    }

    // A hard error on the poll itself (not a 404 — the hook maps that to null).
    if (error) {
        return (
            <CodexFailedState
                onGenerate={handleGenerate}
                isGenerating={generate.isPending}
                connectionLost
            />
        )
    }

    if (!digest) {
        return (
            <CodexEmptyState
                onGenerate={handleGenerate}
                isGenerating={generate.isPending}
            />
        )
    }

    switch (digest.status) {
        case CodexDigestStatus.PENDING:
        case CodexDigestStatus.IN_PROGRESS:
            return (
                <CodexGenerating
                    phase={digest.progress_phase}
                    requestedAt={digest.requested_at}
                />
            )
        case CodexDigestStatus.SKIPPED:
            return (
                <CodexQuietDayState
                    onGenerate={handleGenerate}
                    isGenerating={generate.isPending}
                />
            )
        case CodexDigestStatus.FAILED:
            return (
                <CodexFailedState
                    onGenerate={handleGenerate}
                    isGenerating={generate.isPending}
                />
            )
        case CodexDigestStatus.COMPLETED:
            return digest.payload ? (
                <CodexView digest={digest} />
            ) : (
                <CodexQuietDayState
                    onGenerate={handleGenerate}
                    isGenerating={generate.isPending}
                />
            )
        default:
            return (
                <CodexNotEntitledState
                    reason="This digest is in an unexpected state."
                    errorCode="UNKNOWN"
                />
            )
    }
}
