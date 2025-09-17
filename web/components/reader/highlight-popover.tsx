"use client"
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSidebarLeft } from "@/components/ui/sidebar"
import { useReaderStore } from "@/stores/reader"
import { useEffect, useRef, useState } from "react"
import useHighlight from "../../hooks/reader/use-highlight"
import { EpubHighlight } from "../../types/library"
import { useIsMobile } from "@/hooks/use-mobile"

import { ApiClient } from "@readspace/shared"
import { useMutation } from "@tanstack/react-query"
import { useShallow } from "zustand/react/shallow"
import HighlightColorOptions from "./highlight-options"
import HighlightedPopover, { AddNoteForm } from "./highlighted-popover"

export const CustomTooltip = ({
    children,
    content,
}: {
    children: React.ReactNode
    content: string
}) => {
    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>{children}</TooltipTrigger>
                <TooltipContent
                    className="max-w-[150px] text-xs px-2 py-1"
                    sideOffset={8}
                >
                    <p>{content}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export default function HighlightPopover({
    savedHighlights,
}: {
    savedHighlights: EpubHighlight[]
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [showNoteForm, setShowNoteForm] = useState(false)
    const isMobile = useIsMobile()

    const { state: sidebarState } = useSidebarLeft()

    const { highlights } = useReaderStore(
        useShallow((state) => ({
            highlights: state.highlights,
        }))
    )

    const {
        isPopupOpen,
        setIsPopupOpen,
        highlightedText,
        handleHighlight,
        handleRemoveHighlight,
        rangeRef,
    } = useHighlight(savedHighlights)

    const addAnnotationMutation = useMutation({
        mutationFn: ({ note, text }: { note: string; text: string }) =>
            ApiClient.put(
                `/api/highlights/text/${encodeURIComponent(text)}/note`,
                { note }
            ),
        onError: (err: Error) =>
            console.error("Failed to add annotation:", err),
    })

    // Add click-outside and blur handlers
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsPopupOpen(false)
                setShowNoteForm(false)
            }
        }

        const handleBlur = (event: FocusEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsPopupOpen(false)
                setShowNoteForm(false)
            }
        }

        if (isPopupOpen) {
            document.addEventListener("mousedown", handleClickOutside)
            document.addEventListener("blur", handleBlur, true)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
            document.removeEventListener("blur", handleBlur, true)
        }
    }, [isPopupOpen, setIsPopupOpen])

    const isHighlighted =
        rangeRef.current?.className !== undefined &&
        rangeRef.current.className.startsWith("highlight")

    const selectedHighlight = highlights.find(
        (h) => (h.highlight as EpubHighlight).original_text === highlightedText
    )

    const handleSubmitNote = (note: string) => {
        if (!highlightedText) return
        addAnnotationMutation.mutate({ note, text: highlightedText })

        const found = highlights.find(
            (h) =>
                (h.highlight as EpubHighlight).original_text === highlightedText
        )
        if (found) found.highlight.note = note
        setIsPopupOpen(false)
    }

    if (!rangeRef.current || !isPopupOpen || isMobile) {
        return null
    }

    const range = rangeRef.current as unknown as Range
    const rect = range.getBoundingClientRect()
    const spaceAbove = rect.top
    const popoverHeight = 40 // Approximate height of the popover

    // Calculate left offset based on sidebar state
    const sidebarOffset = sidebarState === "expanded" ? -270 : 0 // 3rem = 48px

    const style = {
        position: "absolute",
        top:
            spaceAbove > popoverHeight
                ? `${window.scrollY + rect.top - 10}px`
                : `${window.scrollY + rect.bottom + 10}px`,
        left: `${window.scrollX + rect.left + rect.width / 2 + sidebarOffset}px`,
        transform:
            spaceAbove > popoverHeight
                ? "translate(-50%, -100%)"
                : "translate(-50%, 0)",
        zIndex: 1000,
    } as React.CSSProperties

    return (
        <div ref={containerRef} style={style} className="p-0 w-auto">
            {showNoteForm ? (
                <div className="p-4 rounded-lg shadow-lg w-[300px]">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-semibold">Add Note</h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowNoteForm(false)}
                            className="h-8 w-8 p-0"
                        >
                            ×
                        </Button>
                    </div>
                    <AddNoteForm
                        onSubmit={handleSubmitNote}
                        defaultVal="Add a new note"
                    />
                </div>
            ) : isHighlighted && selectedHighlight ? (
                <HighlightedPopover
                    selectedHighlight={
                        selectedHighlight.highlight as EpubHighlight
                    }
                    handleRemoveHighlight={handleRemoveHighlight}
                    handleSubmitNote={handleSubmitNote}
                />
            ) : (
                <div className="flex flex-col gap-3 popover-animation bg-background/0">
                    {/* <GeneralPopover /> */}
                    <HighlightColorOptions handleHighlight={handleHighlight} />
                </div>
            )}
        </div>
    )
}
