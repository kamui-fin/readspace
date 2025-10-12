import { Button } from '@/components/ui/button'
import type { DiscoveredFeed } from '@readspace/shared'
import { Rss, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import { FeedSubscriptionModal } from './FeedSubscriptionModal'
import { useExtensionStore } from '@/store'

interface FeedDiscoveryCardProps {
  feeds?: DiscoveredFeed[]
  websiteTitle?: string
  isLoading?: boolean
}

// Skeleton loading component
function FeedDiscoveryCardSkeleton() {
  return (
    <div className="bg-accent/50 dark:bg-accent border border-border rounded-lg p-4 animate-pulse">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="bg-muted rounded-full p-2 flex-shrink-0">
          <div className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 bg-muted rounded w-28" />
          <div className="h-3 bg-muted rounded w-40" />
        </div>

        {/* Action */}
        <div className="h-8 w-16 bg-muted rounded flex-shrink-0" />
      </div>
    </div>
  )
}

export function FeedDiscoveryCard({
  feeds,
  isLoading = false,
}: FeedDiscoveryCardProps) {
  // Show skeleton while loading
  if (isLoading || !feeds) {
    return <FeedDiscoveryCardSkeleton />
  }
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const userFeeds = useExtensionStore((state) => state.feeds)

  const primaryFeed = feeds[0]

  // Check if user is already following any of the discovered feeds
  useEffect(() => {
    if (feeds && userFeeds.length > 0) {
      const isAlreadyFollowing = feeds.some((discoveredFeed) =>
        userFeeds.some((userFeed) => userFeed.url === discoveredFeed.url)
      )
      setIsFollowing(isAlreadyFollowing)
    }
  }, [feeds, userFeeds])

  const handleFollowClick = () => {
    if (!isFollowing) {
      setIsModalOpen(true)
    }
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
  }

  const handleSuccess = () => {
    setIsFollowing(true)
    console.log('Feed subscription successful!')
  }

  if (!primaryFeed) return null

  // Extract domain from feed URL
  const getDomain = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  const domain = getDomain(primaryFeed.url)
  const displayDescription =
    feeds.length > 1
      ? `${feeds.length} feeds available`
      : primaryFeed.description

  return (
    <>
      <div className="bg-accent/50 dark:bg-accent border border-border rounded-lg p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="bg-primary rounded-full p-2 flex-shrink-0">
            <Rss className="w-4 h-4 text-primary-foreground" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">Follow this site</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {domain}
              {displayDescription && ` • ${displayDescription}`}
            </p>
          </div>

          {/* Action - with padding to align with ArticlePreview save button */}
          <div className="flex items-center flex-shrink-0">
            <Button
              onClick={handleFollowClick}
              disabled={isFollowing}
              size="sm"
              variant={isFollowing ? "secondary" : "default"}
              className="flex-shrink-0 px-7 cursor-default"
            >
              {isFollowing ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Following
                </>
              ) : (
                'Follow'
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Feed Subscription Modal */}
      <FeedSubscriptionModal
        feeds={feeds}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />
    </>
  )
}
