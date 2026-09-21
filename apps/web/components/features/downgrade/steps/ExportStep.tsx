"use client"

import { Button } from "@/components/ui/button"
import { opmlExportFilename } from "@readspace/shared"
import { Check, Download, FileText } from "lucide-react"

interface ExportStepProps {
    feedCount: number
    folderCount: number
    hasExported: boolean
    onExport: () => void
}

/** The export as a concrete file the reader is about to keep, not an abstract promise. */
export function ExportStep({
    feedCount,
    folderCount,
    hasExported,
    onExport,
}: ExportStepProps) {
    return (
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 min-w-0">
                <div className="size-11 shrink-0 rounded-md border border-border bg-background flex items-center justify-center text-muted-foreground">
                    {hasExported ? (
                        <Check
                            className="size-5 text-primary"
                            strokeWidth={1.75}
                        />
                    ) : (
                        <FileText className="size-5" strokeWidth={1.5} />
                    )}
                </div>
                <div className="min-w-0">
                    <p className="font-mono text-[13px] text-foreground truncate">
                        {opmlExportFilename()}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                        {hasExported
                            ? "Saved to your downloads"
                            : `${feedCount} feeds in ${folderCount} ${folderCount === 1 ? "folder" : "folders"}`}
                    </p>
                </div>
            </div>
            <Button
                variant={hasExported ? "outline" : "default"}
                onClick={onExport}
                className="shrink-0"
            >
                <Download className="size-4" />
                {hasExported ? "Download again" : "Download"}
            </Button>
        </div>
    )
}
