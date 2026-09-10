"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ArrowRightIcon, StarsIcon } from "@solar-icons/react/bold"
import type { CodexDigestPayload, CodexDigestResponse } from "@readspace/shared"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { DevelopmentCard } from "./DevelopmentCard"
import { WorthReadingStrip } from "./WorthReadingStrip"

interface CodexViewProps {
    /** A COMPLETED digest — callers handle pending/in_progress/failed/skipped states. */
    digest: CodexDigestResponse
}

const EXPLAINER_DISMISSED_KEY = "readspace:codex-explainer-dismissed"

/**
 * The finished digest. A busy day lays out newspaper-style — a masthead (a short `headline`
 * <h1> with the longer `gist` sentence as the standfirst under it), a main column of
 * Developments, and a right rail with the issue colophon, the
 * reading-time stat, a Trends card, and Worth Reading. A quiet day (no Developments)
 * collapses to a single centered column. Finite by construction — hard caps upstream, no
 * infinite scroll, a visible end.
 */
export function CodexView({ digest }: CodexViewProps) {
    const { payload } = digest
    if (!payload) return null

    const dateLabel = format(parseISO(digest.digest_date), "EEEE, MMMM d, yyyy")
    const [lead, ...rest] = payload.developments
    const hasDevelopments = payload.developments.length > 0

    // The <h1> is the short `headline`; the longer `gist` sentence sits under it as the
    // standfirst. Older digests have no `headline` — fall back to the gist as the <h1> and
    // drop the standfirst line so it isn't printed twice. Magnitude lives in the issue
    // colophon in the rail, never the headline.
    const headline = payload.headline?.trim() || payload.gist || payload.scale_setter
    const standfirst =
        payload.headline?.trim() && payload.gist?.trim() !== payload.headline.trim()
            ? payload.gist
            : null

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            {/* Masthead */}
            <header
                className={
                    hasDevelopments
                        ? "border-b border-border pb-6"
                        : "mx-auto max-w-2xl border-b border-border pb-6"
                }
            >
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-secondary">
                    <StarsIcon className="size-4" />
                    Daily Digest
                    <span aria-hidden className="text-muted-foreground/40">
                        ·
                    </span>
                    <span className="text-muted-foreground">{dateLabel}</span>
                </div>
                <h1 className="mt-3 max-w-3xl text-pretty font-serif text-[28px] font-bold leading-[1.15] tracking-tight text-foreground">
                    {headline}
                </h1>
                {standfirst && (
                    <p className="mt-2 text-pretty text-[15px] leading-relaxed text-muted-foreground">
                        {standfirst}
                    </p>
                )}
                {hasDevelopments && (
                    <FirstTimeExplainer
                        articleCount={digest.input_article_count}
                        sourceCount={digest.input_source_count}
                    />
                )}
            </header>

            {hasDevelopments ? (
                <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
                    {/* Main column — Developments */}
                    <main className="min-w-0">
                        <h2 className="mb-4 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Developments
                        </h2>
                        <div className="space-y-5">
                            {lead && (
                                <DevelopmentCard
                                    development={lead}
                                    featured
                                    defaultExpanded
                                />
                            )}
                            {rest.map((d, i) => (
                                <DevelopmentCard
                                    key={`${d.title}-${i}`}
                                    development={d}
                                />
                            ))}
                        </div>

                        {/* The rail's cards fall inline below on narrow screens */}
                        <div className="mt-8 space-y-6 lg:hidden">
                            <AtAGlanceCard digest={digest} />
                            <ReadingTimeStat stats={payload.stats} />
                            <TrendsCard themes={payload.themes} />
                            {payload.worth_reading.length > 0 && (
                                <WorthReadingStrip
                                    items={payload.worth_reading}
                                />
                            )}
                        </div>

                        <CodexFooter closingLine={payload.closing_line} />
                    </main>

                    {/* Right rail — desktop only */}
                    <aside className="hidden lg:block">
                        <div className="sticky top-6 space-y-6">
                            <AtAGlanceCard digest={digest} />
                            <ReadingTimeStat stats={payload.stats} />
                            <TrendsCard themes={payload.themes} />
                            {payload.worth_reading.length > 0 && (
                                <WorthReadingStrip
                                    items={payload.worth_reading}
                                />
                            )}
                        </div>
                    </aside>
                </div>
            ) : (
                /* Quiet day — no clusters, so Worth Reading carries the whole column. The
                   masthead standfirst already says it was a quiet day; no panel repeating it. */
                <div className="mx-auto mt-8 max-w-2xl">
                    <div className="space-y-6">
                        <AtAGlanceCard digest={digest} />
                        <TrendsCard themes={payload.themes} />
                        {payload.worth_reading.length > 0 && (
                            <WorthReadingStrip items={payload.worth_reading} />
                        )}
                    </div>

                    <CodexFooter closingLine={payload.closing_line} centered />
                </div>
            )}
        </div>
    )
}

