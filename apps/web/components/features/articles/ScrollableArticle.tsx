"use client"

import { memo, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

const SCROLLBAR_STYLE = { scrollbarGutter: "stable" } as const

interface ScrollableArticleProps {
    children: React.ReactNode
    onScroll?: (scrollTop: number) => void
    onClick?: () => void
    className?: string
}

export const ScrollableArticle = memo(function ScrollableArticle({
    children,
    onScroll,
    onClick,
    className,
}: ScrollableArticleProps) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!onScroll) return

        const el = ref.current
        if (!el) return

        const handleScroll = () => onScroll(el.scrollTop)
        el.addEventListener("scroll", handleScroll, { passive: true })
        return () => el.removeEventListener("scroll", handleScroll)
    }, [onScroll])

    return (
        <div
            ref={ref}
            className={cn(
                "flex-1 overflow-y-auto overflow-x-hidden scroll-smooth",
                className
            )}
            style={SCROLLBAR_STYLE}
            onClick={onClick}
        >
            <div className="mx-auto max-w-4xl">
                {children}
            </div>
        </div>
    )
})
