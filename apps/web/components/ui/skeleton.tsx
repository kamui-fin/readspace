import { cn } from "@readspace/shared"

function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-md bg-border dark:bg-border",
                className
            )}
            {...props}
        />
    )
}

export { Skeleton }
