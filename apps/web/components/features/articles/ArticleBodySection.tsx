"use client"

import { useArticleContext } from "./ArticleContext"
import { ScrollableArticle } from "./ScrollableArticle"
import { ArticleProseContent } from "./ArticleProseContent"

export function ArticleBodySection() {
    const {
        article,
        displayContent,
        contentKey,
        handleScrollMarkAsRead,
        handleContentClickMarkAsRead,
    } = useArticleContext()

    return (
        <ScrollableArticle
            onScroll={handleScrollMarkAsRead}
            onClick={handleContentClickMarkAsRead}
        >
            <ArticleProseContent
                content={displayContent}
                contentKey={contentKey}
                description={article.description}
                userNote={article.user_note}
            />
        </ScrollableArticle>
    )
}
