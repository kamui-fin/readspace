import {
    ArrowDownWideNarrow,
    ChevronDown,
    DraftingCompass,
    HelpCircle,
    Highlighter,
    Layers2,
    Shapes,
    UnfoldVertical,
    Zap,
} from "lucide-react"

import { usePdfHighlighterContext } from "@/app/(protected)/library/[id]/pdf-highlight/contexts/PdfHighlighterContext"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useReaderStore } from "@/stores/reader"
import { createElement, Fragment, useEffect, useState } from "react"
import { Button } from "../ui/button"

// Define all possible actions
const allActions = [
    {
        id: "simplify",
        icon: ArrowDownWideNarrow,
        tooltip: "Simplify",
        action: "simplify",
        group: 1,
    },
    {
        id: "flashcards",
        icon: Layers2,
        tooltip: "Flashcards",
        action: "createFlashcard",
        group: 1,
    },
    {
        id: "examples",
        icon: DraftingCompass,
        tooltip: "Examples",
        action: "examples",
        group: 1,
    },
    {
        id: "visualize",
        icon: Shapes,
        tooltip: "Visualize",
        action: "createDiagram",
        group: 1,
    },
    {
        id: "expand",
        icon: UnfoldVertical,
        tooltip: "Expand",
        action: "tellMeMore",
        group: 1,
    },
    { id: "solve", icon: Zap, tooltip: "Solve", action: "solve", group: 2 },
    {
        id: "ask",
        icon: HelpCircle,
        tooltip: "Ask Anything",
        action: "custom",
        group: 2,
    },
]

