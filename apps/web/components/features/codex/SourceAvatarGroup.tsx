"use client"

import type { ArticleSummary } from "@readspace/shared"
import { FeedIcon } from "@/components/features/feeds/FeedIcon"
import { cn } from "@/lib/utils"

interface SourceAvatarGroupProps {
    /** Articles to pull feed icons + titles from. De-duplicated by feed title. */
    articles: ArticleSummary[]
    /** Hard cap on visible avatars before a "+N" chip. */
    max?: number
    /** Optional trailing label, e.g. "6 sources". */
    label?: string
    className?: string
}

/**
 * An overlapping row of feed icons — the "who covered this" glance. De-dupes by feed title so
 * two articles from the same source count once, and collapses the overflow into a "+N" chip
 * that names the hidden sources on hover / to assistive tech.
 */
export function SourceAvatarGroup({
    articles,
    max = 5,
    label,
    className,
}: SourceAvatarGroupProps) {
    const seen = new Set<string>()
    const sources: { title: string | null; icon: string | null }[] = []
    for (const a of articles) {
        const key = (a.feed_title || a.source_domain || a.link).toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        sources.push({ title: a.feed_title, icon: a.feed_icon })
    }

    if (sources.length === 0) return null

    const visible = sources.slice(0, max)
    const hidden = sources.slice(max)
    const hiddenNames = hidden
        .map((s) => s.title)
        .filter(Boolean)
        .join(", ")

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div className="flex items-center">
                {visible.map((s, i) => (
                    <div
                        key={`${s.title ?? "src"}-${i}`}
                        className={cn(
                            "rounded-full ring-2 ring-card",
                            i > 0 && "-ml-1.5"
                        )}
                    >
                        <FeedIcon
                            feed={{ title: s.title, image_url: s.icon }}
                            className="size-5 rounded-full"
                        />
                    </div>
                ))}
                {hidden.length > 0 && (
                    <span
                        title={hiddenNames || undefined}
                        aria-label={
                            hiddenNames
                                ? `${hidden.length} more: ${hiddenNames}`
                                : `${hidden.length} more sources`
                        }
                        className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold leading-none text-muted-foreground"
                    >
                        +{hidden.length}
                    </span>
                )}
            </div>
            {label && (
                <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {label}
                </span>
            )}
        </div>
    )
}
