"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"
import { Sparkles, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"

interface AiSummaryCardProps {
    summary: string
    onDismiss: () => void
}

export function AiSummaryCard({ summary, onDismiss }: AiSummaryCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
        >
            <Card className="mb-6 border-none bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/10 dark:from-primary/10 dark:via-secondary/10 dark:to-accent/15">
                <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 p-2 bg-gradient-to-br from-primary to-secondary rounded-lg">
                            <Sparkles className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-primary">
                                    AI Summary
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onDismiss}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkBreaks]}
                                    components={{
                                        // Container wrapper with styling
                                        div: ({ children }) => (
                                            <div
                                                className="whitespace-pre-wrap leading-relaxed"
                                                style={{
                                                    fontFamily:
                                                        "var(--font-inter)",
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
                                        code: ({ children }) => (
                                            <code className="bg-muted/50 px-1 py-0.5 rounded text-xs">
                                                {children}
                                            </code>
                                        ),
                                    }}
                                >
                                    {summary}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}
