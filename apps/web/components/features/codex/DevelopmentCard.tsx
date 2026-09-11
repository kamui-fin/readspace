"use client"

import { useId, useState } from "react"
import Image from "next/image"
import { AltArrowDownIcon } from "@solar-icons/react/bold"
import type { CodexDevelopment } from "@readspace/shared"
import { cn } from "@/lib/utils"
import { READING_SERIF } from "./constants"
import { CodexSynthesis } from "./CodexSynthesis"
import { CodexArticleRow } from "./CodexArticleRow"
import { SourceAvatarGroup } from "./SourceAvatarGroup"

interface DevelopmentCardProps {
    development: CodexDevelopment
    /** The lead development renders larger and opens its write-up list on first paint. */
    featured?: boolean
    /** Write-up list open on first render (the lead one). */
    defaultExpanded?: boolean
}

/**
 * A synthesised development. The imagery is decided by the pipeline — it probes each cited
 * article's image and hands us a `hero_image_url` (a wide image for the top band) and up to
 * four `strip_image_urls` (an aspect-honest strip / 2×2 mosaic below the synthesis), or
 * neither for a text-first card. No client-side measuring, so the layout is final on first
 * paint; `onError` is the only fallback (a probed image that later 404s just disappears).
 * Reading is the point, so the serif synthesis always leads and images never stretch.
 */
export function DevelopmentCard({
    development,
    featured = false,
    defaultExpanded = false,
}: DevelopmentCardProps) {
    const [expanded, setExpanded] = useState(defaultExpanded)
    /** Hero/strip URLs that 404'd after the pipeline probed them — dropped from the render. */
    const [broken, setBroken] = useState<Set<string>>(() => new Set())
    const panelId = useId()

    const markBroken = (url: string) =>
        setBroken((prev) => {
            if (prev.has(url)) return prev
            const next = new Set(prev)
            next.add(url)
            return next
        })

    const heroUrl =
        development.hero_image_url && !broken.has(development.hero_image_url)
            ? development.hero_image_url
            : null
    const stripUrls = (development.strip_image_urls ?? [])
        .filter((url) => !broken.has(url))
        .slice(0, 4)

    const articleCount =
        development.article_count || development.articles.length
    const heroArticleId = development.articles.find(
        (a) => a.image_url === heroUrl
    )?.id

    return (
        <article className="overflow-hidden rounded-lg border border-border bg-card">
            {heroUrl && (
                <div
                    className={cn(
                        "relative w-full border-b border-border bg-muted",
                        featured
                            ? "aspect-[16/9] sm:aspect-[2/1]"
                            : "aspect-[16/9] sm:aspect-[16/6]"
                    )}
                >
                    <Image
                        src={heroUrl}
                        alt={development.title}
                        fill
                        sizes="(min-width: 1024px) 620px, 100vw"
                        onError={() => markBroken(heroUrl)}
                        className="object-cover"
                    />
                </div>
            )}

            <div className={cn("p-4 sm:p-5", featured && "sm:p-6")}>
                <h3
                    style={{ fontFamily: READING_SERIF }}
                    className={cn(
                        "text-balance font-semibold tracking-tight text-foreground",
                        featured
                            ? "text-2xl leading-[1.2] sm:text-[27px]"
                            : "text-lg leading-snug sm:text-xl"
                    )}
                >
                    {development.title}
                </h3>

                <CodexSynthesis
                    content={development.synthesis}
                    className={cn("mt-3", featured && "sm:text-lg")}
                />

                {stripUrls.length >= 2 && (
                    <div
                        className={cn(
                            "mt-4 grid gap-1.5",
                            stripUrls.length === 2 && "grid-cols-2",
                            stripUrls.length === 3 && "grid-cols-3",
                            stripUrls.length >= 4 &&
                                "grid-cols-2 sm:grid-cols-4"
                        )}
                    >
                        {stripUrls.map((url) => (
                            <div
                                key={url}
                                className="relative aspect-[16/10] overflow-hidden rounded-md border border-border bg-muted"
                            >
                                <Image
                                    src={url}
                                    alt=""
                                    fill
                                    sizes="(min-width: 1024px) 150px, 45vw"
                                    loading="lazy"
                                    onError={() => markBroken(url)}
                                    className="object-cover"
                                />
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <SourceAvatarGroup
                        articles={development.articles}
                        label={`${development.source_count} ${
                            development.source_count === 1
                                ? "source"
                                : "sources"
                        }`}
                    />
                    <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                        {articleCount}{" "}
                        {articleCount === 1 ? "article" : "articles"}
                    </span>
                </div>
            </div>

            {development.articles.length > 0 && (
                <div className="border-t border-border">
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        className="flex w-full items-center justify-between px-4 py-3 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5"
                    >
                        <span>
                            {expanded ? "Hide" : "Show"}{" "}
                            {development.articles.length}{" "}
                            {development.articles.length === 1
                                ? "write-up"
                                : "write-ups"}
                        </span>
                        <AltArrowDownIcon
                            className={cn(
                                "size-4 transition-transform",
                                expanded && "rotate-180"
                            )}
                        />
                    </button>
                    {expanded && (
                        <div
                            id={panelId}
                            className="space-y-1 px-2 pb-3 sm:px-3"
                        >
                            {development.articles.map((article, i) => (
                                <CodexArticleRow
                                    key={article.id}
                                    article={article}
                                    rank={i}
                                    // The hero already shows this article's image up top.
                                    hideThumb={
                                        !!heroArticleId &&
                                        article.id === heroArticleId
                                    }
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </article>
    )
}
