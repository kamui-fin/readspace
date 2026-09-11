import { Skeleton } from "@/components/ui/skeleton"

/**
 * Newspaper-shaped placeholder for the finished digest — same masthead / main-column / 320px
 * rail geometry as CodexView, so the switch to real content doesn't move the page. Shown
 * while the latest digest row is still loading (CodexScreen), not while it generates (that's
 * CodexGenerating, which is a different, phase-aware surface).
 */
export function CodexSkeleton() {
    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            {/* Masthead */}
            <header className="border-b border-border pb-6">
                <div className="flex items-center gap-2">
                    <Skeleton className="size-4 rounded" />
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="mt-4 h-7 w-full max-w-2xl" />
                <Skeleton className="mt-2 h-7 w-3/4 max-w-xl" />
                <Skeleton className="mt-3 h-3 w-52" />
            </header>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
                {/* Main column — Developments */}
                <main className="min-w-0">
                    <Skeleton className="mb-4 h-3 w-28" />
                    <div className="space-y-5">
                        <DevelopmentCardSkeleton featured />
                        <DevelopmentCardSkeleton />
                    </div>
                </main>

                {/* Right rail */}
                <aside className="hidden lg:block">
                    <div className="space-y-6">
                        <RailCardSkeleton lines={2} />
                        <RailCardSkeleton lines={3} chips />
                        <RailCardSkeleton lines={4} />
                    </div>
                </aside>
            </div>
        </div>
    )
}

function DevelopmentCardSkeleton({ featured = false }: { featured?: boolean }) {
    return (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
            {/* Hero band — reserved on the featured card so the real hero/strip swap
                happens inside the card, never as a page shift. */}
            {featured && (
                <Skeleton className="aspect-[16/9] w-full rounded-none border-b border-border sm:aspect-[2/1]" />
            )}
            <div className="space-y-3 p-4 sm:p-5">
                <Skeleton className={featured ? "h-6 w-4/5" : "h-5 w-3/4"} />
                <div className="space-y-2 pt-1">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-[92%]" />
                    <Skeleton className="h-3.5 w-[85%]" />
                    <Skeleton className="h-3.5 w-2/3" />
                </div>
                <div className="flex items-center gap-2 pt-2">
                    <Skeleton className="size-5 rounded-full" />
                    <Skeleton className="size-5 rounded-full" />
                    <Skeleton className="size-5 rounded-full" />
                    <Skeleton className="ml-auto h-3 w-16" />
                </div>
            </div>
            <div className="border-t border-border px-4 py-3 sm:px-5">
                <Skeleton className="h-3 w-24" />
            </div>
        </div>
    )
}

function RailCardSkeleton({
    lines,
    chips = false,
}: {
    lines: number
    chips?: boolean
}) {
    return (
        <div className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="mb-3 h-3 w-20" />
            {chips ? (
                <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-6 w-24 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                </div>
            ) : (
                <div className="space-y-2">
                    {Array.from({ length: lines }).map((_, i) => (
                        <Skeleton
                            key={i}
                            className="h-3.5"
                            style={{ width: `${90 - i * 12}%` }}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
