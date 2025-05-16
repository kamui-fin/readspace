"use client"

import { useVirtualizer } from "@tanstack/react-virtual"
import * as React from "react"
import { useMemo } from "react"

import {
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarRight,
    SidebarRightMenuButton,
} from "@/components/ui/sidebar"
import { deserializeRange, scrollToRange } from "@/lib/reader/range-serialize"
import { cn } from "@/lib/utils"
import { useReaderStore } from "@/stores/reader"
import { EpubHighlight, Highlight, PdfHighlight } from "@/types/library"
import { NavItem } from "epubjs"
import { usePathname } from "next/navigation"
import { ScrollArea } from "../ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"

interface ReaderSidebarProps extends React.ComponentProps<typeof SidebarRight> {
    // Remove goToPage from props
}

// Flatten the TOC tree to make it easier to find next items
const flattenTocItems = (items: NavItem[]): NavItem[] => {
    return items.reduce((acc: NavItem[], item) => {
        acc.push(item)
        if (item.subitems && item.subitems.length > 0) {
            acc.push(...flattenTocItems(item.subitems))
        }
        return acc
    }, [])
}

// Find the most specific chapter that contains the current page
const findActiveChapterForPdf = (
    items: NavItem[],
    currentPage: number
): NavItem | null => {
    if (!items || items.length === 0) return null

    // Flatten and sort all items
    const flattenedItems = flattenTocItems(items)
    const sortedItems = [...flattenedItems].sort(
        (a, b) => Number.parseInt(a.href) - Number.parseInt(b.href)
    )

    // Find the furthest item that's before or at the current page
    const matchingItems = sortedItems.filter(
        (item) => Number.parseInt(item.href) <= currentPage
    )

    if (matchingItems.length === 0) return null

    // Get the last/furthest matching item in the TOC
    return matchingItems[matchingItems.length - 1]
}

