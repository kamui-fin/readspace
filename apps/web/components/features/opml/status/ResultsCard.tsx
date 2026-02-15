import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, FileText } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { OpmlImportTask } from "@readspace/shared"

interface ResultsCardProps {
    task: OpmlImportTask
}

export function ResultsCard({ task }: ResultsCardProps) {
    const [showErrorDetails, setShowErrorDetails] = useState(false)
    const { result, metadata } = task

    if (!result) return null

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <CardTitle className="text-lg mb-3">
                                Import Complete
                            </CardTitle>
                            <div className="space-y-2">
                                {metadata?.filename && (
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground truncate">
                                            {metadata.filename}
                                        </span>
                                    </div>
                                )}
                                <div className="text-sm text-muted-foreground">
                                    Your OPML file has been successfully
                                    processed.
                                </div>
                            </div>
                        </div>
                    </div>
                    {metadata?.created_at && (
                        <div className="text-xs text-muted-foreground pl-9">
                            Started:{" "}
                            {new Date(metadata.created_at).toLocaleString()}
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-secondary/10 rounded-lg border border-secondary/20">
                        <div className="flex items-center gap-3 sm:flex-col sm:gap-2">
                            <div className="text-2xl font-semibold text-secondary">
                                {result.successful || 0}
                            </div>
                            <div className="text-sm font-medium text-secondary">
                                Successfully Imported
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                        <div className="flex items-center gap-3 sm:flex-col sm:gap-2">
                            <div className="text-2xl font-semibold text-yellow-700 dark:text-yellow-400">
                                {result.already_existed || 0}
                            </div>
                            <div className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                                Already Existed
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                        <div className="flex items-center gap-3 sm:flex-col sm:gap-2">
                            <div className="text-2xl font-semibold text-destructive">
                                {result.failed || 0}
                            </div>
                            <div className="text-sm font-medium text-destructive">
                                Import Failed
                            </div>
                        </div>
                    </div>
                </div>

                {result.errors && result.errors.length > 0 && (
                    <div className="border-t pt-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                setShowErrorDetails(!showErrorDetails)
                            }
                            className="text-muted-foreground hover:text-foreground"
                        >
                            {showErrorDetails ? "Hide" : "Show"} failed feeds (
                            {result.errors.length})
                        </Button>

                        {showErrorDetails && (
                            <div className="mt-3 max-h-48 overflow-y-auto space-y-2">
                                {result.errors.map((error, index) => (
                                    <div
                                        key={index}
                                        className="bg-red-500/10 border border-red-500/20 rounded p-3 text-sm"
                                    >
                                        <div className="font-medium text-red-900 dark:text-red-300">
                                            {error.title || "Unknown feed"}
                                        </div>
                                        <div className="text-red-700 dark:text-red-400 text-xs mt-1 truncate">
                                            {error.url}
                                        </div>
                                        <div className="text-red-600 dark:text-red-400 text-xs mt-1">
                                            {error.error}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button asChild className="flex-1">
                        <Link href="/today">View Articles</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/import-opml">Import More</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
