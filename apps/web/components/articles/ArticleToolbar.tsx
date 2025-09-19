"use client"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/useMobile"
import type { Article } from "@readspace/shared"
import {
    ArrowLeft,
    BookmarkIcon,
    Copy,
    ExternalLink,
    FileText,
    Languages,
    Loader2,
    Sparkles,
} from "lucide-react"
import { useState } from "react"
import { toast } from "react-hot-toast"
import { LanguageSelector } from "./LanguageSelector"

interface ArticleToolbarProps {
    article: Article
    isReadLater: boolean
    onToggleReadLater: () => void
    onExtractFullText: () => Promise<void>
    onSummarize: () => Promise<void>
    onTranslate: (language: string) => Promise<void>
    isExtracting?: boolean
    isSummarizing?: boolean
    isTranslating?: boolean
    onBack?: () => void
    hideBackground?: boolean
}

export function ArticleToolbar({
    article,
    isReadLater,
    onToggleReadLater,
    onExtractFullText,
    onSummarize,
    onTranslate,
    isExtracting = false,
    isSummarizing = false,
    isTranslating = false,
    onBack,
    hideBackground = false,
}: ArticleToolbarProps) {
    const [showLanguageSelector, setShowLanguageSelector] = useState(false)
    const isMobile = useIsMobile()

    const handleCopyUrl = async () => {
        if (!article.link) {
            toast.error("No URL available to copy")
            return
        }

        try {
            await navigator.clipboard.writeText(article.link)
            toast.success("URL copied to clipboard")
        } catch {
            toast.error("Failed to copy URL")
        }
    }

    const handleOpenOriginal = () => {
        if (article.link) {
            window.open(article.link, "_blank", "noopener,noreferrer")
        } else {
            toast.error("No original URL available")
        }
    }

    const handleTranslateClick = (language: string) => {
        setShowLanguageSelector(false)
        onTranslate(language)
    }

    return (
        <div
            className={`flex items-center ${isMobile && onBack ? "justify-between" : "justify-end"} ${hideBackground ? "gap-1" : "px-4 py-3 bg-background/95 backdrop-blur-sm border-b"}`}
        >
            {/* Mobile back button - shown when onBack is provided */}
            {isMobile && onBack && (
                <div className="flex items-center">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 p-0 transition-all duration-200 hover:scale-110 hover:bg-muted/60"
                                    onClick={onBack}
                                    title="Back to articles"
                                >
                                    <ArrowLeft className="h-4 w-4 transition-transform duration-200 hover:-translate-x-1" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                Back to articles
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}
            <div
                className={`flex items-center ${isMobile ? "gap-1" : "gap-1"}`}
            >
                <TooltipProvider>
                    {/* Bookmark/Save for Later */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`${isMobile ? "h-9 w-9" : "h-8 w-8"} p-0 transition-all duration-200 hover:scale-110 hover:bg-muted/60`}
                                onClick={onToggleReadLater}
                            >
                                <BookmarkIcon
                                    className={`h-4 w-4 transition-all duration-200 ${isReadLater
                                            ? "fill-primary text-primary scale-110"
                                            : "hover:scale-110"
                                        }`}
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {isReadLater
                                ? "Remove from Read Later"
                                : "Save for Later"}
                        </TooltipContent>
                    </Tooltip>

                    {/* Open Original */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`${isMobile ? "h-9 w-9" : "h-8 w-8"} p-0 transition-all duration-200 hover:scale-110 hover:bg-muted/60`}
                                onClick={handleOpenOriginal}
                                disabled={!article.link}
                            >
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {article.link
                                ? "Open Original Article"
                                : "No original URL available"}
                        </TooltipContent>
                    </Tooltip>

                    {/* Copy URL */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`${isMobile ? "h-9 w-9" : "h-8 w-8"} p-0 transition-all duration-200 hover:scale-110 hover:bg-muted/60`}
                                onClick={handleCopyUrl}
                                disabled={!article.link}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {article.link ? "Copy URL" : "No URL to copy"}
                        </TooltipContent>
                    </Tooltip>

                    {/* Extract Full Text */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`${isMobile ? "h-9 w-9" : "h-8 w-8"} p-0 transition-all duration-200 hover:scale-110 hover:bg-muted/60`}
                                onClick={onExtractFullText}
                                disabled={isExtracting || !article.link}
                            >
                                {isExtracting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <FileText className="h-4 w-4" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {isExtracting
                                ? "Extracting..."
                                : "Extract Full Text"}
                        </TooltipContent>
                    </Tooltip>

                    {/* AI Summary */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`${isMobile ? "h-9 w-9" : "h-8 w-8"} p-0 transition-all duration-200 hover:scale-110 hover:bg-muted/60`}
                                onClick={onSummarize}
                                disabled={isSummarizing}
                            >
                                {isSummarizing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Sparkles className="h-4 w-4" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {isSummarizing
                                ? "Generating Summary..."
                                : "AI Summary"}
                        </TooltipContent>
                    </Tooltip>

                    {/* AI Translation */}
                    <DropdownMenu
                        open={showLanguageSelector}
                        onOpenChange={setShowLanguageSelector}
                    >
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`${isMobile ? "h-9 w-9" : "h-8 w-8"} p-0 transition-all duration-200 hover:scale-110 hover:bg-muted/60`}
                                        disabled={isTranslating}
                                    >
                                        {isTranslating ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Languages className="h-4 w-4" />
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                                {isTranslating
                                    ? "Translating..."
                                    : "Translate Article"}
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="w-56">
                            <LanguageSelector onSelect={handleTranslateClick} />
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TooltipProvider>
            </div>
        </div>
    )
}
