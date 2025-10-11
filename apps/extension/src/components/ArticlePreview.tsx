import { Button } from '@/components/ui/button'
import { formatRelativeDate, extractDomain } from '@readspace/shared'
import type { PageMetadata } from '@readspace/shared'
import {
  BookOpen,
  Clock,
  Calendar,
  Globe,
  Settings,
} from 'lucide-react'

interface ArticlePreviewProps {
  metadata: PageMetadata
  isLoading?: boolean
  onSave: () => void
  onAdvancedSave: () => void
  readingTime?: number
}

export function ArticlePreview({
  metadata,
  isLoading = false,
  onSave,
  onAdvancedSave,
  readingTime,
}: ArticlePreviewProps) {
  const domain = metadata.canonical_url
    ? extractDomain(metadata.canonical_url)
    : ''
  const publishedDate = metadata.published_at
    ? new Date(metadata.published_at)
    : null

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      {/* Header with logo */}
      <div className="bg-primary/5 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-primary">Current article</h2>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Article Image */}
        {metadata.image_url && (
          <div className="relative overflow-hidden rounded-md">
            <img
              src={metadata.image_url}
              alt={metadata.title || 'Article image'}
              className="w-full h-32 object-cover"
            />
          </div>
        )}

        {/* Article Info */}
        <div className="space-y-3">
          {/* Title */}
          <h3 className="font-semibold text-lg leading-tight line-clamp-2">
            {metadata.title || 'Untitled Article'}
          </h3>

          {/* Description */}
          {metadata.description && (
            <p className="text-muted-foreground text-sm line-clamp-3">
              {metadata.description}
            </p>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {domain && (
              <div className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>{domain}</span>
              </div>
            )}

            {metadata.author && (
              <div className="flex items-center gap-1">
                <span>by {metadata.author}</span>
              </div>
            )}

            {publishedDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatRelativeDate(publishedDate)}</span>
              </div>
            )}
          </div>

          {/* Reading time */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>
              {readingTime
                ? `${readingTime} min read`
                : 'Calculating reading time...'}
            </span>
          </div>
        </div>

        {/* Article Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onSave}
            disabled={isLoading}
            className="flex-1"
            size="sm"
          >
            {isLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4 mr-2" />
                Save Article
              </>
            )}
          </Button>

          <Button
            onClick={onAdvancedSave}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <Settings className="w-4 h-4 mr-1" />
            Options
          </Button>
        </div>
      </div>
    </div>
  )
}
