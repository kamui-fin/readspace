"use client"

import { FeedIcon } from "@/components/features/feeds/FeedIcon"
import type { SubscriptionResponse } from "@readspace/shared"
import { X } from "lucide-react"

interface KeepingSlotsProps {
    kept: SubscriptionResponse[]
    limit: number
    onRemove: (feedId: string) => void
}

/** The ten places a Free reading list has: filled slots are the picks, empty ones stay visible. */
export function KeepingSlots({ kept, limit, onRemove }: KeepingSlotsProps) {
    const empty = Math.max(limit - kept.length, 0)

    return (
        <aside aria-label="Feeds you're keeping">
            <p className="text-sm font-medium text-foreground tabular-nums">
                Keeping {kept.length} of {limit}
            </p>
            <ol className="mt-3 space-y-1.5">
                {kept.map((sub) => {
                    const title =
                        sub.custom_title || sub.feed.title || sub.feed.url
                    return (
                        <li
                            key={sub.feed.id}
                            className="group flex h-10 items-center gap-2.5 rounded-md border border-border bg-card pl-2.5 pr-1 motion-safe:animate-in motion-safe:fade-in-50 duration-200"
                        >
                            <FeedIcon
                                feed={sub.feed}
                                className="size-5 shrink-0"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                {title}
                            </span>
                            <button
                                type="button"
                                onClick={() => onRemove(sub.feed.id)}
                                className="size-7 shrink-0 rounded-sm flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`Stop keeping ${title}`}
                            >
                                <X className="size-3.5" />
                            </button>
                        </li>
                    )
                })}
                {Array.from({ length: empty }).map((_, index) => (
                    <li
                        key={`empty-${index}`}
                        aria-hidden
                        className="h-10 rounded-md border border-dashed border-input"
                    />
                ))}
            </ol>
        </aside>
    )
}