/**
 * A one-liner orienting anyone who reached a finished digest without meeting the Daily Digest.
 * Reading serif, in the masthead under the standfirst — it reads as part of the front-page
 * dateline. Shows once (flag set on first render); the footer's "About" link is the way back.
 */
function FirstTimeExplainer({
    articleCount,
    sourceCount,
}: {
    articleCount: number | null
    sourceCount: number | null
}) {
    const [show, setShow] = useState(false)
    useEffect(() => {
        try {
            if (window.localStorage.getItem(EXPLAINER_DISMISSED_KEY) === "1")
                return
            window.localStorage.setItem(EXPLAINER_DISMISSED_KEY, "1")
            setShow(true)
        } catch {
            setShow(true)
        }
    }, [])
    if (!show) return null

    const detail =
        articleCount && sourceCount
            ? `${articleCount} articles from ${sourceCount} of your sources`
            : "everything your sources published in the last 24 hours"

    return (
        <p className="mt-3 max-w-2xl font-serif text-[15px] leading-relaxed text-muted-foreground">
            Your Daily Digest read {detail} and grouped what two or more of
            them covered into the developments below.
        </p>
    )
}

/**
 * The closing note: the pipeline's honest "shown vs. total" line. Its trailing "in your
 * reader" is linked to `/today` — the way back to the raw day, woven into the sentence
 * rather than bolted on as a separate CTA. The Daily Digest is a lens on the reader, not a
 * replacement.
 */
function CodexFooter({
    closingLine,
    centered = false,
}: {
    closingLine: string
    centered?: boolean
}) {
    return (
        <footer
            className={cn(
                "mt-10 border-t border-border pt-6",
                centered && "text-center"
            )}
        >
            <p className="text-xs leading-relaxed text-muted-foreground">
                {linkifyReader(closingLine)}
            </p>
        </footer>
    )
}

/** Turn a trailing "…in your reader" / "…in your feed" into a link to /today. Falls back to
 *  appending the link if the phrase isn't there. */
function linkifyReader(line: string): React.ReactNode {
    const ReaderLink = ({ children }: { children: React.ReactNode }) => (
        <Link
            href="/today"
            className="group inline-flex items-center gap-0.5 rounded font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
            {children}
            <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
    )

    const m = line.match(/^(.*?)(in your (?:reader|feed|inbox))([.\s]*)$/i)
    if (m) {
        return (
            <>
                {m[1]}
                <ReaderLink>{m[2]}</ReaderLink>
                {m[3]}
            </>
        )
    }
    return (
        <>
            {line} <ReaderLink>Open your reader</ReaderLink>
        </>
    )
}

/**
 * The one number worth stating: how long the source write-ups the Digest folded into Developments
 * would have taken to read, against the ~2 minutes the digest takes. Not a vanity "hours
 * saved" over the whole catalog — only what the synthesis genuinely replaces. Null on a quiet
 * day (nothing condensed) and on pre-stats digests, in which case the block is skipped.
 */
