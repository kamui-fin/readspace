import { Button } from '@/components/ui/button'
import type { DiscoveredFeed } from '@readspace/shared'
import { Rss, Check } from 'lucide-react'
import { useState } from 'react'
import { FeedSubscriptionModal } from './FeedSubscriptionModal'

interface FeedDiscoveryCardProps {
  feeds: DiscoveredFeed[]
  websiteTitle?: string
}

export function FeedDiscoveryCard({
  feeds,
}: FeedDiscoveryCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)

  const primaryFeed = feeds[0]

  const handleFollowClick = () => {
    setIsModalOpen(true)
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
  const displayDescription = feeds.length > 1
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
            <h3 className="font-semibold text-sm mb-1">
              Follow this site
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {domain}
              {displayDescription && ` • ${displayDescription}`}
            </p>
          </div>

          {/* Action */}
          <Button
            onClick={handleFollowClick}
            disabled={isFollowing}
            size="sm"
            className="flex-shrink-0"
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
