'use client'

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import type { Article, PaginatedResponse } from "@/lib/api/hooks/feeds"
import { useArticle, useArticles, useBulkUpdateArticles, useReadLaterArticles, useRecentlyReadArticles, useUpdateArticle } from "@/lib/api/hooks/feeds"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import { BookmarkIcon, CalendarIcon, CheckCircle2, Clock, Eye, EyeOff, RefreshCw } from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

export default function ArticlesPage({
    initialSidebarTitle,
    feedId,
    folderId,
    publishedSince,
    publishedUntil,
    mode = 'allArticles'
}: {
    initialSidebarTitle?: string;
    feedId?: string;
    folderId?: string;
    publishedSince?: string;
    publishedUntil?: string;
    mode?: 'allArticles' | 'recentlyRead' | 'readLater';
}) {
    const [page, setPage] = useState(1);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const router = useRouter();

    const isRecentlyReadMode = mode === 'recentlyRead';
    const isReadLaterMode = mode === 'readLater';
    const sidebarTitle =
        isRecentlyReadMode ? "Recently Read" :
            isReadLaterMode ? "Read Later" :
                (initialSidebarTitle || "All Articles");

    const allArticlesParams = {
        feedIds: feedId ? [feedId] : undefined,
        folderId: folderId,
        publishedSince,
        publishedUntil,
        page,
        size: 25,
        sortBy: "published_at",
        sortOrder: "desc",
        isRead: showUnreadOnly ? false : undefined
    };
    const recentlyReadParams = { page, size: 25 };
    const readLaterParams = { page, size: 25 };

    let queryKeyParams;
    let articlesHook;

    if (isRecentlyReadMode) {
        queryKeyParams = recentlyReadParams;
        articlesHook = useRecentlyReadArticles;
    } else if (isReadLaterMode) {
        queryKeyParams = readLaterParams;
        articlesHook = useReadLaterArticles;
    } else {
        queryKeyParams = allArticlesParams;
        articlesHook = useArticles;
    }

    const {
        data,
        isLoading: isArticlesLoading,
        isFetching,
        refetch: refetchArticles
    } = articlesHook(queryKeyParams, {
        keepPreviousData: true,
        refetchOnMount: false,
        refetchOnWindowFocus: false
    });

    const articlesData: PaginatedResponse<Article> = data || { items: [], total: 0, page: 1, pages: 1, size: 25 };
    const bulkUpdateArticles = useBulkUpdateArticles();

    const { data: selectedArticle, isLoading: isArticleLoading } = useArticle(selectedArticleId || "");
    const updateArticle = useUpdateArticle();

    useEffect(() => {
        if (articlesData.items.length > 0 && !selectedArticleId) {
            setSelectedArticleId(articlesData.items[0].id);
        }
    }, [articlesData, selectedArticleId]);

    useEffect(() => {
        if (!isRecentlyReadMode && !isReadLaterMode) {
            setPage(1);
            setSelectedArticleId(null);
        }
    }, [feedId, folderId, publishedSince, publishedUntil, isRecentlyReadMode, isReadLaterMode]);

    useEffect(() => {
        if (isRecentlyReadMode || isReadLaterMode) {
            setPage(1);
        }
    }, [isRecentlyReadMode, isReadLaterMode]);

    const groupedArticles = useMemo(() => {
        if (isRecentlyReadMode || articlesData.items.length === 0) {
            return {};
        }
        const groups: Record<string, { label: string, articles: Article[] }> = {};
        articlesData.items.forEach((article: Article) => {
            if (!article.published_at) return;
            const date = parseISO(article.published_at);
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);
            let dateGroup: string;
            let dateLabel: string;
            if (date.toDateString() === today.toDateString()) {
                dateGroup = "today";
                dateLabel = "Today";
            } else if (date.toDateString() === yesterday.toDateString()) {
                dateGroup = "yesterday";
                dateLabel = "Yesterday";
            } else {
                dateGroup = format(date, 'yyyy-MM-dd');
                dateLabel = format(date, 'EEEE, MMMM d');
            }
            if (!groups[dateGroup]) {
                groups[dateGroup] = {
                    label: dateLabel,
                    articles: []
                };
            }
            groups[dateGroup].articles.push(article);
        });
        return groups;
    }, [articlesData, isRecentlyReadMode]);

    const handleArticleClick = (articleId: string) => {
        setSelectedArticleId(articleId);
        const article = articlesData.items.find((a: Article) => a.id === articleId);
        if (!isRecentlyReadMode && article && !article.is_read) {
            // Update the article in the UI optimistically
            const updatedArticles = articlesData.items.map((item: Article) =>
                item.id === articleId ? { ...item, is_read: true } : item
            );

            // Here we would ideally update the query cache optimistically

            // Then perform the actual update
            updateArticle.mutate({
                articleId,
                data: { is_read: true }
            });
        }
    };

    const handleRefresh = () => {
        refetchArticles();
    };

    const handleMarkAllAsRead = () => {
        // Get all unread article IDs from the current view
        const unreadArticleIds = articlesData.items
            .filter(article => !article.is_read)
            .map(article => article.id);

        if (unreadArticleIds.length === 0) return;

        bulkUpdateArticles.mutate({
            articleIds: unreadArticleIds,
            action: "mark_as_read"
        }, {
            onSuccess: () => {
                refetchArticles();
            }
        });
    };

    const toggleShowUnreadOnly = () => {
        setShowUnreadOnly(prev => !prev);
    };

    // Calculate unread count for the badge
    const unreadCount = useMemo(() => {
        return articlesData.items.filter(article => !article.is_read).length;
    }, [articlesData.items]);

    if (isArticlesLoading) {
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl rounded-bl-none shadow-sm">
                <div className="w-full flex flex-col gap-4 p-8">
                    <ArticleItemSkeleton />
                    <ArticleItemSkeleton />
                    <ArticleItemSkeleton />
                </div>
            </div>
        );
    }

    if (!isArticlesLoading && articlesData.items.length === 0) {
        return (
            <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl rounded-bl-none shadow-sm">
                <div className="w-full flex flex-col items-center justify-center gap-4">
                    <p className="text-muted-foreground">
                        {isRecentlyReadMode ? "No recently read articles" :
                            isReadLaterMode ? "No articles in your Read Later list" :
                                "No articles found"}
                    </p>
                    {isRecentlyReadMode || isReadLaterMode ? (
                        <Button variant="outline" onClick={() => router.push('/articles')}>
                            Browse Articles
                        </Button>
                    ) : (
                        <Button variant="outline" onClick={handleRefresh}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl rounded-bl-none shadow-sm">
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
                    <div className="flex h-full flex-col border-r">
                        <div className="flex h-14 items-center justify-between border-b px-4">
                            <div className="flex items-center space-x-2">
                                <h2 className="font-semibold">{sidebarTitle}</h2>
                                {!isRecentlyReadMode && !isReadLaterMode && unreadCount > 0 && (
                                    <Badge variant="secondary" className="ml-2">{unreadCount}</Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {!isRecentlyReadMode && !isReadLaterMode && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={toggleShowUnreadOnly}
                                            title={showUnreadOnly ? "Show all articles" : "Show unread only"}
                                        >
                                            {showUnreadOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={handleMarkAllAsRead}
                                            title="Mark all as read"
                                            disabled={unreadCount === 0}
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={handleRefresh}
                                    title="Refresh"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <div className="flex flex-col">
                                {isRecentlyReadMode || isReadLaterMode ? (
                                    articlesData.items.map((article: Article, index: number) => (
                                        <ArticleItem
                                            key={article.id}
                                            article={article}
                                            isActive={article.id === selectedArticleId}
                                            isLastInGroup={index === articlesData.items.length - 1}
                                            onClick={() => handleArticleClick(article.id)}
                                            isRecentlyReadMode={isRecentlyReadMode}
                                            isReadLaterMode={isReadLaterMode}
                                        />
                                    ))
                                ) : (
                                    Object.entries(groupedArticles).map(([groupId, group]) => (
                                        <div key={groupId}>
                                            <div className="px-3 py-2.5 sticky top-0 bg-background/95 backdrop-blur-sm z-10 mt-3 first:mt-1.5">
                                                <div className="flex items-center gap-2">
                                                    {group.label === "Today" || group.label === "Yesterday" ? (
                                                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                    <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
                                                </div>
                                            </div>
                                            {group.articles.map((article: Article, index: number) => (
                                                <ArticleItem
                                                    key={article.id}
                                                    article={article}
                                                    isActive={article.id === selectedArticleId}
                                                    isLastInGroup={index === group.articles.length - 1}
                                                    onClick={() => handleArticleClick(article.id)}
                                                />
                                            ))}
                                        </div>
                                    ))
                                )}
                                {articlesData.page < articlesData.pages && (
                                    <div className="px-3 py-4 text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setPage(prevPage => prevPage + 1)}
                                            disabled={isFetching}
                                        >
                                            {isFetching ? "Loading..." : "Load More"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={75} className="overflow-hidden">
                    <div className="flex flex-col h-full">
                        {isArticleLoading && (
                            <div className="flex-1 p-8">
                                <ArticleContentSkeleton />
                            </div>
                        )}
                        {!isArticleLoading && selectedArticle && (
                            <div className="p-6 md:p-10 h-full overflow-y-auto">
                                <ArticleContentView article={selectedArticle} isRecentlyReadMode={isRecentlyReadMode} isReadLaterMode={isReadLaterMode} />
                            </div>
                        )}
                        {!isArticleLoading && !selectedArticle && (
                            <div className="flex flex-1 items-center justify-center">
                                <p className="text-muted-foreground">Select an article to read</p>
                            </div>
                        )}
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    )
}

function ArticleItemSkeleton() {
    return (
        <div className="flex gap-3 py-2.5 px-3 border-b animate-pulse">
            <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-20 bg-muted rounded" />
                    <div className="h-2 w-16 bg-muted rounded" />
                </div>
                <div className="h-4 w-5/6 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted/70 rounded" />
                <div className="h-3 w-full bg-muted/70 rounded" />
            </div>
            <div className="h-16 w-16 bg-muted/30 rounded-md" />
        </div>
    );
}

function ArticleContentSkeleton() {
    return (
        <div className="mx-auto max-w-3xl space-y-6 animate-pulse">
            <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
            <div className="flex items-center gap-2 mb-6">
                <div className="h-6 w-6 rounded-full bg-muted" />
                <div className="h-3 bg-muted rounded w-24" />
                <div className="h-3 bg-muted rounded w-16" />
                <div className="h-3 bg-muted rounded w-32" />
            </div>
            <div className="aspect-video w-full rounded-lg bg-muted/30 mb-6"></div>
            <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-5/6"></div>
            </div>
            <div className="space-y-3">
                <div className="h-4 bg-muted/70 rounded w-full"></div>
                <div className="h-4 bg-muted/70 rounded w-full"></div>
                <div className="h-4 bg-muted/70 rounded w-4/6"></div>
            </div>
        </div>
    );
}

function ArticleContentView({ article, isRecentlyReadMode, isReadLaterMode }: {
    article: Article,
    isRecentlyReadMode?: boolean,
    isReadLaterMode?: boolean
}) {
    const updateArticle = useUpdateArticle();
    const { resolvedTheme } = useTheme();
    const [optimisticReadLater, setOptimisticReadLater] = useState(article.is_read_later);
    const contentRef = useRef<HTMLDivElement>(null);
    const [hasMarkedRead, setHasMarkedRead] = useState(article.is_read);

    const handleToggleReadLater = () => {
        const newReadLaterState = !optimisticReadLater;
        setOptimisticReadLater(newReadLaterState);
        updateArticle.mutate({
            articleId: article.id,
            data: { is_read_later: newReadLaterState }
        });
    };

    useEffect(() => {
        // Update optimistic state when article changes
        setOptimisticReadLater(article.is_read_later);
    }, [article.is_read_later]);

    useEffect(() => {
        if ((isRecentlyReadMode || isReadLaterMode) || !contentRef.current || hasMarkedRead) return;
        const el = contentRef.current;
        const handleScroll = () => {
            if (el.scrollHeight - el.scrollTop - el.clientHeight <= 1) {
                if (!hasMarkedRead) {
                    // Set optimistic UI update first
                    setHasMarkedRead(true);

                    // Then perform the actual update
                    updateArticle.mutate({
                        articleId: article.id,
                        data: { is_read: true }
                    });
                }
            }
        };
        el.addEventListener('scroll', handleScroll);
        return () => el.removeEventListener('scroll', handleScroll);
    }, [article.id, hasMarkedRead, updateArticle, isRecentlyReadMode, isReadLaterMode]);

    const publishedAtString = article.published_at;
    const readAtString = article.read_at;

    const publishedAtDisplay = publishedAtString
        ? (isRecentlyReadMode && readAtString
            ? `Read ${formatDistanceToNow(parseISO(readAtString), { addSuffix: true })}`
            : formatDistanceToNow(parseISO(publishedAtString), { addSuffix: true }))
        : "Date unknown";

    return (
        <article className="mx-auto max-w-3xl">
            <div className="flex justify-between items-center mb-3">
                <h1 className="text-2xl font-semibold">{article.title}</h1>
                <div>
                    <Button
                        variant={optimisticReadLater ? "default" : "outline"}
                        size="icon"
                        onClick={handleToggleReadLater}
                    >
                        <BookmarkIcon className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="flex items-center gap-2 mb-6 text-[10px]">
                <Avatar className="h-6 w-6">
                    <AvatarImage src={article.feed?.image_url || article.image_url || "/placeholders/avatar.png"} />
                    <AvatarFallback>{article.feed?.title?.substring(0, 2) || "N/A"}</AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[200px]">
                    {article.author || article.feed?.title || "Unknown Source"}
                </span>
                <span className="text-muted-foreground before:content-['•'] before:ml-1 before:mr-2">
                    {publishedAtDisplay}
                </span>
                {article.estimated_read_time_minutes != null && (
                    <span className="text-muted-foreground before:content-['•'] before:ml-1 before:mr-2">
                        {article.estimated_read_time_minutes} min read
                    </span>
                )}
                {article.link && (
                    <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-primary hover:underline focus:underline cursor-pointer"
                        tabIndex={0}
                    >
                        Open original article
                    </a>
                )}
            </div>
            <div className="space-y-6">
                {article.image_url && (
                    <div className="aspect-video w-full overflow-hidden rounded-lg bg-primary/5 mb-6">
                        <img
                            src={article.image_url}
                            alt={article.title || "Article image"}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
                {article.description && (
                    <div
                        className="dark:prose-invert max-w-none prose-blockquote:border-l-4 prose-blockquote:border-primary/20 prose-blockquote:pl-4 prose-blockquote:py-1 prose-blockquote:my-2 prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-md"
                        dangerouslySetInnerHTML={{ __html: `<blockquote>${article.description}</blockquote>` }}
                        style={{
                            fontFamily: 'var(--font-garamond-serif)'
                        }}
                    />
                )}
                {article.content && (
                    <div
                        ref={contentRef}
                        className="article-content prose prose-lg dark:prose-invert max-w-none 
                          prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg
                          prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline prose-a:hover:underline
                          prose-img:rounded-md prose-img:mx-auto prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-md"
                        dangerouslySetInnerHTML={{ __html: article.content }}
                        style={{
                            fontFamily: 'var(--font-garamond-serif)',
                            overflowWrap: 'break-word',
                            wordWrap: 'break-word'
                        }}
                    />
                )}
            </div>
        </article>
    );
}

const stripHTML = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.body.textContent || '';
};

function ArticleItem({
    article,
    isActive = false,
    isLastInGroup = false,
    onClick,
    isRecentlyReadMode = false,
    isReadLaterMode = false
}: {
    article: Article;
    isActive?: boolean;
    isLastInGroup?: boolean;
    onClick: () => void;
    isRecentlyReadMode?: boolean;
    isReadLaterMode?: boolean;
}) {
    const publishedAtString = article.published_at;
    const readAtString = article.read_at;

    const timeDisplay = publishedAtString
        ? (isRecentlyReadMode && readAtString
            ? `Read ${formatDistanceToNow(parseISO(readAtString), { addSuffix: true })}`
            : formatDistanceToNow(parseISO(publishedAtString), { addSuffix: true }))
        : "Date unknown";

    return (
        <div
            className={`mx-0 py-2.5 px-3 ${!isLastInGroup ? 'border-b' : ''} 
            ${!isActive ? 'hover:bg-muted/80 hover:border-l-accent' : ''}
            active:bg-secondary/5
            transition-all duration-200 ease-out cursor-pointer 
            ${isActive ? "bg-secondary/5 border-l-2 border-l-secondary" : "border-l-2 border-l-transparent"}
            ${article.is_read ? "opacity-70" : ""}`}
            onClick={onClick}
        >
            <div className="flex gap-3">
                <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            {article.feed?.image_url && (
                                <img
                                    src={article.feed.image_url}
                                    alt=""
                                    className="h-3 w-3 shrink-0 rounded"
                                />
                            )}
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                {article.feed?.title || "Unknown Source"}
                            </span>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                            <Clock className="h-3 w-3" />
                            {timeDisplay}
                        </span>
                    </div>
                    <h3 className={`text-sm leading-tight ${article.is_read ? "font-normal" : "font-medium"}`}>{article.title}</h3>
                    {article.author && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{article.author}</div>
                    )}
                    {article.description && <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{stripHTML(article.description)}</p>}
                </div>
                {article.image_url && (
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-secondary/5 transition-colors">
                        <img src={article.image_url} alt={article.title || "Article image"} className="h-full w-full object-cover" />
                    </div>
                )}
            </div>
        </div>
    )
} 