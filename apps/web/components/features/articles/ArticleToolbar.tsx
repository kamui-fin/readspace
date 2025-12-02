"use client"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"
import { colorTokens } from "@readspace/design-tokens"
import {
    ArrowLeft,
    BookmarkIcon,
    Check,
    Copy,
    ExternalLink,
    FileText,
    Globe,
    Languages,
    Loader2,
    Sparkles,
} from "lucide-react"
import { useState } from "react"
import { toast } from "react-hot-toast"
import { LanguageSelector } from "./LanguageSelector"
import { ContentView, type Article } from "@readspace/shared"

interface ArticleToolbarProps {
    hideBackground?: boolean
    article: Article
    contentView: ContentView
    setContentView: (view: ContentView) => void
    handleMarkAsRead: () => void
    handleToggleReadLater: () => void
    handleExtractContent: () => void
    handleSummarize: () => void
    handleTranslate: (language: string) => void
    isExtracting: boolean
    isSummarizing: boolean
    isTranslating: boolean
    onBack?: () => void
    isReadLaterMode: boolean
    translatedContent: string | null
    translatedLanguage: string | null
    isSaved?: boolean
    isRead?: boolean
}

export function ArticleToolbar({
    hideBackground = false,
    article,
    contentView,
    setContentView,
    handleMarkAsRead,
    handleToggleReadLater,
    handleExtractContent,
    handleSummarize,
    handleTranslate,
    isExtracting,
    isSummarizing,
    isTranslating,
    onBack,
    isReadLaterMode,
    translatedContent,
    translatedLanguage,
    isSaved,
    isRead,
}: ArticleToolbarProps) {
    const [showLanguageSelector, setShowLanguageSelector] = useState(false)
    const isMobile = useIsMobile()

    const hasTranslatedContent = !!translatedContent
    const effectiveIsSaved = isSaved ?? article.is_saved
    const effectiveIsRead = isRead ?? article.is_read

    const handleCopyUrl = async () => {
        if (!article.link) {
            toast.error("No URL available to copy")
            return
        }

        try {
            await navigator.clipboard.writeText(article.link)
            toast.success("URL copied to clipboard")
        } catch {
            toast.error(
                "Failed to copy URL. HTTPS required for clipboard access"
            )
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
        handleTranslate(language)
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
                            <TooltipContent>Back to articles</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}
            <div
                className={`flex items-center ${isMobile ? "gap-1" : "gap-1"}`}
            >
                {/* Content Source Tabs - Show when link is available */}
                {article.link && setContentView && (
                    <div className="mr-2">
                        <Tabs
                            value={contentView}
                            onValueChange={(value) => {
                                const newView = value as ContentView
                                // Always update the content source state for immediate tab feedback
                                setContentView(newView)

                                // If switching to extracted and no content exists yet, trigger extraction
                                if (
                                    newView === ContentView.Extracted &&
                                    !article.extracted_content
                                ) {
                                    handleExtractContent()
                                }
                            }}
                            className="w-auto inline-block"
                        >
                            <TabsList className="h-8">
                                <TabsTrigger
                                    value={ContentView.Original}
                                    title="Original RSS content"
                                    className="h-7 px-2"
                                >
                                    <FileText className="h-4 w-4" />
                                </TabsTrigger>
                                <TabsTrigger
                                    value={ContentView.Extracted}
                                    title="Full article content"
                                    className="h-7 px-2"
                                    disabled={isExtracting}
                                >
                                    {isExtracting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Globe className="h-4 w-4" />
                                    )}
                                </TabsTrigger>
                                {hasTranslatedContent && (
                                    <TabsTrigger
                                        value={ContentView.Translated}
                                        title={`Translated content${translatedLanguage ? ` (${translatedLanguage})` : ""}`}
                                        className="h-7 px-2"
                                    >
                                        <Languages className="h-4 w-4" />
                                    </TabsTrigger>
                                )}
                            </TabsList>
                        </Tabs>
                    </div>
                )}
                <TooltipProvider>
                    {/* Bookmark/Save for Later or Mark as Read */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className={`${isMobile ? "h-9 w-9" : "h-8 w-8"} flex items-center justify-center p-0 transition-transform duration-200 hover:scale-110 focus:outline-none`}
                                onClick={
                                    isReadLaterMode
                                        ? handleMarkAsRead
                                        : handleToggleReadLater
                                }
                            >
                                {isReadLaterMode ? (
                                    <Check
                                        className="h-4 w-4"
                                        style={{
                                            color: effectiveIsSaved
                                                ? colorTokens.primary.DEFAULT
                                                : colorTokens.muted.foreground,
                                        }}
                                    />
                                ) : (
                                    <BookmarkIcon
                                        className={`h-4 w-4 ${effectiveIsSaved ? "scale-110" : ""}`}
                                        style={{
                                            fill: effectiveIsSaved
                                                ? "#eab308"
                                                : "transparent",
                                            color: effectiveIsSaved
                                                ? "#eab308"
                                                : colorTokens.foreground,
                                        }}
                                    />
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {isReadLaterMode
                                ? "Mark as Read & Remove"
                                : effectiveIsSaved
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

                    {/* AI Summary */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`${isMobile ? "h-9 w-9" : "h-8 w-8"} p-0 transition-all duration-200 hover:scale-110 hover:bg-muted/60`}
                                onClick={handleSummarize}
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
