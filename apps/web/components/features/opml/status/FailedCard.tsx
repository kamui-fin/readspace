import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, XCircle } from "lucide-react"
import Link from "next/link"
import { OpmlImportTask } from "@readspace/shared"

interface FailedCardProps {
    task: OpmlImportTask
}

export function FailedCard({ task }: FailedCardProps) {
    const { metadata, error } = task

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <XCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <CardTitle className="text-lg mb-3">
                                Import Failed
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
                                <p className="text-sm text-destructive">
                                    {error || "The import process encountered an error."}
                                </p>
                            </div>
                        </div>
                    </div>
                    {metadata?.created_at && (
                        <div className="text-xs text-muted-foreground pl-9">
                            Started: {new Date(metadata.created_at).toLocaleString()}
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <Button asChild variant="outline">
                    <Link href="/import-opml">Try Again</Link>
                </Button>
            </CardContent>
        </Card>
    )
}
