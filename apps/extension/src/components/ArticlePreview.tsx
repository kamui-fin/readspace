import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatRelativeDate, extractDomain } from '@readspace/shared'
import type { PageMetadata, DiscoveredFeed } from '@readspace/shared'
import {
  BookOpen,
  Clock,
  Calendar,
  Globe,
  Rss,
  Settings,
  BellPlus,
  Copy,
} from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { FeedSubscriptionModal } from './FeedSubscriptionModal'

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
  const [selectedFeed, setSelectedFeed] = useState<DiscoveredFeed | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const domain = metadata.canonical_url
    ? extractDomain(metadata.canonical_url)
    : ''
  const publishedDate = metadata.published_at
    ? new Date(metadata.published_at)
    : null

  const handleSubscribeClick = (feed: DiscoveredFeed) => {
    setSelectedFeed(feed)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedFeed(null)
  }

  const copyFeedUrl = async (feedUrl: string) => {
    try {
      await navigator.clipboard.writeText(feedUrl)
      toast.success('Feed URL copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy feed URL:', error)
      toast.error('Failed to copy feed URL to clipboard')
    }
  }

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

        {/* RSS Feeds Section */}
        {metadata.feeds && metadata.feeds.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              RSS FEEDS DISCOVERED ({metadata.feeds.length})
            </h4>

            <div className="space-y-2">
              {metadata.feeds.map((feed, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Rss className="w-3 h-3 text-orange-500 flex-shrink-0" />
                        <h5 className="text-sm font-medium truncate">
                          {feed.title || 'RSS Feed'}
                        </h5>
                      </div>

                      {feed.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {feed.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-xs px-1.5 py-0.5 h-auto"
                        >
                          {feed.type.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        onClick={() => copyFeedUrl(feed.url)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Copy feed URL"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>

                      <Button
                        onClick={() => handleSubscribeClick(feed)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Subscribe to feed"
                      >
                        <BellPlus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feed Subscription Modal */}
        {selectedFeed && (
          <FeedSubscriptionModal
            feed={selectedFeed}
            isOpen={isModalOpen}
            onClose={handleModalClose}
            onSuccess={() => {
              console.log('Feed subscription successful!')
              // Toast is already shown in FeedSubscriptionModal
            }}
          />
        )}
      </div>
    </div>
  )
}
