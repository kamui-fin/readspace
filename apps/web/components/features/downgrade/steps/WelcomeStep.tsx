"use client"

import { Change, Ledger, type LedgerRow } from "../Ledger"

interface WelcomeStepProps {
    feedCount: number
    feedLimit: number
    newsletterCount: number
    savedCount: number
    savedLimit: number
}

/** What the Free plan changes for this reader, as a ledger of what they hold today. */
export function WelcomeStep({
    feedCount,
    feedLimit,
    newsletterCount,
    savedCount,
    savedLimit,
}: WelcomeStepProps) {
    const overFeeds = feedCount > feedLimit
    const rows: LedgerRow[] = [
        {
            label: "Feeds",
            detail: overFeeds
                ? `You'll pick the ${feedLimit} you read most. You can save the full list first.`
                : "All of them fit. Nothing to choose.",
            figure: overFeeds ? (
                <Change from={feedCount} to={feedLimit} />
            ) : (
                feedCount
            ),
            quiet: !overFeeds,
        },
    ]
    if (newsletterCount > 0) {
        rows.push({
            label: "Newsletters",
            detail: "Pro only. Your inbox address stays reserved for when you come back.",
            figure: <Change from={newsletterCount} to={0} />,
        })
    }
    if (savedCount > 0) {
        rows.push({
            label: "Saved articles",
            detail:
                savedCount > savedLimit
                    ? `Every save stays. New ones pause until you're under ${savedLimit}.`
                    : "Every save stays.",
            figure: savedCount,
            quiet: true,
        })
    }

    return <Ledger rows={rows} />
}
