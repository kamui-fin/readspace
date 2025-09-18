import { Button } from "@/components/ui/button"
import { cn } from "@readspace/shared"
import { Eye, Plus } from "lucide-react"

interface FeedPreviewBannerProps {
    feedTitle?: string
    feedDescription?: string
    className?: string
    onFollow?: () => void
}

export function FeedPreviewBanner({
    feedTitle,
    className,
    onFollow,
}: FeedPreviewBannerProps) {
    return (
        <div
            className={cn(
                "z-20 w-full bg-orange-50/95 dark:bg-orange-950/95 backdrop-blur-sm border-b border-orange-200/60 dark:border-orange-800/60",
                className
            )}
        >
            <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-2">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 overflow-hidden">
                    <div className="flex-shrink-0">
                        <Eye className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <span className="text-sm font-medium text-orange-800 dark:text-orange-200 whitespace-nowrap">
                                Preview
                            </span>
                            {feedTitle && (
                                <>
                                    <span className="hidden sm:inline text-orange-500 dark:text-orange-400">
                                        •
                                    </span>
                                    <span className="text-xs sm:text-sm text-orange-700 dark:text-orange-300 truncate leading-tight">
                                        You are not yet subscribed to this feed
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex-shrink-0">
                    <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 sm:h-7 text-xs px-2 sm:px-3 bg-orange-600 hover:bg-orange-700 text-white dark:bg-orange-500 dark:hover:bg-orange-600 border-0 whitespace-nowrap"
                        onClick={onFollow}
                    >
                        <Plus className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">Follow</span>
                    </Button>
                </div>
            </div>
        </div>
    )
}
