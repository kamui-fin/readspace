import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import type { ReactNode } from "react"

interface ArticlesLayoutProps {
    sidebar: ReactNode
    detail: ReactNode
    isMobile: boolean
    showContent: boolean
    defaultLayout: number[]
    onLayoutChange: (sizes: number[]) => void
}

export function ArticlesLayout({
    sidebar,
    detail,
    isMobile,
    showContent,
    defaultLayout,
    onLayoutChange,
}: ArticlesLayoutProps) {
    if (isMobile) {
        return (
            <div className="w-full h-full">
                {showContent ? (
                    <div className="flex h-full flex-col">{detail}</div>
                ) : (
                    sidebar
                )}
            </div>
        )
    }

    return (
        <ResizablePanelGroup id="articles-layout-group" direction="horizontal" onLayout={onLayoutChange}>
            <ResizablePanel
                id="articles-sidebar-panel"
                defaultSize={defaultLayout[0]}
                minSize={25}
                maxSize={50}
                className="flex flex-col h-full border-r"
            >
                {sidebar}
            </ResizablePanel>

            <ResizableHandle />

            <ResizablePanel id="articles-detail-panel" defaultSize={defaultLayout[1]}>
                {detail}
            </ResizablePanel>
        </ResizablePanelGroup>
    )
}
