import { Button } from '@/components/ui/button'
import {
  areUrlsEqual,
  DiscoveredFeed,
} from '@readspace/shared'
import { useCreateFeed, useDeleteFeed, useFeeds } from '@/hooks/use-feeds'
import { Rss, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { FeedSubscriptionModal } from './FeedSubscriptionModal'

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
  // Initialize hooks
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { data: feedsData } = useFeeds()
  const userFeeds = feedsData?.subscriptions || []

  const createFeedMutation = useCreateFeed()
  const deleteFeedMutation = useDeleteFeed()

  // Compute following state using useMemo for immediate, accurate state
  // Check ALL discovered feeds against user's subscriptions with normalized URL comparison
  const { isFollowing, followedFeedId } = useMemo(() => {
    // Default state when no feeds available
    if (!feeds || feeds.length === 0) {
      return {
        isFollowing: false,
        followedFeedId: null,
      }
    }

    // Check if any discovered feed is already in user's subscriptions
    // Use normalized URL comparison to catch variations (http/https, www, trailing slash, etc.)
    const followedFeed = userFeeds.find((userFeed) =>
      feeds.some((discoveredFeed) =>
        areUrlsEqual(userFeed.feed.url, discoveredFeed.url)
      )
    )

    return {
      isFollowing: !!followedFeed,
      followedFeedId: followedFeed?.id || null,
    }
  }, [feeds, userFeeds])

  // Show skeleton while loading (after all hooks are initialized)
  if (isLoading || !feeds || feeds.length === 0) {
    return <FeedDiscoveryCardSkeleton />
  }

  const handleFollowClick = async () => {
    if (isFollowing) {
      // Unfollow
      if (followedFeedId) {
        try {
          await deleteFeedMutation.mutateAsync({ feedId: followedFeedId })
          toast.success('Unfollowed')
        } catch (error) {
          console.error('Failed to unfollow:', error)
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          toast.error(`Failed to unfollow: ${errorMessage}`)
        }
      } else {
        console.error('Cannot unfollow: followedFeedId is null')
        toast.error('Unable to unfollow - feed ID not found')
      }
    } else {
      setIsModalOpen(true)
    }
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
  }

  const handleSubscribeStart = () => {
    // Called when user clicks Subscribe in modal
    // We can rely on mutation state, so maybe nothing needed here
  }

  const handleSuccess = () => {
    // No need to manually set isFollowing - it will be computed from userFeeds
  }

  const handleError = () => {
    // Error handling
  }

  const displayDescription =
    feeds.length > 1
      ? `${feeds.length} feeds available`
      : 'Add to your Readspace feed'

  const isPending =
    createFeedMutation.isPending || deleteFeedMutation.isPending

  return (
    <>
      <div className="bg-accent/50 dark:bg-accent border border-border rounded-lg p-4">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="bg-orange-500 rounded-full p-2 flex-shrink-0">
            <Rss className="w-4 h-4 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="font-semibold text-sm">Follow this site</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {displayDescription}
            </p>
          </div>

          {/* Action - with padding to align with ArticlePreview save button */}
          <div className="flex items-center flex-shrink-0">
            <Button
              onClick={handleFollowClick}
              disabled={isPending}
              size="sm"
              variant={
                isFollowing && !isPending
                  ? 'outline'
                  : isPending
                    ? 'ghost'
                    : 'default'
              }
              className={`flex-shrink-0 min-w-[100px] ${isFollowing && !isPending
                ? 'border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground'
                : isPending
                  ? 'bg-orange-500/90 text-white hover:bg-orange-500/90'
                  : !isFollowing
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : ''
                }`}
            >
              {isPending ? (
                <div className="flex items-center justify-center overflow-hidden">
                  <div className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5 flex-shrink-0" />
                  <span className="truncate">
                    {createFeedMutation.isPending
                      ? 'Following...'
                      : 'Unfollowing...'}
                  </span>
                </div>
              ) : isFollowing ? (
                <div className="flex items-center justify-center overflow-hidden">
                  <Trash2 className="w-3 h-3 mr-1.5 flex-shrink-0" />
                  <span className="truncate">Unfollow</span>
                </div>
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
        onSubscribeStart={handleSubscribeStart}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    </>
  )
}
