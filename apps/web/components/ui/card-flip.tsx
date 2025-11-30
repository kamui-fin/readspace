"use client"

import { cn } from "@/lib/utils"
import { ArrowDown } from "lucide-react"

interface CardFlipProps {
    front: React.ReactNode
    back: React.ReactNode
    className?: string
    onClick?: () => void
    reviewCount?: number
    isRevealed?: boolean
    dropdownMenu?: React.ReactNode
}

export function CardFlip({
    front,
    back,
    className,
    onClick,
    reviewCount,
    isRevealed = false,
    dropdownMenu,
}: CardFlipProps) {
    const handleClick = () => {
        onClick?.()
    }

    return (
        <div
            className={cn(
                "w-full flex flex-col bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden relative",
                className
            )}
        >
            {/* Card header with dropdown menu */}
            <div className="flex justify-end items-start w-full min-h-[2.5rem] px-2 pt-2">
                {dropdownMenu}
            </div>

            {/* Card content */}
            {!isRevealed ? (
                <div className="flex-1 p-8 pb-[2.5rem] min-h-[200px] flex flex-col items-center justify-center">
                    <div className="text-center text-lg">{front}</div>
                </div>
            ) : (
                <div className="pb-[2.5rem]">
                    <div className="flex-1 flex flex-col items-center justify-center pt-8 pb-4 px-8">
                        <div className="text-center text-lg mb-4">{front}</div>
                    </div>
                    {/* Divider full width, outside padding */}
                    <div className="w-full border-t border-dashed border-zinc-300 dark:border-zinc-700 animate-fade-in" />
                    <div className="flex-1 flex flex-col items-center justify-center pb-8 pt-4 px-8">
                        <div className="text-center text-lg mt-4">{back}</div>
                    </div>
                </div>
            )}

            {/* Next side button */}
            <div
                className="border-t border-zinc-100 dark:border-zinc-800 p-3 flex justify-center items-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                onClick={handleClick}
            >
                <div className="flex items-center text-sm text-zinc-500 dark:text-zinc-400">
                    <ArrowDown className="h-4 w-4 mr-2" />
                    Next Side
                    <span className="ml-2 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs">
                        SPACE
                    </span>
                </div>
            </div>

            {/* Review indicator */}
            {reviewCount !== undefined && (
                <div className="flex items-center justify-start px-4 py-2 text-xs text-zinc-500">
                    <span className="flex items-center">
                        <svg
                            className="w-3 h-3 mr-1"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
                                fill="currentColor"
                            />
                        </svg>
                        {reviewCount} Review
                    </span>
                </div>
            )}
        </div>
    )
}
