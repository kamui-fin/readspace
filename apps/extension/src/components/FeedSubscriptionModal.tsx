import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useExtensionStore } from '@/store'
import { DiscoveredFeed } from '@readspace/shared'
import { BellPlus, ChevronDown, ChevronUp, Rss, X } from 'lucide-react'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

interface FeedSubscriptionModalProps {
  feeds: DiscoveredFeed[]
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function FeedSubscriptionModal({
  feeds,
  isOpen,
  onClose,
  onSuccess,
}: FeedSubscriptionModalProps) {
  const { subscribeToFeed, folders } = useExtensionStore()
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    undefined
  )
  const [selectedFeedIndex, setSelectedFeedIndex] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const selectedFeed = feeds[selectedFeedIndex] || feeds[0]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedFolderId) {
      toast.error('Please select a folder to continue')
      return
    }

    if (!selectedFeed) {
      toast.error('No feed selected')
      return
    }

    // Optimistic update - show success immediately and close modal
    toast.success('Successfully subscribed to RSS feed!')
    onSuccess?.()
    onClose()

    // Make the actual API call in the background
    try {
      await subscribeToFeed(selectedFeed.url, {
        folder_id: selectedFolderId,
      })
    } catch (error) {
      console.error('Failed to subscribe to RSS feed:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      // Show error toast, but modal is already closed
      toast.error(`Feed subscription failed: ${errorMessage}`, {
        duration: 5000, // Show longer since user might miss it
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Subscribe to Feed</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Feed Preview */}
          <div className="bg-gray-50 dark:bg-gray-800 border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Rss className="w-4 h-4 text-orange-500" />
              <h3 className="font-medium text-sm truncate">
                {selectedFeed?.title || 'RSS Feed'}
              </h3>
              <Badge variant="outline" className="text-xs">
                {selectedFeed?.type.toUpperCase()}
              </Badge>
            </div>
            {selectedFeed?.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {selectedFeed.description}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Advanced: Feed Selection (only show if multiple feeds) */}
            {feeds.length > 1 && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full"
                >
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <span>
                    Advanced: Choose specific feed ({feeds.length} available)
                  </span>
                </button>

                {showAdvanced && (
                  <div className="space-y-1 pl-6">
                    {feeds.map((feed, index) => (
                      <label
                        key={index}
                        className="flex items-start gap-2 p-2 rounded border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="feed"
                          value={index}
                          checked={selectedFeedIndex === index}
                          onChange={() => setSelectedFeedIndex(index)}
                          className="w-4 h-4 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {feed.title || 'Untitled Feed'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {feed.type}
                            </Badge>
                          </div>
                          {feed.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {feed.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Folder Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Folder <span className="text-red-500">*</span>
              </Label>
              <div className="space-y-1">
                {folders.map((folder) => (
                  <label
                    key={folder.id}
                    className="flex items-center gap-2 p-2 rounded border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="folder"
                      value={folder.id}
                      checked={selectedFolderId === folder.id}
                      onChange={(e) => setSelectedFolderId(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{folder.name}</span>
                  </label>
                ))}
                {folders.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">
                    No folders available. Create a folder first.
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!selectedFolderId}
                className="flex-1"
              >
                <BellPlus className="w-3 h-3 mr-2" />
                Subscribe
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
