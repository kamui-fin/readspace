"use client"

import { memo } from "react"
import { cn } from "@/lib/utils"
import { AnimatedContent } from "./AnimatedContent"

const PROSE_CLASSES = cn(
    "px-6 py-8 prose prose-slate dark:prose-invert prose-2xl",
    "article-content",
    "prose-headings:font-semibold prose-headings:text-foreground",
    "prose-p:text-foreground prose-p:leading-relaxed prose-p:text-xl",
    "prose-li:text-foreground prose-li:text-xl",
    "prose-blockquote:border-l-primary prose-blockquote:bg-muted/30",
    "prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:text-xl",
    "prose-code:bg-muted prose-code:px-1.5 prose-code:py-1",
    "prose-code:rounded prose-code:text-lg",
    "prose-code:before:content-none prose-code:after:content-none",
    "prose-pre:bg-muted prose-pre:border prose-pre:text-foreground",
    "prose-a:text-primary prose-a:no-underline prose-a:hover:underline",
    "prose-img:rounded-lg prose-img:shadow-sm",
    "prose-strong:text-foreground prose-em:text-foreground",
    "prose-figcaption:text-muted-foreground prose-figcaption:text-sm prose-figcaption:italic",
    "prose-figure:my-8",
    "prose-hr:border-border",
    "prose-th:text-foreground prose-th:font-semibold prose-th:border-border",
    "prose-td:text-foreground prose-td:border-border",
    "prose-table:border-border",
    "prose-thead:border-border",
    "prose-tr:border-border",
    "prose-ol:text-foreground",
    "prose-ul:text-foreground",
    "prose-dl:text-foreground",
    "prose-dt:text-foreground prose-dt:font-semibold",
    "prose-dd:text-foreground",
    "prose-lead:text-muted-foreground",
    "prose-video:rounded-lg prose-video:shadow-sm",
    "prose-kbd:bg-muted prose-kbd:text-foreground prose-kbd:px-2 prose-kbd:py-1 prose-kbd:rounded prose-kbd:border prose-kbd:border-border"
)

const SERIF_FONT_STYLE = {
    fontFamily: "var(--font-garamond-serif), var(--font-noto-serif-sc), var(--font-noto-serif-jp), var(--font-noto-serif-tc)",
} as const

interface ArticleProseContentProps {
    content: string
    contentKey?: string
    className?: string
    description?: string | null
    userNote?: string | null
}

export const ArticleProseContent = memo(function ArticleProseContent({
    content,
    contentKey,
    className,
    description,
    userNote,
}: ArticleProseContentProps) {
    if (!content) {
        return (
            <div className="space-y-6">
                {(description || userNote) && (
                    <blockquote className="border-l-4 border-primary/30 bg-muted/30 pl-4 italic text-muted-foreground prose prose-sm max-w-none">
                        <div
                            dangerouslySetInnerHTML={{
                                __html: userNote || description || "",
                            }}
                        />
                    </blockquote>
                )}
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mx-auto max-w-md">
                        <p className="text-sm text-muted-foreground">
                            This article doesn&apos;t have any content available.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <article className={cn(PROSE_CLASSES, className)}>
            <AnimatedContent contentKey={contentKey || ""} className="">
                <div
                    className="text-xl leading-relaxed"
                    style={SERIF_FONT_STYLE}
                    dangerouslySetInnerHTML={{ __html: content }}
                />
            </AnimatedContent>
        </article>
    )
})
