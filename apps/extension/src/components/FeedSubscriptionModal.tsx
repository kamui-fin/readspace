import { CopyUrlButton } from './CopyUrlButton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FolderList } from '@/components/subscription/FolderList'
import { DiscoveredFeed, Subscription } from '@readspace/shared'
import { useCreateFeed } from '@/hooks/use-feeds'
import { BellPlus, Rss } from 'lucide-react'
import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { getFeedDisplayName } from '@/lib/feed-utils'
import { FeedSelectionList } from './FeedSelectionList'

interface FeedSubscriptionModalProps {
  feeds: DiscoveredFeed[]
  isOpen: boolean
  onClose: () => void
  onSubscribeStart?: () => void
  onSuccess?: (subscription?: Subscription) => void
  onError?: () => void
}

export function FeedSubscriptionModal({
  feeds,
  isOpen,
  onClose,
  onSubscribeStart,
  onSuccess,
  onError,
}: FeedSubscriptionModalProps) {
  const createFeedMutation = useCreateFeed()

  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    undefined
  )
  const [selectedFeedIndex, setSelectedFeedIndex] = useState(0)

  const selectedFeed = feeds[selectedFeedIndex] || feeds[0]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedFolderId) {
      toast.error('Please select a folder to continue')
      return
    }

    if (!selectedFeed) {
      toast.error('No feed selected')
      return
    }

    // Capture the feed URL before closing modal to prevent stale closure
    const feedUrlToSubscribe = selectedFeed.url

    // Notify parent that subscription is starting
    onSubscribeStart?.()

    // Optimistic update - show success immediately and close modal
    toast.success('Successfully subscribed to RSS feed!')
    onClose()

    // Start the API call
    createFeedMutation
      .mutateAsync({
        url: feedUrlToSubscribe,
        folder_id: selectedFolderId,
      })
      .then((res) => {
        onSuccess?.(res)
      })
      .catch((error: Error) => {
        console.error('Failed to subscribe to RSS feed:', error)
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        // Show error toast, but modal is already closed
        toast.error(`Feed subscription failed: ${errorMessage}`, {
          duration: 5000, // Show longer since user might miss it
        })
        onError?.()
      })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Subscribe to Feed</DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 pb-6 space-y-4 overflow-y-auto flex-1">
          {/* Feed Preview */}
          <div className="bg-accent/50 dark:bg-accent border border-border rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="bg-orange-500 rounded-full p-1.5 flex-shrink-0">
                <Rss className="w-3 h-3 text-white" />
              </div>
              <h3 className="font-medium text-sm truncate flex-1">
                {getFeedDisplayName(selectedFeed)}
              </h3>
              <CopyUrlButton url={selectedFeed.url} />
            </div>
            {selectedFeed?.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                {selectedFeed.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground/70 line-clamp-1 mt-1 font-mono">
              {selectedFeed.url}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Advanced: Feed Selection (only show if multiple feeds) */}
            <FeedSelectionList
              feeds={feeds}
              selectedFeedIndex={selectedFeedIndex}
              onSelectFeed={setSelectedFeedIndex}
            />

            {/* Folder Selection */}
            <FolderList
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
            />

            {/* Actions */}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!selectedFolderId}>
                <BellPlus className="w-3 h-3 mr-2" />
                Subscribe
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
