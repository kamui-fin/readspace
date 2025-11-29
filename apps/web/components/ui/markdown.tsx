"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import { cn } from "@readspace/shared"

interface MarkdownProps {
    content: string
    className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
    return (
        <div className={cn("prose prose-sm dark:prose-invert max-w-none text-foreground", className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                    // Container wrapper with styling
                    div: ({ children }) => (
                        <div
                            className="whitespace-pre-wrap leading-relaxed"
                            style={{
                                fontFamily: "var(--font-inter)",
                            }}
                        >
                            {children}
                        </div>
                    ),
                    // Customize rendering to match design system
                    p: ({ children }) => (
                        <p className="mb-2 last:mb-0">
                            {children}
                        </p>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-semibold text-foreground">
                            {children}
                        </strong>
                    ),
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-1 my-2">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside space-y-1 my-2">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-sm">
                            {children}
                        </li>
                    ),
                    code: ({ children }) => {
                        // Remove backticks from inline code content
                        const cleanChildren =
                            typeof children === "string"
                                ? children.replace(
                                    /^`+|`+$/g,
                                    ""
                                )
                                : children
                        return (
                            <code className="bg-muted/50 px-1 py-0.5 rounded text-xs">
                                {cleanChildren}
                            </code>
                        )
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
