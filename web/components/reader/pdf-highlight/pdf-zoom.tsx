"use client"

import { ChevronDown, Minus, Plus } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ZoomValue } from "@/types/library"

// Global storage key for zoom preference
const STORAGE_KEY = "pdf-zoom-level"

interface PdfZoomProps extends React.HTMLAttributes<HTMLDivElement> {
    onZoomChange: (zoom: ZoomValue) => void
    initialZoom?: ZoomValue
    minZoom?: number
    maxZoom?: number
}

export function PdfZoom({
    className,
    onZoomChange,
    initialZoom = "auto",
    minZoom = 0.5,
    maxZoom = 4,
    ...props
}: PdfZoomProps) {
    // Initialize zoom from localStorage or use initialZoom as fallback
    const [zoom, setZoom] = React.useState<ZoomValue>(() => {
        if (typeof window === "undefined") return initialZoom

        try {
            const savedZoom = localStorage.getItem(STORAGE_KEY)
            if (savedZoom) {
                const parsed = JSON.parse(savedZoom)
                return parsed
            }
        } catch (e) {
            console.error("Error loading zoom from localStorage:", e)
        }

        return initialZoom
    })

    const inputRef = React.useRef<HTMLInputElement>(null)

    const presetZoomLevels: ZoomValue[] = [
        "auto",
        "page-fit",
        "page-width",
        "page-actual",
        "page-height",
        0.5,
        0.75,
        1,
        1.25,
        1.5,
        2,
        3,
        4,
    ]

    const handleZoomChange = (newZoom: ZoomValue) => {
        if (typeof newZoom === "number") {
            // Clamp zoom between min and max values
            const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom))
            setZoom(clampedZoom)
            onZoomChange(clampedZoom)

            // Save to localStorage
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(clampedZoom))
            } catch (e) {
                console.error("Error saving zoom to localStorage:", e)
            }
        } else {
            // Handle string zoom values
            setZoom(newZoom)
            onZoomChange(newZoom)

            // Save to localStorage
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newZoom))
            } catch (e) {
                console.error("Error saving zoom to localStorage:", e)
            }
        }
    }

    const handleZoomIn = () => {
        if (typeof zoom === "number") {
            handleZoomChange(zoom + 0.25)
        } else {
            // Default to 1 if current zoom is a string value
            handleZoomChange(1)
        }
    }

    const handleZoomOut = () => {
        if (typeof zoom === "number") {
            handleZoomChange(zoom - 0.25)
        } else {
            // Default to 1 if current zoom is a string value
            handleZoomChange(0.75)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/%$/, "") // Remove % if present

        // Check if value is one of the special values
        if (["auto", "page-fit", "page-width"].includes(value)) {
            handleZoomChange(value as ZoomValue)
            return
        }

        // Try to parse as number
        const numValue = Number.parseInt(value.replace(/[^0-9]/g, ""), 10)
        if (!isNaN(numValue)) {
            handleZoomChange(numValue / 100) // Convert from percentage to decimal
        }
    }

    const handleInputBlur = () => {
        // Ensure the input shows the current zoom value
        updateInputDisplay()
    }

    const handleInputFocus = () => {
        // Remove the % sign when focusing
        if (inputRef.current) {
            if (typeof zoom === "number") {
                inputRef.current.value = (zoom * 100).toString()
            } else {
                inputRef.current.value = zoom
            }
            inputRef.current.select()
        }
    }

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            inputRef.current?.blur()
        }
    }

    // Helper to update input display based on zoom value
    const updateInputDisplay = () => {
        if (inputRef.current) {
            if (typeof zoom === "number") {
                inputRef.current.value = `${Math.round(zoom * 100)}%`
            } else {
                // For string values, display them directly
                inputRef.current.value = zoom
            }
        }
    }

    // Update input value when zoom changes
    React.useEffect(() => {
        updateInputDisplay()
    }, [zoom])

    // Format display for dropdown menu
    const formatZoomDisplay = (level: ZoomValue) => {
        if (typeof level === "number") {
            return `${level * 100}%`
        }
        return level
    }

    return (
        <div
            className={cn(
                "inline-flex items-center rounded-md border bg-background",
                className
            )}
            {...props}
        >
            <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={typeof zoom === "number" && zoom <= minZoom}
                title="Zoom out"
                className="hidden md:flex md:items-center h-6 w-7 p-0 rounded-r-none"
            >
                <Minus className="h-3.5 w-3.5" />
            </Button>

            <div className="relative flex items-center border-l border-r">
                <Input
                    ref={inputRef}
                    defaultValue={
                        typeof zoom === "number" ? `${zoom * 100}%` : zoom
                    }
                    className="h-6 w-16 text-center text-xs border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    aria-label="Zoom percentage"
                />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-5 p-0 absolute right-0"
                            title="Zoom presets"
                        >
                            <ChevronDown className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {presetZoomLevels.map((level) => (
                            <DropdownMenuItem
                                key={typeof level === "number" ? level : level}
                                onClick={() => handleZoomChange(level)}
                                className={cn(
                                    "cursor-pointer text-xs",
                                    zoom === level && "font-medium bg-accent"
                                )}
                            >
                                {formatZoomDisplay(level)}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={typeof zoom === "number" && zoom >= maxZoom}
                title="Zoom in"
                className="hidden md:flex md:items-center h-6 w-7 p-0 rounded-l-none"
            >
                <Plus className="h-3.5 w-3.5" />
            </Button>
        </div>
    )
}
