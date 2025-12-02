import type { PageMetadata } from '@readspace/shared'
import { ArticleForm } from './article/ArticleForm'
import { ArticleHeader } from './article/ArticleHeader'
import { ReadArticleCard } from './article/ReadArticleCard'
import { useArticleActions } from '@/hooks/use-article-actions'

interface ArticlePreviewProps {
  metadata?: PageMetadata
  isMetadataLoading?: boolean
  readingTime?: number
  currentUrl?: string
}

// Skeleton loading component
function ArticlePreviewSkeleton() {
  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      {/* Header with logo */}
      <div className="bg-primary/5 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-primary">Current article</h2>
        </div>
      </div>

      <div className="p-4 space-y-4 animate-pulse">
        {/* Image placeholder */}
        <div className="relative overflow-hidden rounded-md bg-muted h-32 w-full" />

        {/* Article Info */}
        <div className="space-y-3">
          {/* Title */}
          <div className="space-y-2">
            <div className="h-6 bg-muted rounded w-full" />
            <div className="h-6 bg-muted rounded w-3/4" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-4">
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-3 bg-muted rounded w-20" />
            <div className="h-3 bg-muted rounded w-16" />
          </div>

          {/* Reading time */}
          <div className="h-3 bg-muted rounded w-28" />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <div className="h-9 bg-muted rounded flex-1" />
          <div className="h-9 bg-muted rounded w-24" />
        </div>
      </div>
    </div>
  )
}

export function ArticlePreview({
  metadata,
  isMetadataLoading = false,
  readingTime,
  currentUrl,
}: ArticlePreviewProps) {
  const {
    savedArticle,
    formState,
    status,
    actions,
  } = useArticleActions({ currentUrl, metadata })

  // Show skeleton while loading metadata
  if (isMetadataLoading || !metadata) {
    return <ArticlePreviewSkeleton />
  }

  // Show minimal card for read articles
  if (savedArticle?.is_saved && savedArticle.is_read && savedArticle.read_at) {
    return <ReadArticleCard readAt={savedArticle.read_at} />
  }

  return (
    <div className="bg-accent/50 dark:bg-accent border border-border rounded-lg p-4">
      <ArticleHeader
        isSaved={status.isSaved}
        hasUnsavedChanges={status.hasUnsavedChanges}
        readingTime={readingTime}
        onSave={actions.handleSave}
        isPending={status.isPending}
        isUnsavePending={status.isUnsavePending}
        isUpdatePending={status.isUpdatePending}
        isSavePending={status.isSavePending}
        isPreparingToSave={status.isPreparingToSave}
      />

      {/* Expanded content - always shown */}
      <div className="overflow-hidden">
        <ArticleForm
          customTitle={formState.customTitle}
          setCustomTitle={formState.setCustomTitle}
          note={formState.note}
          setNote={formState.setNote}
          priority={formState.priority}
          setPriority={formState.setPriority}
          metadata={metadata}
        />
      </div>
    </div>
  )
}
