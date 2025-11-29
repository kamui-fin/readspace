import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Activity, FileText, X } from "lucide-react"
import { OpmlImportTask } from "@readspace/shared"

interface ProgressCardProps {
    task: OpmlImportTask
    onCancel: () => void
    isCancelling: boolean
}

export function ProgressCard({ task, onCancel, isCancelling }: ProgressCardProps) {
    const { progress, metadata } = task

    if (!progress) return null

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <Activity className="h-6 w-6 text-blue-600 animate-pulse flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <CardTitle className="text-lg mb-3">
                                Import in Progress
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
                                    Processing {progress.completed} of {progress.total} feeds
                                </div>
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
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Progress</span>
                        <span>
                            {Math.round((progress.completed / progress.total) * 100)}%
                        </span>
                    </div>
                    <Progress
                        value={(progress.completed / progress.total) * 100}
                        className="h-2"
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-secondary/10 rounded-lg border border-secondary/20">
                        <div className="flex items-center gap-3 sm:flex-col sm:gap-1">
                            <div className="text-2xl font-semibold text-secondary">
                                {progress.successful}
                            </div>
                            <div className="text-sm font-medium text-secondary">
                                Successfully Imported
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                        <div className="flex items-center gap-3 sm:flex-col sm:gap-1">
                            <div className="text-2xl font-semibold text-yellow-700 dark:text-yellow-400">
                                {progress.already_existed}
                            </div>
                            <div className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                                Already Existed
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:text-center p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                        <div className="flex items-center gap-3 sm:flex-col sm:gap-1">
                            <div className="text-2xl font-semibold text-destructive">
                                {progress.failed}
                            </div>
                            <div className="text-sm font-medium text-destructive">
                                Import Failed
                            </div>
                        </div>
                    </div>
                </div>
                <div className="pt-2">
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
                </div>
            </CardContent>
        </Card>
    )
}