const GeneralPopover = ({
    handleAIAction,
}: {
    handleAIAction: (actionType: string) => void
}) => {
    const bookType = useReaderStore((state) => state.bookType)
    const [isCardOpen, setIsCardOpen] = useState(false)
    const [showHighlightButton, setShowHighlightButton] = useState(true)

    let getCurrentSelection = undefined

    if (bookType === "pdf") {
        getCurrentSelection = usePdfHighlighterContext().getCurrentSelection
    }

    useEffect(() => {
        if (getCurrentSelection) {
            const selection = getCurrentSelection()
            if (selection?.type === "area" && selection.content.image) {
                setShowHighlightButton(false)
            } else {
                setShowHighlightButton(true)
            }
        }
    }, [getCurrentSelection])

    // Handle highlight button click
    const handleHighlightClick = () => {
        const highlightOptions = document.getElementById("highlight-options")
        if (highlightOptions) {
            highlightOptions.classList.toggle("hidden")
        }
    }

    // Split actions based on screen size (example: keep 2 main actions on mobile)
    const visibleActionsDesktop = allActions.filter((a) => a.group === 1) // Show all group 1 on desktop
    const visibleActionsMobile = visibleActionsDesktop.slice(0, 2) // Show first 2 on mobile
    const dropdownActionsDesktop = allActions.filter((a) => a.group === 2)
    const dropdownActionsMobile = [
        ...allActions.filter((a) => a.group === 1).slice(2), // The rest of group 1
        ...allActions.filter((a) => a.group === 2), // All of group 2
    ]

    return (
        <div className="p-1 rounded-md border shadow-md w-auto z-50 bg-background">
            <div className="flex items-center gap-1">
                {/* Highlight button */}
                {showHighlightButton && (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 cursor-pointer flex items-center gap-2"
                            onClick={handleHighlightClick}
                            title="Highlight"
                        >
                            <Highlighter className="h-4 w-4" />
                        </Button>
                        <Separator
                            orientation="vertical"
                            className="h-6 mx-1"
                        />
                    </>
                )}

                {/* Visible action buttons - Desktop */}
                <div className="hidden md:flex items-center gap-1">
                    {visibleActionsDesktop.map((button, index) => (
                        <Fragment key={`desktop-${button.id}`}>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 cursor-pointer flex items-center gap-2"
                                onClick={() => handleAIAction(button.action)}
                            >
                                {createElement(button.icon, {
                                    className: "h-4 w-4",
                                })}
                                <span className="text-sm">
                                    {button.tooltip}
                                </span>
                            </Button>
                            {index < visibleActionsDesktop.length - 1 && (
                                <Separator
                                    orientation="vertical"
                                    className="h-6 mx-1"
                                />
                            )}
                        </Fragment>
                    ))}
                </div>

                {/* Visible action buttons - Mobile */}
                <div className="flex md:hidden items-center gap-1">
                    {visibleActionsMobile.map((button, index) => (
                        <Fragment key={`mobile-${button.id}`}>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 cursor-pointer flex items-center gap-2"
                                onClick={() => handleAIAction(button.action)}
                            >
                                {createElement(button.icon, {
                                    className: "h-4 w-4",
                                })}
                                <span className="text-sm">
                                    {button.tooltip}
                                </span>
                            </Button>
                            {/* Add separator if not the last visible mobile button AND there are dropdown items */}
                            {index < visibleActionsMobile.length - 1 &&
                                dropdownActionsMobile.length > 0 && (
                                    <Separator
                                        orientation="vertical"
                                        className="h-6 mx-1"
                                    />
                                )}
                        </Fragment>
                    ))}
                </div>

                {/* Separator before dropdown (only if dropdown has items) */}
                {(dropdownActionsDesktop.length > 0 ||
                    dropdownActionsMobile.length > 0) && (
                    <Separator orientation="vertical" className="h-6 mx-1" />
                )}

                {/* Dropdown menu - Content changes based on screen size */}
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setIsCardOpen(!isCardOpen)}
                    >
                        <ChevronDown
                            className={`h-4 w-4 transition-transform ${isCardOpen ? "rotate-180" : ""}`}
                        />
                    </Button>

                    {isCardOpen && (
                        <div
                            className="absolute right-0 mt-2 p-1.5 z-50 w-max rounded-md border shadow-md bg-background animate-in fade-in-50 zoom-in-95 slide-in-from-top-5 duration-100"
                            style={{ transformOrigin: "top right" }}
                        >
                            {/* Desktop Dropdown */}
                            <div className="hidden md:flex flex-col gap-1">
                                {dropdownActionsDesktop.map((item, index) => (
                                    <Fragment
                                        key={`dropdown-desktop-${item.id}`}
                                    >
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setIsCardOpen(false)
                                                handleAIAction(item.action)
                                            }}
                                            className={cn(
                                                "flex items-center cursor-pointer justify-start w-full gap-2 h-8 px-2",
                                                "hover:bg-muted/80 focus:bg-muted/80 focus:ring-0 focus:ring-offset-0",
                                                "transition-colors duration-100"
                                            )}
                                        >
                                            {createElement(item.icon, {
                                                className: "h-4 w-4",
                                            })}
                                            <span className="text-sm">
                                                {item.tooltip}
                                            </span>
                                        </Button>
                                        {index <
                                            dropdownActionsDesktop.length -
                                                1 && (
                                            <Separator className="my-0.5 w-full" />
                                        )}
                                    </Fragment>
                                ))}
                            </div>
                            {/* Mobile Dropdown */}
                            <div className="flex md:hidden flex-col gap-1">
                                {dropdownActionsMobile.map((item, index) => (
                                    <Fragment
                                        key={`dropdown-mobile-${item.id}`}
                                    >
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setIsCardOpen(false)
                                                handleAIAction(item.action)
                                            }}
                                            className={cn(
                                                "flex items-center cursor-pointer justify-start w-full gap-2 h-8 px-2",
                                                "hover:bg-muted/80 focus:bg-muted/80 focus:ring-0 focus:ring-offset-0",
                                                "transition-colors duration-100"
                                            )}
                                        >
                                            {createElement(item.icon, {
                                                className: "h-4 w-4",
                                            })}
                                            <span className="text-sm">
                                                {item.tooltip}
                                            </span>
                                        </Button>
                                        {index <
                                            dropdownActionsMobile.length -
                                                1 && (
                                            <Separator className="my-0.5 w-full" />
                                        )}
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default GeneralPopover
