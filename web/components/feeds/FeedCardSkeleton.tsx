export function FeedCardSkeleton() {
    return (
        <div className="p-4">
            <div className="flex gap-4">
                <div className="relative">
                    <div className="w-9 h-9 rounded bg-muted animate-pulse" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                            <div className="h-3 w-1/3 bg-muted/70 rounded mt-1 animate-pulse" />
                            <div className="h-3 w-full bg-muted/50 rounded mt-2 animate-pulse" />
                        </div>

                        <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="h-6 w-16 bg-muted/30 rounded animate-pulse" />
                            <div className="h-8 w-14 bg-muted rounded animate-pulse" />
                        </div>
                    </div>

                    <div className="h-4 w-12 bg-muted/30 rounded mt-2 animate-pulse" />
                </div>
            </div>
        </div>
    )
}