// Separate TOC renderer component to optimize rendering
const TocTree = React.memo(function TocTree({
    items,
    currentLocation,
    currentPage,
    bookType,
    handleAction,
    topLevel = true,
    activeChapterId = null,
}: {
    items: NavItem[]
    currentLocation: string | undefined
    currentPage: number
    bookType: string | null
    handleAction: (href: string) => void
    topLevel?: boolean
    activeChapterId?: string | null
}) {
    // Only filter PDF items at the top level
    const filteredItems = useMemo(() => {
        if (topLevel && bookType === "pdf") {
            return items.filter((item) => Number.parseInt(item.href) >= 0)
        }
        return items
    }, [items, topLevel, bookType])

    // For large TOCs, use virtualization
    const parentRef = React.useRef<HTMLDivElement>(null)

    const virtualizer = useVirtualizer({
        count: filteredItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 32, // Estimate height of each item
        overscan: 10,
    })

    if (filteredItems.length === 0) return null

    // Use virtualization if there are many items
    if (filteredItems.length > 100 && topLevel) {
        return (
            <div
                ref={parentRef}
                className="max-h-[calc(100vh-200px)] overflow-auto"
            >
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                    }}
                >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const item = filteredItems[virtualRow.index]
                        // For EPUB: simple href matching
                        // For PDF: check if this exact item ID matches the active chapter ID
                        const isActive =
                            bookType === "epub" && currentLocation
                                ? currentLocation === item.href
                                : activeChapterId === item.id

                        return (
                            <div
                                key={item.id}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                <SidebarMenuItem>
                                    <SidebarRightMenuButton
                                        asChild
                                        isActive={isActive}
                                    >
                                        <a
                                            onClick={(e) => {
                                                e.preventDefault()
                                                handleAction(item.href)
                                            }}
                                            data-class={item.href}
                                            className="font-medium truncate w-[95%] cursor-pointer"
                                        >
                                            {item.label.trim()}
                                        </a>
                                    </SidebarRightMenuButton>
                                    {item.subitems?.length ? (
                                        <SidebarMenuSub>
                                            <TocTree
                                                items={item.subitems}
                                                currentLocation={
                                                    currentLocation
                                                }
                                                currentPage={currentPage}
                                                bookType={bookType}
                                                handleAction={handleAction}
                                                topLevel={false}
                                                activeChapterId={
                                                    activeChapterId
                                                }
                                            />
                                        </SidebarMenuSub>
                                    ) : null}
                                </SidebarMenuItem>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    // For smaller TOCs or subitems, render normally
    return (
        <>
            {filteredItems.map((item) => {
                // For EPUB: simple href matching
                // For PDF: check if this exact item ID matches the active chapter ID
                const isActive =
                    bookType === "epub" && currentLocation
                        ? currentLocation === item.href
                        : activeChapterId === item.id

                return (
                    <SidebarMenuItem key={item.id}>
                        <SidebarRightMenuButton asChild isActive={isActive}>
                            <a
                                onClick={(e) => {
                                    e.preventDefault()
                                    handleAction(item.href)
                                }}
                                data-class={item.href}
                                className="font-medium truncate w-[95%] cursor-pointer"
                            >
                                {item.label.trim()}
                            </a>
                        </SidebarRightMenuButton>
                        {item.subitems?.length ? (
                            <SidebarMenuSub>
                                <TocTree
                                    items={item.subitems}
                                    currentLocation={currentLocation}
                                    currentPage={currentPage}
                                    bookType={bookType}
                                    handleAction={handleAction}
                                    topLevel={false}
                                    activeChapterId={activeChapterId}
                                />
                            </SidebarMenuSub>
                        ) : null}
                    </SidebarMenuItem>
                )
            })}
        </>
    )
})

export function ReaderSidebar({ ...props }: ReaderSidebarProps) {
    const toc = useReaderStore((state) => state.toc)
    const activeTab = useReaderStore((state) => state.activeTab)
    const setActiveTab = useReaderStore((state) => state.setActiveTab)
    const setLocation = useReaderStore((state) => state.setLocation)
    const goToPage = useReaderStore((state) => state.goToPage)
    const currentLocation = useReaderStore((state) => state.currentLocation)
    const bookType = useReaderStore((state) => state.bookType)
    const currentPage = useReaderStore((state) => state.currentPage)

    // For PDFs, find the active chapter once at the top level
    const activeChapter = useMemo(() => {
        if (bookType === "pdf") {
            return findActiveChapterForPdf(toc, currentPage)
        }
        return null
    }, [bookType, toc, currentPage])

    const activeChapterId = activeChapter?.id || null

    const handleAction = (href: string) => {
        if (bookType === "epub") setLocation(href)
        else if (goToPage) {
            goToPage(Number.parseInt(href))
        }
    }

    const pathname = usePathname()
    if (!pathname.startsWith("/library/") || pathname === "/library") {
        return null
    }

    return (
        <SidebarRight
            side="right"
            collapsible="offcanvas"
            className="hidden lg:flex top-0 h-svh border-l"
            {...props}
        >
            <SidebarContent className="h-full">
                <SidebarGroup>
                    <Tabs
                        value={activeTab}
                        onValueChange={(value) =>
                            setActiveTab(value as "contents" | "highlights")
                        }
                        className="mt-4 w-full"
                    >
                        <TabsList className="grid w-full grid-cols-3 mb-2">
                            <TabsTrigger
                                value="contents"
                                className="text-[0.8rem]"
                            >
                                Contents
                            </TabsTrigger>
                            <TabsTrigger
                                value="highlights"
                                className="text-[0.8rem]"
                            >
                                Highlights
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="contents" className="m-0">
                            <SidebarGroup>
                                <SidebarGroupLabel>
                                    Table of Contents
                                </SidebarGroupLabel>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        <TocTree
                                            items={toc}
                                            currentLocation={currentLocation}
                                            currentPage={currentPage}
                                            bookType={bookType}
                                            handleAction={handleAction}
                                            activeChapterId={activeChapterId}
                                        />
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </SidebarGroup>
                        </TabsContent>
                        <TabsContent value="highlights" className="m-0">
                            <HighlightsTab />
                        </TabsContent>
                    </Tabs>
                </SidebarGroup>
            </SidebarContent>
        </SidebarRight>
    )
}

export function HighlightsTab() {
    const highlightsState = useReaderStore((state) => state.highlights)
    const highlights = highlightsState.map(({ highlight }) => highlight)
    if (!highlights.length) {
        return (
            <div className="flex flex-col items-left justify-center p-4 text-left">
                <p className="text-lg font-medium">No highlights yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                    Select text in your book to create highlights
                </p>
            </div>
        )
    }
    return (
        <ScrollArea className="h-[calc(100vh-2.5rem)]">
            <div className="space-y-4 p-4">
                {highlights.map((highlight, id) => (
                    <HighlightCard key={id} highlight={highlight} />
                ))}
            </div>
        </ScrollArea>
    )
}

interface HighlightProps {
    highlight: Highlight
}

export function HighlightCard({ highlight }: HighlightProps) {
    const colorMap = {
        green: "bg-emerald-500",
        blue: "bg-blue-500",
        yellow: "bg-amber-500",
    }
    const setLocation = useReaderStore((state) => state.setLocation)

    const bookMeta = useReaderStore((state) => state.bookMeta)
    const epubDocRef = useReaderStore((state) => state.epubDocRef)
    const pdfRef = useReaderStore((state) => state.pdfRef)

    const highlightType = bookMeta?.type

    const navigateHighlight = () => {
        if (!epubDocRef && !pdfRef) return
        // setLocation to chapter idx
        if (highlightType === "epub" && epubDocRef) {
            setLocation((highlight as EpubHighlight).chapter.href)
            // else document.querySelector()
            // deserialize range
            const range = deserializeRange(
                (highlight as EpubHighlight).range,
                epubDocRef
            )
            // scroll to element
            if (range) {
                scrollToRange(range)
            }
        } else if (highlightType === "pdf" && pdfRef) {
            pdfRef.current.currentPageNumber = (
                highlight as PdfHighlight
            ).position.boundingRect.pageNumber
        }
    }

    if (!highlight.color) return null

    return (
        <button
            className="group w-full text-left"
            onClick={() => navigateHighlight()}
        >
            <div className="relative overflow-hidden rounded-lg border bg-card p-4 shadow-xs transition-all duration-200 hover:shadow-md group-hover:bg-card/80">
                <div
                    className={cn(
                        "absolute left-0 top-0 h-1 w-full",
                        colorMap[highlight.color as keyof typeof colorMap]
                    )}
                />
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary">
                            {highlightType === "epub"
                                ? (highlight as EpubHighlight).chapter.title
                                : (highlight as PdfHighlight).note}
                        </span>
                    </div>
                    <p className="text-sm text-card-foreground">
                        {highlightType === "epub"
                            ? (highlight as EpubHighlight).text.slice(0, 150) +
                              "..."
                            : (highlight as PdfHighlight).content?.text?.slice(
                                  0,
                                  150
                              ) + "..."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Page{" "}
                        {highlightType === "epub"
                            ? (highlight as EpubHighlight).page
                            : (highlight as PdfHighlight).position.boundingRect
                                  ?.pageNumber}
                    </p>
                </div>
            </div>
        </button>
    )
}
