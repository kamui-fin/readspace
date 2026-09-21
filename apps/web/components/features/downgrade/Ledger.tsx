import { cn } from "@/lib/utils"
import { DISPLAY_SERIF } from "./constants"
import { ArrowRight } from "lucide-react"
import type { ReactNode } from "react"

export interface LedgerRow {
    label: string
    detail?: ReactNode
    /** The before -> after figure, set in the reading serif with tabular numerals. */
    figure: ReactNode
    /** Dim the figure for rows where nothing is lost. */
    quiet?: boolean
}

/**
 * A hairline-ruled ledger: what the reader has, and what it becomes. Flat, no cards,
 * the numbers do the talking.
 */
export function Ledger({ rows }: { rows: LedgerRow[] }) {
    return (
        <dl className="divide-y divide-border">
            {rows.map((row) => (
                <div
                    key={row.label}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 py-5 first:pt-0 last:pb-0"
                >
                    <dt className="text-sm font-medium text-foreground">
                        {row.label}
                    </dt>
                    <dd
                        className={cn(
                            "row-span-2 self-center text-[1.875rem] sm:text-[2.125rem] leading-none tabular-nums text-right whitespace-nowrap",
                            row.quiet
                                ? "text-muted-foreground"
                                : "text-foreground"
                        )}
                        style={{ fontFamily: DISPLAY_SERIF }}
                    >
                        {row.figure}
                    </dd>
                    {row.detail && (
                        <dd className="text-sm text-muted-foreground leading-relaxed max-w-[48ch]">
                            {row.detail}
                        </dd>
                    )}
                </div>
            ))}
        </dl>
    )
}

/** "142 -> 10" with a muted drawn arrow. */
export function Change({ from, to }: { from: ReactNode; to: ReactNode }) {
    return (
        <>
            <span className="text-muted-foreground">{from}</span>
            <ArrowRight
                aria-hidden
                strokeWidth={1.5}
                className="mx-2 inline size-4 align-middle text-muted-foreground/70"
            />
            <span className="sr-only"> becomes </span>
            {to}
        </>
    )
}
