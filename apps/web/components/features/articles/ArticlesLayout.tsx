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
}

export function ArticlesLayout({
    sidebar,
    detail,
    isMobile,
    showContent,
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
        <ResizablePanelGroup direction="horizontal">
            <ResizablePanel
                defaultSize={35}
                minSize={25}
                maxSize={50}
                className="flex flex-col h-full border-r"
            >
                {sidebar}
            </ResizablePanel>

            <ResizableHandle />

            <ResizablePanel defaultSize={65}>{detail}</ResizablePanel>
        </ResizablePanelGroup>
    )
}
