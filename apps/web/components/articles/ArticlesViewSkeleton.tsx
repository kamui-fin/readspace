import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { SidebarLeftTrigger } from "@/components/ui/sidebar"
import { CheckCircle2, Eye, RefreshCw } from "lucide-react"

function ArticleItemSkeleton() {
    return (
        <div className="flex gap-3 py-2.5 px-3 animate-pulse border-b">
            <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 bg-muted rounded" />
                    <div className="h-2 w-20 bg-muted rounded" />
                    <div className="h-2 w-16 bg-muted rounded" />
                </div>
                <div className="h-4 w-5/6 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted/70 rounded" />
                <div className="h-3 w-full bg-muted/70 rounded" />
            </div>
            <div className="h-16 w-16 bg-muted/30 rounded-md" />
        </div>
    )
}

function ArticleContentSkeleton() {
    return (
        <div className="mx-auto max-w-3xl space-y-6 animate-pulse">
            <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
            <div className="flex items-center gap-2 mb-6">
                <div className="h-6 w-6 rounded-full bg-muted" />
                <div className="h-3 bg-muted rounded w-24" />
                <div className="h-3 bg-muted rounded w-16" />
                <div className="h-3 bg-muted rounded w-32" />
            </div>
            <div className="aspect-video w-full rounded-lg bg-muted/30 mb-6"></div>
            <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-5/6"></div>
            </div>
            <div className="space-y-3">
                <div className="h-4 bg-muted/70 rounded w-full"></div>
                <div className="h-4 bg-muted/70 rounded w-full"></div>
                <div className="h-4 bg-muted/70 rounded w-4/6"></div>
            </div>
        </div>
    )
}

interface ArticlesViewSkeletonProps {
    showUnreadBadge?: boolean
}

export function ArticlesViewSkeleton({
    showUnreadBadge = false,
}: ArticlesViewSkeletonProps) {
    return (
        <div className="flex h-full md:h-[calc(100vh-1rem)] w-full bg-background md:rounded-xl md:shadow-sm">
            {/* Desktop: Resizable panels */}
            <div className="hidden md:flex w-full">
                <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={35} minSize={15} maxSize={40}>
                        <div className="flex h-full flex-col border-r">
                            <div className="flex h-14 items-center justify-between border-b px-4">
                                <div className="flex items-center space-x-2 min-w-0 flex-1">
                                    <div className="h-6 w-40 bg-muted animate-pulse rounded" />
                                    {showUnreadBadge && (
                                        <Badge
                                            variant="outline"
                                            className="min-w-3 px-1 flex-shrink-0"
                                        >
                                            <div className="h-2 w-4 bg-muted animate-pulse rounded" />
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        disabled
                                    >
                                        <Eye className="h-4 w-4 opacity-50" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        disabled
                                    >
                                        <RefreshCw className="h-4 w-4 opacity-50" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto min-h-0">
                                <div className="h-full overflow-visible">
                                    {/* Date group header skeleton */}
                                    <div className="px-3 py-2.5 sticky top-0 bg-background/95 backdrop-blur-sm z-10 mt-1.5">
                                        <div className="flex items-center gap-2 animate-pulse">
                                            <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />
                                            <div className="h-3 w-16 bg-muted rounded" />
                                        </div>
                                    </div>
                                    {/* Article skeletons */}
                                    <ArticleItemSkeleton />
                                    <ArticleItemSkeleton />
                                    <ArticleItemSkeleton />
                                    <ArticleItemSkeleton />
                                    <ArticleItemSkeleton />
                                </div>
                            </div>
                        </div>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel
                        defaultSize={75}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-col h-full">
                            <div className="flex-1 p-8">
                                <ArticleContentSkeleton />
                            </div>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>

            {/* Mobile: Stacked layout */}
            <div className="flex md:hidden w-full h-full max-w-screen-sm mx-auto overflow-x-hidden">
                <div className="w-full h-full flex-col max-w-full overflow-x-hidden flex">
                    <div className="flex h-14 items-center justify-between border-b px-4 min-w-0">
                        <div className="flex items-center space-x-2 min-w-0 flex-1 max-w-[calc(100vw-6rem)]">
                            <SidebarLeftTrigger className="-ml-1" />
                            <div className="h-7 w-48 bg-muted animate-pulse rounded" />
                            {showUnreadBadge && (
                                <Badge
                                    variant="outline"
                                    className="min-w-3 px-1 flex-shrink-0"
                                >
                                    <div className="h-2 w-4 bg-muted animate-pulse rounded" />
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled
                            >
                                <Eye className="h-4 w-4 opacity-50" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled
                            >
                                <RefreshCw className="h-4 w-4 opacity-50" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto min-h-0 max-w-full overflow-x-hidden">
                        <div className="h-full">
                            {/* Date group header skeleton */}
                            <div className="px-3 py-2.5 sticky top-0 bg-background/95 backdrop-blur-sm z-10 mt-1.5">
                                <div className="flex items-center gap-2 animate-pulse">
                                    <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />
                                    <div className="h-3 w-16 bg-muted rounded" />
                                </div>
                            </div>
                            {/* Article skeletons */}
                            <ArticleItemSkeleton />
                            <ArticleItemSkeleton />
                            <ArticleItemSkeleton />
                            <ArticleItemSkeleton />
                            <ArticleItemSkeleton />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
