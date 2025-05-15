import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function BookCardSkeleton() {
    return (
        <Card className="h-full flex flex-col overflow-hidden">
            <Skeleton className="w-full pt-[60%]" />
            <CardContent className="flex-1 p-4 space-y-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-20 w-full" />
                <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                </div>
            </CardContent>
        </Card>
    )
}

export function BookCardListSkeleton() {
    return (
        <Card>
            <div className="p-4 flex gap-4">
                <Skeleton className="w-[80px] h-[120px] shrink-0" />
                <div className="flex-1 space-y-4">
                    <Skeleton className="h-6 w-3/4" />
                    <div className="flex items-center space-x-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-1/4" />
                    </div>
                    <Skeleton className="h-16 w-full" />
                    <div className="flex justify-between">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-1/4" />
                    </div>
                </div>
            </div>
            <Skeleton className="h-1 w-full" />
        </Card>
    )
}
