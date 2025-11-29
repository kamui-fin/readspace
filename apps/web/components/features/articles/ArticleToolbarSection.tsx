"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import { useArticleContext } from "./ArticleContext"
import { ArticleToolbar } from "./ArticleToolbar"

export function ArticleToolbarSection() {
    const isMobile = useIsMobile()
    const {
        article,
        contentSource,
        setContentSource,
        translatedContent,
        translatedLanguage,
        optimisticReadLater,
        handleToggleReadLater,
        handleMarkAsRead,
        handleExtractContent,
        handleSummarize,
        handleTranslate,
        extractFullText,
        summarizeArticle,
        isTranslating,
        onBack,
        isReadLaterMode,
    } = useArticleContext()

    if (!isMobile) return null

    return (
        <div className="md:hidden bg-background/95 backdrop-blur-sm border-b px-4 py-3 shrink-0">
            <ArticleToolbar
                article={article}
                isReadLater={optimisticReadLater}
                contentSource={contentSource}
                onContentSourceChange={setContentSource}
                hasTranslatedContent={!!translatedContent}
                translatedLanguage={translatedLanguage}
                onToggleReadLater={handleToggleReadLater}
                onMarkAsRead={handleMarkAsRead}
                onExtractFullText={handleExtractContent}
                onSummarize={handleSummarize}
                onTranslate={handleTranslate}
                isExtracting={extractFullText.isFetching}
                isSummarizing={summarizeArticle.isFetching}
                isTranslating={isTranslating}
                onBack={onBack}
                hideBackground={true}
                isReadLaterMode={isReadLaterMode}
            />
        </div>
    )
}
