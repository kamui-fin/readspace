import { Button } from '@/components/ui/button'
import { areUrlsEqual, DiscoveredFeed, Subscription } from '@readspace/shared'
import { useCreateFeed, useDeleteFeed } from '@/hooks/use-feeds'
import { Rss, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
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

import browser from 'webextension-polyfill'
import { sendMessage } from '@/shared/messaging'
import { ExtensionMessage } from '@/shared/types'

// ... imports

export function FeedDiscoveryCard({
  feeds,
  isLoading = false,
}: FeedDiscoveryCardProps) {
  // Initialize hooks
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [optimisticFollow, setOptimisticFollow] = useState<boolean | null>(null)
  const [optimisticFeedId, setOptimisticFeedId] = useState<string | null>(null)
  const [optimisticFeedUrl, setOptimisticFeedUrl] = useState<string | null>(
    null
  )

  const createFeedMutation = useCreateFeed()
  const deleteFeedMutation = useDeleteFeed()

  // Check initial status from cache
  useEffect(() => {
    if (!feeds || feeds.length === 0) return

    let mounted = true

    const checkStatus = async () => {
      for (const feed of feeds) {
        try {
          const status = await sendMessage({
            type: 'checkFeedFollowed',
            payload: { url: feed.url },
          })
          if (!mounted) return

          if (status.followed) {
            setOptimisticFollow(true)
            if (status.followId) {
              setOptimisticFeedId(status.followId)
            }
            setOptimisticFeedUrl(feed.url)
            return // Found one, stop checking
          }
        } catch (error) {
          console.error('Error checking feed status:', error)
        }
      }
    }

    checkStatus()

    return () => {
      mounted = false
    }
  }, [feeds])

  // Listener for optimistic updates
  useEffect(() => {
    const listener = (msg: unknown) => {
      const message = msg as ExtensionMessage
      if (message.type === 'follow-changed') {
        // Check if any feed matches
        const match = feeds?.some((f) => areUrlsEqual(f.url, message.payload.url))
        if (match) {
          setOptimisticFollow(message.payload.followed)
          if (message.payload.id) {
            setOptimisticFeedId(message.payload.id)
          }
        }
      }
    }
    browser.runtime.onMessage.addListener(listener)
    return () => browser.runtime.onMessage.removeListener(listener)
  }, [feeds])

  const isFollowing = optimisticFollow !== null ? optimisticFollow : false

  // Show skeleton while loading (after all hooks are initialized)
  if (isLoading || !feeds || feeds.length === 0) {
    return <FeedDiscoveryCardSkeleton />
  }

  const handleFollowClick = async () => {
    if (isFollowing) {
      // Unfollow
      const idToDelete = optimisticFeedId
      const urlToDelete = optimisticFeedUrl || feeds[0].url

      if (idToDelete) {
        try {
          // Pass URL for optimistic update in background
          // We use followedFeedUrl or the first feed url if we matched?
          // If we are following, followedFeedUrl should be set.
          // If optimisticFollow is true but we don't have ID yet, we can't delete by ID.
          // We need to handle that case.
          await deleteFeedMutation.mutateAsync({
            feedId: idToDelete,
            url: urlToDelete,
          })
          toast.success('Unfollowed')
          setOptimisticFollow(false)
          setOptimisticFeedId(null)
          setOptimisticFeedUrl(null)
        } catch (error) {
          console.error('Failed to unfollow:', error)
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          toast.error(`Failed to unfollow: ${errorMessage}`)
        }
      } else {
        // If we are optimistically following but don't have ID yet
        if (optimisticFollow) {
          toast.error('Please wait for subscription to complete...')
          return
        }
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
    setOptimisticFollow(true)
  }

  const handleSuccess = (subscription?: Subscription) => {
    // No need to manually set isFollowing - it will be computed from userFeeds
    // But we capture the ID for immediate unfollow capability
    if (subscription) {
      setOptimisticFeedId(subscription.feed.id)
      setOptimisticFeedUrl(subscription.feed.url)
    }
  }

  const handleError = () => {
    // Error handling - revert optimistic state
    setOptimisticFollow(false)
  }

  const displayDescription =
    feeds.length > 1
      ? `${feeds.length} feeds available`
      : 'Add to your Readspace feed'

  const isPending = createFeedMutation.isPending || deleteFeedMutation.isPending

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
