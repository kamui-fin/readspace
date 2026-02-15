import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, FileText, X } from "lucide-react"
import { OpmlImportTask } from "@readspace/shared"

interface PendingCardProps {
    task: OpmlImportTask
    onCancel: () => void
    isCancelling: boolean
}

export function PendingCard({
    task,
    onCancel,
    isCancelling,
}: PendingCardProps) {
    const { metadata } = task

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <Clock className="h-6 w-6 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <CardTitle className="text-lg mb-3">
                                Import Queued
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
                                <p className="text-sm text-muted-foreground">
                                    Your import will start processing shortly.
                                    {metadata?.estimated_feeds && (
                                        <span>
                                            {" "}
                                            Estimated {
                                                metadata.estimated_feeds
                                            }{" "}
                                            feeds to process.
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                    {metadata?.created_at && (
                        <div className="text-xs text-muted-foreground pl-9">
                            Queued:{" "}
                            {new Date(metadata.created_at).toLocaleString()}
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                    disabled={isCancelling}
                    className="text-destructive hover:text-destructive"
                >
                    <X className="h-4 w-4 mr-2" />
                    {isCancelling ? "Cancelling..." : "Cancel Import"}
                </Button>
            </CardContent>
        </Card>
    )
}
