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
    const modes = [
        { label: "Keywords", value: false },
        { label: "Smart", value: true },
    ]

    return (
        <div
            role="radiogroup"
            aria-label="Search mode"
            className={cn(
                "grid grid-cols-2 items-center gap-0.5 rounded-xl border border-[#D8E5D0]/60 bg-[#E8F0E4]/70 p-0.5 text-[11px] select-none shrink-0 dark:border-white/10 dark:bg-background md:text-xs",
                className
            )}
        >
            {modes.map(({ label, value }) => {
                const selected = enabled === value

                return (
                    <button
                        key={label}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onToggle(value)}
                        onKeyDown={(event) => {
                            let next: boolean
                            switch (event.key) {
                                case "ArrowLeft":
                                case "ArrowRight":
                                case "ArrowUp":
                                case "ArrowDown":
                                    next = !value
                                    break
                                case "Home":
                                    next = false
                                    break
                                case "End":
                                    next = true
                                    break
                                default:
                                    return
                            }
                            event.preventDefault()
                            onToggle(next)
                            event.currentTarget.parentElement
                                ?.querySelectorAll<HTMLButtonElement>(
                                    '[role="radio"]'
                                )
                                [next ? 1 : 0]?.focus()
                        }}
                        className={cn(
                            "inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2 font-medium cursor-pointer transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-1 focus-visible:ring-offset-background md:px-2.5",
                            selected
                                ? "bg-white text-secondary shadow-2xs dark:bg-white/10"
                                : "text-[#737C6F] hover:bg-white/40 hover:text-[#475143] dark:text-muted-foreground dark:hover:bg-white/5 dark:hover:text-foreground"
                        )}
                    >
                        {value && (
                            <Sparkles
                                aria-hidden="true"
                                className="h-3 w-3 shrink-0 md:h-3.5 md:w-3.5"
                            />
                        )}
                        <span>{label}</span>
                    </button>
                )
            })}
        </div>
    )
}
