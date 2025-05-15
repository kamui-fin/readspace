import { cn } from "@/lib/utils"

interface KbdProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode
}

function Kbd({ className, ...props }: KbdProps) {
    return (
        <kbd
            className={cn(
                "pointer-events-none inline-flex h-5 select-none items-center gap-1",
                "rounded border bg-muted px-1.5 font-mono text-[10px] font-medium",
                className
            )}
            {...props}
        />
    )
}

export { Kbd }
