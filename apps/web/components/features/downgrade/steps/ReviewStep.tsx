"use client"

import { Change, Ledger, type LedgerRow } from "../Ledger"

interface ReviewStepProps {
    feedCount: number
    keepCount: number
    newsletterCount: number
    savedCount: number
}

const plural = (count: number, word: string) =>
    `${count} ${word}${count === 1 ? "" : "s"}`

/** Final tally before the unsubscribe is applied. */
export function ReviewStep({
    feedCount,
    keepCount,
    newsletterCount,
    savedCount,
}: ReviewStepProps) {
    const removed = feedCount - keepCount
    const rows: LedgerRow[] = [
        {
            label: "Feeds",
            detail:
                removed > 0
                    ? `${plural(removed, "feed")} will be unsubscribed.`
                    : "Everything you follow stays.",
            figure:
                removed > 0 ? (
                    <Change from={feedCount} to={keepCount} />
                ) : (
                    keepCount
                ),
        },
    ]
    if (newsletterCount > 0) {
        rows.push({
            label: "Newsletters",
            detail: `${plural(newsletterCount, "newsletter")} will be removed.`,
            figure: <Change from={newsletterCount} to={0} />,
        })
    }
    if (savedCount > 0) {
        rows.push({
            label: "Saved articles",
            detail: "Untouched.",
            figure: savedCount,
            quiet: true,
        })
    }

    return <Ledger rows={rows} />
}
