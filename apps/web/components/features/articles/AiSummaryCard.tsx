"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"
import { Sparkles, X } from "lucide-react"
import { Markdown } from "@/components/ui/markdown"
import { cn } from "@/lib/utils"

interface AiSummaryCardProps {
    summary: string
    className?: string
    onDismiss: () => void
}

export function AiSummaryCard({ summary, className, onDismiss }: AiSummaryCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={cn("overflow-hidden", className)}
        >
            <Card className="border bg-card/50 shadow-sm">
                <CardContent className="p-5">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 ">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-medium text-foreground p-0 m-0!">
                                    AI Summary
                                </h3>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onDismiss}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        <div className="leading-relaxed text-muted-foreground prose prose-sm dark:prose-invert max-w-none">
                            <Markdown content={summary} />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}