function ReadingTimeStat({ stats }: { stats: CodexDigestPayload["stats"] }) {
    if (!stats || stats.minutes_condensed < 1) return null

    const mins = `~${stats.minutes_condensed}${stats.minutes_capped ? "+" : ""}`
    const pieces = `${stats.articles_condensed} ${
        stats.articles_condensed === 1 ? "write-up" : "write-ups"
    }`

    return (
        <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Condensed
            </h2>
            <p className="font-mono text-2xl font-semibold tabular-nums leading-none text-primary dark:text-secondary">
                {mins}
                <span className="ml-1 text-sm font-medium text-muted-foreground">
                    min
                </span>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Reading time across {pieces}, folded into a ~2-minute digest.
            </p>
        </div>
    )
}

/**
 * The issue colophon — the day's magnitude as a newspaper ledger, not a stat dashboard.
 * A justified `<dl>`: label left, mono figure right, hairline rules between. Sits in the
 * rail above Trends; the standfirst carries the day's meaning, this just states its scale.
 * Counts come from the digest row (authoritative); Developments reads "N of M" when the
 * digest showed fewer than it found. Falls back to parsing `scale_setter` only if the row
 * counts are missing (older digests).
 */
function AtAGlanceCard({ digest }: { digest: CodexDigestResponse }) {
    const shown = digest.payload?.developments.length ?? 0
    const found = digest.clusters_found ?? shown

    const rows: { label: string; value: string }[] = []
    if (digest.input_article_count != null)
        rows.push({
            label: "Pieces",
            value: digest.input_article_count.toLocaleString(),
        })
    if (digest.input_source_count != null)
        rows.push({
            label: "Sources",
            value: digest.input_source_count.toLocaleString(),
        })
    rows.push({
        label: "Developments",
        value: found > shown ? `${shown} of ${found}` : String(found),
    })

    // Older digests without row-level counts: salvage from the scale_setter string.
    if (rows.length < 3) {
        const parsed: { label: string; value: string }[] = []
        for (const part of (digest.payload?.scale_setter ?? "").split("·")) {
            const m = part.trim().match(/^([\d,]+)\s+(.+)$/)
            if (!m) continue
            parsed.push({
                label: m[2]!.replace(/^\w/, (c) => c.toUpperCase()),
                value: m[1]!,
            })
        }
        if (parsed.length >= 2) return <ColophonCard rows={parsed} />
    }

    return <ColophonCard rows={rows} />
}

function ColophonCard({ rows }: { rows: { label: string; value: string }[] }) {
    if (rows.length === 0) return null
    return (
        <section className="rounded-lg border border-border bg-card px-4 py-3">
            <h2 className="mb-1 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                This issue
            </h2>
            <dl className="divide-y divide-border/60">
                {rows.map((r) => (
                    <div
                        key={r.label}
                        className="flex items-baseline justify-between py-2 last:pb-0"
                    >
                        <dt className="text-sm text-muted-foreground">
                            {r.label}
                        </dt>
                        <dd className="font-mono text-sm tabular-nums text-foreground">
                            {r.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    )
}

/**
 * "Trends" — the day's keywords as its own bento card above Worth Reading. Each chip opens a
 * Google search for that phrase in a new tab; it's the one place the Digest points off-platform,
 * so it's deliberately a small, quiet affordance. Skipped entirely when Phase 1 found no
 * recurring theme (or on a pre-themes digest).
 */
function TrendsCard({ themes }: { themes: string[] }) {
    const tags = themes.filter((t) => t.trim())
    if (tags.length === 0) return null

    return (
        <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Trends
            </h2>
            <ul className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                    <li key={tag}>
                        <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(
                                tag
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                            <Badge
                                variant="outline"
                                className="justify-center border-secondary/30 px-3 py-1 text-center font-normal text-secondary transition-colors hover:border-secondary/60 hover:bg-secondary/10"
                            >
                                {tag}
                            </Badge>
                        </a>
                    </li>
                ))}
            </ul>
        </section>
    )
}
