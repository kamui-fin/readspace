"use client"

import { FeedIcon } from "@/components/features/feeds/FeedIcon"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { SubscriptionResponse } from "@readspace/shared"
import { Search } from "lucide-react"
import { useMemo, useState } from "react"
import { KeepingSlots } from "./KeepingSlots"

interface KeepFeedsStepProps {
    feeds: SubscriptionResponse[]
    limit: number
    selected: Set<string>
    onToggle: (feedId: string) => void
}

const UNFILED = "Unfiled"

function displayTitle(sub: SubscriptionResponse): string {
    return sub.custom_title || sub.feed.title || sub.feed.url
}

/** Feeds grouped by the reader's own folders, alphabetical within each. */
function groupByFolder(feeds: SubscriptionResponse[]) {
    const groups = new Map<string, SubscriptionResponse[]>()
    for (const sub of feeds) {
        const name = sub.folder?.name || UNFILED
        if (!groups.has(name)) groups.set(name, [])
        groups.get(name)!.push(sub)
    }
    return [...groups.entries()]
        .sort(([a], [b]) =>
            a === UNFILED ? 1 : b === UNFILED ? -1 : a.localeCompare(b)
        )
        .map(([name, subs]) => ({
            name,
            subs: subs.sort((a, b) =>
                displayTitle(a).localeCompare(displayTitle(b))
            ),
        }))
}

/** Folder-grouped, searchable checklist beside the slots it fills. */
export function KeepFeedsStep({
    feeds,
    limit,
    selected,
    onToggle,
}: KeepFeedsStepProps) {
    const [query, setQuery] = useState("")
    const atLimit = selected.size >= limit

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase()
        const matches = q
            ? feeds.filter(
                  (sub) =>
                      displayTitle(sub).toLowerCase().includes(q) ||
                      sub.folder?.name?.toLowerCase().includes(q)
              )
            : feeds
        return groupByFolder([...matches])
    }, [feeds, query])

    const kept = useMemo(
        () => feeds.filter((sub) => selected.has(sub.feed.id)),
        [feeds, selected]
    )

    return (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="min-w-0">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={`Search ${feeds.length} feeds or folders`}
                        aria-label="Search feeds"
                        className="h-11 w-full rounded-md border border-input bg-transparent pl-9 pr-20 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <span
                        className={cn(
                            "absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums lg:hidden",
                            atLimit
                                ? "text-primary font-medium"
                                : "text-muted-foreground"
                        )}
                        aria-live="polite"
                    >
                        {selected.size} / {limit}
                    </span>
                </div>

                <p
                    className={cn(
                        "mt-2 h-5 text-xs text-muted-foreground transition-opacity",
                        atLimit ? "opacity-100" : "opacity-0"
                    )}
                    aria-live="polite"
                >
                    {atLimit &&
                        `All ${limit} places are taken. Remove one to swap it for another.`}
                </p>

                <div className="mt-2 max-h-[min(58dvh,560px)] overflow-y-auto overscroll-contain rounded-md border border-border [scrollbar-width:thin] [scrollbar-color:hsl(var(--input))_transparent]">
                    {groups.map((group) => (
                        <section key={group.name} aria-label={group.name}>
                            <h3 className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm tabular-nums">
                                {group.name}
                                <span className="ml-1.5 text-muted-foreground/70">
                                    {group.subs.length}
                                </span>
                            </h3>
                            <ul>
                                {group.subs.map((sub) => {
                                    const feedId = sub.feed.id
                                    const isChecked = selected.has(feedId)
                                    const isDisabled = !isChecked && atLimit
                                    return (
                                        <li key={feedId}>
                                            <label
                                                className={cn(
                                                    "flex items-center gap-3 px-4 py-2.5 transition-colors",
                                                    isDisabled
                                                        ? "cursor-not-allowed opacity-45"
                                                        : "cursor-pointer hover:bg-accent/60",
                                                    isChecked && "bg-accent/40"
                                                )}
                                            >
                                                <Checkbox
                                                    checked={isChecked}
                                                    disabled={isDisabled}
                                                    onCheckedChange={() =>
                                                        onToggle(feedId)
                                                    }
                                                    aria-label={`Keep ${displayTitle(sub)}`}
                                                />
                                                <FeedIcon
                                                    feed={sub.feed}
                                                    className="size-6 shrink-0"
                                                />
                                                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                                    {displayTitle(sub)}
                                                </span>
                                            </label>
                                        </li>
                                    )
                                })}
                            </ul>
                        </section>
                    ))}
                    {groups.length === 0 && (
                        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                            Nothing matches &ldquo;{query}&rdquo;
                        </p>
                    )}
                </div>
            </div>

            <div className="hidden lg:block">
                <div className="sticky top-8">
                    <KeepingSlots
                        kept={kept}
                        limit={limit}
                        onRemove={onToggle}
                    />
                </div>
            </div>
        </div>
    )
}
