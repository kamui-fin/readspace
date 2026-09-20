import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

interface AiSearchToggleProps {
    enabled: boolean
    onToggle: (enabled: boolean) => void
    className?: string
}

/**
 * Segmented control toggle between "Keywords" and "Smart" search modes.
 *
 * Using a segmented pill control resolves the classic UX dilemma of a toggle switch
 * with changing labels (where users cannot tell if the label is the current state
 * or the action to trigger). Both modes are visible side-by-side with the active
 * mode clearly highlighted.
 */
export function AiSearchToggle({
    enabled,
    onToggle,
    className,
}: AiSearchToggleProps) {
    return (
        <div
            role="radiogroup"
            aria-label="Search mode"
            className={cn(
                "inline-flex items-center p-0.5 rounded-xl bg-[#E8F0E4]/70 dark:bg-muted/50 border border-[#D8E5D0]/60 dark:border-border/50 text-[11px] md:text-xs select-none shrink-0",
                className
            )}
        >
            <button
                type="button"
                role="radio"
                aria-checked={!enabled}
                onClick={() => onToggle(false)}
                className={cn(
                    "px-2 md:px-2.5 py-1 rounded-lg font-medium transition-all duration-150 cursor-pointer",
                    !enabled
                        ? "bg-white dark:bg-background text-[#475143] dark:text-foreground shadow-2xs font-semibold"
                        : "text-[#737C6F] hover:text-[#475143] dark:text-muted-foreground dark:hover:text-foreground"
                )}
            >
                Keywords
            </button>
            <button
                type="button"
                role="radio"
                aria-checked={enabled}
                onClick={() => onToggle(true)}
                className={cn(
                    "inline-flex items-center gap-1 px-2 md:px-2.5 py-1 rounded-lg font-medium transition-all duration-150 cursor-pointer",
                    enabled
                        ? "bg-white dark:bg-background text-[#6A994E] dark:text-primary shadow-2xs font-semibold"
                        : "text-[#737C6F] hover:text-[#6A994E] dark:text-muted-foreground dark:hover:text-primary"
                )}
            >
                <Sparkles
                    className={cn(
                        "w-3 h-3 md:w-3.5 md:h-3.5 transition-colors",
                        enabled
                            ? "text-[#6A994E] fill-[#6A994E]/25 dark:text-primary"
                            : "text-[#91998C] dark:text-muted-foreground"
                    )}
                />
                <span>Smart</span>
            </button>
        </div>
    )
}
