"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import { READING_SERIF } from "./constants"

interface CodexSynthesisProps {
    /** Markdown from the pipeline: 3–5 `- ` bullets, each with at most one `**bold**` anchor. */
    content: string
    className?: string
}

export function CodexSynthesis({ content, className }: CodexSynthesisProps) {
    if (!content?.trim()) return null

    return (
        <div
            style={{ fontFamily: READING_SERIF }}
            className={cn(
                "text-[17px] leading-relaxed text-foreground/85",
                className
            )}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    ul: ({ children }) => (
                        <ul className="list-disc space-y-2 pl-[1.1em] marker:text-muted-foreground/50">
                            {children}
                        </ul>
                    ),
                    li: ({ children }) => (
                        <li className="pl-0.5">{children}</li>
                    ),
                    p: ({ children }) => (
                        <p className="mb-2 last:mb-0">{children}</p>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold text-secondary">
                            {children}
                        </strong>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
