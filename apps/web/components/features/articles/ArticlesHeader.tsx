import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SidebarLeftTrigger } from "@/components/ui/sidebar"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { CheckCheck, Eye, EyeOff, RefreshCw } from "lucide-react"
import { useArticlesContext } from "./ArticlesContext"

export function ArticlesHeader() {
    const {
        sidebarTitle,
        unreadCount,
        showUnreadOnly,
        isReadLaterMode,
        feedId,
        folderId,
        isDeepRefreshing,
        isMarkingAllRead,
        toggleShowUnreadOnly,
        handleDeepRefresh,
        handleMarkAllAsRead,
    } = useArticlesContext()

    return (
        <div className="flex-shrink-0 flex items-center justify-between border-b px-4 py-3 h-[60px]">
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <SidebarLeftTrigger className="flex-shrink-0" />
                <h1 className="text-lg font-semibold truncate">{sidebarTitle}</h1>
                {unreadCount > 0 && (
                    <Badge
                        variant="outline"
                        className="min-w-3 px-2 flex-shrink-0"
                    >
                        {unreadCount}
                    </Badge>
                )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                {!isReadLaterMode && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={
                                        showUnreadOnly ? "default" : "ghost"
                                    }
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={toggleShowUnreadOnly}
                                >
                                    {showUnreadOnly ? (
                                        <Eye className="h-4 w-4" />
                                    ) : (
                                        <EyeOff className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {showUnreadOnly
                                    ? "Show all articles"
                                    : "Show unread only"}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {feedId && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={handleDeepRefresh}
                                    disabled={isDeepRefreshing}
                                >
                                    <RefreshCw
                                        className={`h-4 w-4 ${isDeepRefreshing
                                            ? "animate-spin"
                                            : ""
                                            }`}
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                Check for new articles
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {(feedId || folderId) && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={handleMarkAllAsRead}
                                    disabled={isMarkingAllRead}
                                >
                                    <CheckCheck className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mark all as read</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    )
}
