"use client"
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useReaderStore } from "@/stores/reader"
import { useEffect, useRef, useState } from "react"
import {
    addAnnotation,
    getUserRoleFromId,
} from "../../app/(protected)/library/[id]/actions"
import useHighlight from "../../hooks/reader/use-highlight"
import { EpubHighlight, Highlight } from "../../types/library"

import { useAIAction } from "@/hooks/use-ai-action"
import { UserRole } from "@/lib/db/schema"
import { createClient } from "@/lib/supabase/client"
import { User } from "@supabase/supabase-js"
import { useShallow } from "zustand/react/shallow"
import GeneralPopover from "./general-popover"
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

export const useUserRole = () => {
    const [user, setUser] = useState<User | null>(null)
    const [userRole, setUserRole] = useState<UserRole | undefined>()
    const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        const fetchUserRole = async () => {
            try {
                const supabase = createClient()
                const {
                    data: { user },
                } = await supabase.auth.getUser()

                const role = await getUserRoleFromId(user?.id)
                setUser(user)
                setUserRole(role)
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err
                        : new Error("Failed to fetch user role")
                )
            } finally {
                setIsLoading(false)
            }
        }

        fetchUserRole()
    }, [])

    return { userRole, user, isLoading, error }
}

export default function HighlightPopover({
    savedHighlights,
}: {
    savedHighlights: Highlight[]
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [showNoteForm, setShowNoteForm] = useState(false)

    const {
        getPageProgress,
        highlights,
        currentPage,
        setActiveAIAction,
        abortAndResetController,
    } = useReaderStore(
        useShallow((state) => ({
            getPageProgress: state.getPageProgress,
            highlights: state.highlights,
            currentPage: state.currentPage,
            setActiveAIAction: state.setActiveAIAction,
            abortAndResetController: state.abortAndResetController,
        }))
    )

    // Get the user role
    const { userRole } = useUserRole()

    // Use the AI action hook
    const { handleAIAction } = useAIAction()

    const {
        isPopupOpen,
        setIsPopupOpen,
        highlightedText,
        handleHighlight,
        handleRemoveHighlight,
        rangeRef,
    } = useHighlight(savedHighlights)

    // Add click-outside and blur handlers
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                // Cancel any ongoing requests when popover closes
                useReaderStore.getState().abortAndResetController()

                setIsPopupOpen(false)
                setShowNoteForm(false)
            }
        }

        const handleBlur = (event: FocusEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                // Cancel any ongoing requests when popover loses focus
                useReaderStore.getState().abortAndResetController()

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
        (h) => (h.highlight as EpubHighlight).text === highlightedText
    )

    const handleSubmitNote = (note: string) => {
        if (!highlightedText) return
        addAnnotation(note, highlightedText)

        const found = highlights.find(
            (h) => (h.highlight as EpubHighlight).text === highlightedText
        )
        if (found) found.highlight.note = note
        setIsPopupOpen(false)
    }

    const handleAIActionWrapper = async (actionType: string) => {
        const selection = window.getSelection()
        const selectedText = selection?.toString().trim() || ""

        setIsPopupOpen(false)
        abortAndResetController?.()

        // Use the hook's handleAIAction method
        await handleAIAction(
            actionType,
            selectedText,
            userRole || "basic",
            currentPage,
            undefined // no imageUrl for highlight-popover
        )
    }

    if (!rangeRef.current || !isPopupOpen) {
        return null
    }

    const range = rangeRef.current as unknown as Range
    const rect = range.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const spaceAbove = rect.top
    const spaceBelow = viewportHeight - rect.bottom
    const popoverHeight = 40 // Approximate height of the popover

    const style = {
        position: "absolute",
        top:
            spaceAbove > popoverHeight
                ? `${window.scrollY + rect.top - 10}px`
                : `${window.scrollY + rect.bottom + 10}px`,
        left: `${window.scrollX + rect.left + rect.width / 2}px`,
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
                    <GeneralPopover handleAIAction={handleAIActionWrapper} />
                    <div id="highlight-options" className="hidden mt-1">
                        <HighlightColorOptions
                            handleHighlight={handleHighlight}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
