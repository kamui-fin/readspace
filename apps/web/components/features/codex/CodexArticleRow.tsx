"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { formatDistanceToNowStrict, parseISO } from "date-fns"
import { ArrowRightIcon } from "@solar-icons/react/bold"
import type { ArticleSummary } from "@readspace/shared"
import { FeedIcon } from "@/components/features/feeds/FeedIcon"
import { cn } from "@/lib/utils"

interface CodexArticleRowProps {
    article: ArticleSummary
    /** Index 0 gets the "lead" treatment: heavier title, a thumbnail if it has one. */
    rank?: number
    /** Compact rows never show a thumbnail (used in the Worth Reading rail). */
    dense?: boolean
    /** Force the thumbnail off even for the lead (e.g. the card already shows a hero). */
    hideThumb?: boolean
    /** Worth Reading: one line on why the piece stands alone, kept in the row's own rhythm. */
    reason?: string
}

/**
 * One article under a Development or in the Worth Reading list. Newspaper row: a mono
 * dateline (source · relative time), then the headline. The lead (rank 0) is heavier and
 * carries a thumbnail when the article has an image. Opens the piece in the Readspace
 * reader at `/articles/[id]`.
 */
export function CodexArticleRow({
    article,
    rank,
    dense = false,
    hideThumb = false,
    reason,
}: CodexArticleRowProps) {
    const [imgError, setImgError] = useState(false)
    const isLead = rank === 0
    const published = article.published_at
        ? formatDistanceToNowStrict(parseISO(article.published_at), {
              addSuffix: true,
          })
        : null
    const source =
        article.feed_title || article.source_domain || "Unknown source"
    const showThumb =
        isLead && !dense && !hideThumb && !!article.image_url && !imgError

    return (
        <Link
            href={`/articles/${article.id}`}
            className={cn(
                "group flex items-start gap-3 rounded-lg px-3 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50",
                dense ? "py-2" : "py-2.5",
                isLead && !dense && "bg-muted/40"
            )}
        >
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                    <FeedIcon
                        feed={{
                            title: article.feed_title,
                            image_url: article.feed_icon,
                        }}
                        className="size-4 shrink-0 rounded"
                    />
                    <span className="truncate font-medium text-foreground/70">
                        {source}
                    </span>
                    {published && (
                        <>
                            <span
                                aria-hidden
                                className="text-muted-foreground/50"
                            >
                                ·
                            </span>
                            <span className="whitespace-nowrap tabular-nums">
                                {published}
                            </span>
                        </>
                    )}
                </div>
                <h4
                    className={cn(
                        "mt-1.5 leading-snug text-foreground transition-colors group-hover:text-secondary group-focus-visible:text-secondary",
                        isLead
                            ? "text-[15px] font-semibold"
                            : "text-sm font-medium"
                    )}
                >
                    {article.title || "Untitled"}
                    <ArrowRightIcon
                        aria-hidden
                        className="ml-0.5 inline size-3.5 -translate-y-px opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60"
                    />
                </h4>
                {reason && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {reason}
                    </p>
                )}
            </div>
            {showThumb && (
                <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    <Image
                        src={article.image_url as string}
                        alt=""
                        fill
                        sizes="64px"
                        loading="lazy"
                        onError={() => setImgError(true)}
                        className="object-cover"
                    />
                </div>
            )}
        </Link>
    )
}
