import { Button } from '@/components/ui/button'
import type { DiscoveredFeed } from '@readspace/shared'
import { areUrlsEqual } from '@readspace/shared'
import { Rss, Trash2 } from 'lucide-react'
import { useState, useMemo } from 'react'
import { FeedSubscriptionModal } from './FeedSubscriptionModal'
import { useExtensionStore } from '@/store'
import toast from 'react-hot-toast'

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
  // Initialize all hooks first (before any conditional returns)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUnfollowing, setIsUnfollowing] = useState(false)
  const userFeeds = useExtensionStore((state) => state.feeds)
  const { unsubscribeFromFeed } = useExtensionStore()
  const isFeedPendingFollow = useExtensionStore(
    (state) => state.isFeedPendingFollow
  )
  const cancelFollow = useExtensionStore((state) => state.cancelFollow)

  // Compute following state using useMemo for immediate, accurate state
  // Check ALL discovered feeds against user's subscriptions with normalized URL comparison
  const { isFollowing, followedFeedId, isPendingFollow } = useMemo(() => {
    // Default state when no feeds available
    if (!feeds || feeds.length === 0) {
      return {
        isFollowing: false,
        followedFeedId: null,
        isPendingFollow: false,
      }
    }

    // Check if any discovered feed is already in user's subscriptions
    // Use normalized URL comparison to catch variations (http/https, www, trailing slash, etc.)
    const followedFeed = userFeeds.find((userFeed) =>
      feeds.some((discoveredFeed) =>
        areUrlsEqual(userFeed.url, discoveredFeed.url)
      )
    )

    // Check if any discovered feed has a pending follow request
    const hasPendingFollow = feeds.some((feed) => isFeedPendingFollow(feed.url))

    return {
      isFollowing: !!followedFeed,
      followedFeedId: followedFeed?.id || null,
      isPendingFollow: hasPendingFollow,
    }
  }, [feeds, userFeeds, isFeedPendingFollow])

  // Show skeleton while loading (after all hooks are initialized)
  if (isLoading || !feeds || feeds.length === 0) {
    return <FeedDiscoveryCardSkeleton />
  }

  const primaryFeed = feeds[0]

  const handleFollowClick = async () => {
    if (isFollowing) {
      // Check if follow is still pending
      if (isPendingFollow && primaryFeed) {
        // Cancel the pending follow
        cancelFollow(primaryFeed.url)
        toast.success('Unfollowed')
        return
      }

      // Unfollow
      if (followedFeedId) {
        setIsUnfollowing(true)
        try {
          await unsubscribeFromFeed(followedFeedId)
          toast.success('Unfollowed')
          // State will update automatically via useMemo when userFeeds changes
        } catch (error) {
          console.error('Failed to unfollow:', error)
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          toast.error(`Failed to unfollow: ${errorMessage}`)
        } finally {
          setIsUnfollowing(false)
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

  const handleSuccess = () => {
    // No need to manually set isFollowing - it will be computed from userFeeds
    // which gets updated when loadUserData is called after subscription
  }

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
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="bg-orange-500 rounded-full p-2 flex-shrink-0">
            <Rss className="w-4 h-4 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="font-semibold text-sm">Follow this site</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {domain}
              {displayDescription && ` • ${displayDescription}`}
            </p>
          </div>

          {/* Action - with padding to align with ArticlePreview save button */}
          <div className="flex items-center flex-shrink-0">
            <Button
              onClick={handleFollowClick}
              disabled={isUnfollowing || isPendingFollow}
              size="sm"
              variant={
                isFollowing && !isUnfollowing && !isPendingFollow
                  ? 'outline'
                  : 'default'
              }
              className={`flex-shrink-0 min-w-[100px] ${
                isFollowing && !isUnfollowing && !isPendingFollow
                  ? 'border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground'
                  : !isFollowing && !isUnfollowing && !isPendingFollow
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : ''
              }`}
            >
              {isPendingFollow ? (
                <div className="flex items-center justify-center overflow-hidden">
                  <div className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5 flex-shrink-0" />
                  <span className="truncate">Following...</span>
                </div>
              ) : isUnfollowing ? (
                <div className="flex items-center justify-center overflow-hidden">
                  <div className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5 flex-shrink-0" />
                  <span className="truncate">Unfollowing...</span>
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
        onSuccess={handleSuccess}
      />
    </>
  )
}
