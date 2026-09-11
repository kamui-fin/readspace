"use client"

import type { CodexWorthReadingItem } from "@readspace/shared"
import { CodexArticleRow } from "./CodexArticleRow"

interface WorthReadingStripProps {
    items: CodexWorthReadingItem[]
}

/**
 * Standalone pieces that never clustered, each with one plain line on why it stands alone.
 * A lean list — sits in the desktop rail, or full-width on a quiet day / narrow screens.
 * The reason rides inside each row so it stays in that row's vertical rhythm.
 */
export function WorthReadingStrip({ items }: WorthReadingStripProps) {
    if (items.length === 0) return null

    return (
        <section>
            <h2 className="mb-3 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Worth Reading
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {items.map(({ article, reason }) => (
                    <li key={article.id} className="p-1.5">
                        <CodexArticleRow
                            article={article}
                            dense
                            reason={reason}
                        />
                    </li>
                ))}
            </ul>
        </section>
    )
}
