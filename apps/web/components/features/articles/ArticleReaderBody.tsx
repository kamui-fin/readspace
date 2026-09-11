import { useEffect, useRef } from "react"
import type { Article } from "@readspace/shared"

import { AiSummaryCard } from "./AiSummaryCard"
import { AnimatedContent } from "./AnimatedContent"
import { ArticleHeader } from "./ArticleHeader"
import { ProseContainer } from "./ProseContainer"
import { Skeleton } from "@/components/ui/skeleton"

const READER_SERIF =
    "var(--font-garamond-serif), var(--font-noto-serif-sc), var(--font-noto-serif-jp), var(--font-noto-serif-tc)"

function NewsletterIframe({
    content,
    isDark,
    highlightsEnabled = false,
}: {
    content: string
    isDark: boolean
    highlightsEnabled?: boolean
}) {
    const iframeRef = useRef<HTMLIFrameElement>(null)

    useEffect(() => {
        const iframe = iframeRef.current
        if (!iframe) return

        let observer: ResizeObserver | null = null

        const setupObserver = () => {
            try {
                const doc =
                    iframe.contentDocument ||
                    (iframe.contentWindow
                        ? iframe.contentWindow.document
                        : null)
                if (doc && doc.body) {
                    const updateHeight = () => {
                        const height = Math.max(
                            doc.body.scrollHeight,
                            doc.body.offsetHeight,
                            doc.documentElement.scrollHeight,
                            doc.documentElement.offsetHeight
                        )
                        if (height > 0) {
                            iframe.style.height = `${height}px`
                        }
                    }

                    // Initial height set
                    updateHeight()

                    if (window.ResizeObserver) {
                        if (observer) {
                            observer.disconnect()
                        }
                        observer = new ResizeObserver(updateHeight)
                        observer.observe(doc.body)
                    }
                }
            } catch (e) {
                console.error("Failed to setup resize observer", e)
            }
        }

        iframe.addEventListener("load", setupObserver)
        setupObserver()

        return () => {
            if (observer) {
                observer.disconnect()
            }
            iframe.removeEventListener("load", setupObserver)
        }
    }, [content, isDark])

    const srcDoc = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              html, body {
                margin: 0;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: transparent;
                color: ${isDark ? "#e2e8f0" : "#1a202c"};
              }

              html, body, .document, [class*="document"], [class*="body"] {
                height: auto !important;
                min-height: auto !important;
                overflow: visible !important;
              }

              ${
                  isDark
                      ? `
                html {
                  filter: invert(1) hue-rotate(180deg);
                  background-color: #ededed !important; /* Inverts to #121212 */
                }

                img, video, svg, .no-invert, mark.rs-highlight {
                  filter: invert(1) hue-rotate(180deg) !important;
                }
              `
                      : ""
              }

              img {
                max-width: 100% !important;
                height: auto !important;
              }
              table {
                max-width: 100% !important;
                width: 100% !important;
              }

              /* Prevent email internal dark styles from causing double-inversion grey looks */
              @media (prefers-color-scheme: dark) {
                body, p, td, tr, .body, table, h1, h2, h3, h4, h5, h6, div, span, .document, [class*="document"], [class*="body"] {
                  background-color: #FEFEFE !important;
                  color: #010101 !important;
                }
              }

              /* AI Highlights (Skim Mode) — brand green tint, invisible until toggled on */
              mark.rs-highlight {
                background-color: transparent;
                background-image: none;
                color: inherit;
                padding: 0;
                border-radius: 3px;
                box-decoration-break: clone;
                -webkit-box-decoration-break: clone;
              }
              .rs-highlights-enabled mark.rs-highlight {
                --rs-highlight-color: color-mix(in srgb, #6a994e ${isDark ? "58%" : "45%"}, transparent);
                background-image: linear-gradient(90deg, var(--rs-highlight-color) 0%, var(--rs-highlight-color) 100%);
                background-repeat: no-repeat;
                background-size: 0% 100%;
                background-position: left center;
                padding: 0 1px;
                animation: rs-highlight-sweep 320ms ease-out forwards;
                animation-delay: calc(var(--rs-highlight-index, 0) * 30ms);
              }
              .rs-highlights-enabled mark.rs-highlight[data-rank="2"] {
                --rs-highlight-color: color-mix(in srgb, #6a994e ${isDark ? "36%" : "26%"}, transparent);
              }
              @keyframes rs-highlight-sweep {
                from { background-size: 0% 100%; }
                to   { background-size: 100% 100%; }
              }
              @media (prefers-reduced-motion: reduce) {
                .rs-highlights-enabled mark.rs-highlight {
                  animation: none;
                  background-size: 100% 100%;
                }
              }
            </style>
          </head>
          <body>
            <div id="mail-content-root" class="${highlightsEnabled ? "rs-highlights-enabled" : ""}" style="display: flow-root;">
              ${content}
            </div>
          </body>
        </html>
    `

    return (
        <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            className="newsletter-iframe w-full"
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            scrolling="no"
            loading="lazy"
            style={{
                width: "100%",
                border: "none",
                background: "transparent",
                overflow: "hidden",
                minHeight: "500px",
            }}
        />
    )
}

interface ArticleReaderBodyProps {
    article: Article
    isDark: boolean
    /** The fully-resolved HTML string to render (extracted / translated / original). */
    displayContent: string | null
    /** Key that changes when the visible content changes, driving the crossfade. */
    contentKey: string
    /** Client-side estimated reading time in minutes. */
    clientReadTime: number | null
    shouldShowFeedBadge: boolean
    isMobile: boolean
    isRecentlyReadMode: boolean
    shouldShowPreviewBanner: boolean
    /** Rendered into the header meta row on desktop; pass `null` for a chrome-free view. */
    toolbar: React.ReactNode
    aiSummary?: string | null
    onDismissAiSummary?: () => void
    /** True while the article body is loading / being extracted / translated. */
    isBusy?: boolean
    highlightsEnabled?: boolean
    /** True while a translation is in flight — skeletons the title (which changes on translate,
     *  unlike extraction/loading). */
    isTranslating?: boolean
}

/**
 * The reading surface shared by the split-view reader and the standalone `/articles/[id]`
 * route (and reused verbatim inside Zen Mode): the header, an optional AI summary card, and
 * the article body — a skeleton while busy, a newsletter iframe for `newsletter://` links,
 * or the serif prose otherwise. It renders no scroll container, toolbar chrome, or
 * page-level layout; the caller owns all of that.
 */
export function ArticleReaderBody({
    article,
    isDark,
    displayContent,
    contentKey,
    clientReadTime,
    shouldShowFeedBadge,
    isMobile,
    isRecentlyReadMode,
    shouldShowPreviewBanner,
    toolbar,
    aiSummary,
    onDismissAiSummary,
    isBusy = false,
    isTranslating = false,
    highlightsEnabled = false,
}: ArticleReaderBodyProps) {
    const contentRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!highlightsEnabled) return
        contentRef.current
            ?.querySelectorAll<HTMLElement>(".rs-highlight")
            .forEach((mark, i) => {
                mark.style.setProperty(
                    "--rs-highlight-index",
                    String(Math.min(i, 20))
                )
            })
    }, [highlightsEnabled, displayContent, isBusy])

    return (
        <ProseContainer>
            <ArticleHeader
                article={article}
                currentReadTime={clientReadTime}
                shouldShowFeedBadge={shouldShowFeedBadge}
                isMobile={isMobile}
                isRecentlyReadMode={isRecentlyReadMode}
                shouldShowPreviewBanner={shouldShowPreviewBanner}
                toolbar={toolbar}
                isBusy={isTranslating}
            />

            {aiSummary && (
                <AiSummaryCard
                    summary={aiSummary}
                    className="mt-4"
                    onDismiss={onDismissAiSummary ?? (() => {})}
                />
            )}

            {isBusy ? (
                <div className="space-y-4 mt-8">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[90%]" />
                    <Skeleton className="h-4 w-[95%]" />
                    <Skeleton className="h-4 w-[80%]" />
                    <Skeleton className="h-4 w-[85%]" />
                    <Skeleton className="h-4 w-[60%]" />
                </div>
            ) : displayContent ? (
                <AnimatedContent contentKey={contentKey} className="mt-8">
                    {article.link?.startsWith("newsletter://") ? (
                        <NewsletterIframe
                            content={displayContent}
                            isDark={isDark}
                            highlightsEnabled={highlightsEnabled}
                        />
                    ) : (
                        <div
                            className={
                                highlightsEnabled
                                    ? "text-xl leading-relaxed rs-highlights-enabled"
                                    : "text-xl leading-relaxed"
                            }
                            ref={contentRef}
                            style={{ fontFamily: READER_SERIF }}
                        >
                            <div
                                dangerouslySetInnerHTML={{
                                    __html: displayContent,
                                }}
                            />
                        </div>
                    )}
                </AnimatedContent>
            ) : (
                <div className="space-y-6 mt-8">
                    {(article.description || article.user_note) && (
                        <blockquote className="border-l-4 border-primary/30 bg-muted/30 pl-4 italic text-muted-foreground prose prose-sm max-w-none">
                            <div
                                dangerouslySetInnerHTML={{
                                    __html:
                                        article.user_note ||
                                        article.description ||
                                        "",
                                }}
                            />
                        </blockquote>
                    )}
                    <div className="flex flex-col items-center justify-center py-12 text-center not-prose">
                        <div className="mx-auto max-w-xs">
                            <p className="text-sm text-muted-foreground/60">
                                This article doesn&apos;t have any content
                                available.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </ProseContainer>
    )
}
