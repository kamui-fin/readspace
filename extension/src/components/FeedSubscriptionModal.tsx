import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { DiscoveredFeed } from '@/types'
import { Rss, BellPlus, Loader2, X } from 'lucide-react'
import { useExtensionStore } from '@/store'

interface FeedSubscriptionModalProps {
  feed: DiscoveredFeed
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function FeedSubscriptionModal({ 
  feed, 
  isOpen, 
  onClose, 
  onSuccess 
}: FeedSubscriptionModalProps) {
  const { subscribeToFeed, folders, tags } = useExtensionStore()
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [isSubscribing, setIsSubscribing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedFolderId) {
      // TODO: Show error message that folder is required
      return
    }

    setIsSubscribing(true)
    try {
      await subscribeToFeed(feed.url, {
        folder_id: selectedFolderId,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      })
      console.log('Successfully subscribed to RSS feed:', feed.url)
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Failed to subscribe to RSS feed:', error)
      // TODO: Show error toast/notification to user
    } finally {
      setIsSubscribing(false)
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
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
          <div className="bg-gray-50 border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Rss className="w-4 h-4 text-orange-500" />
              <h3 className="font-medium text-sm truncate">
                {feed.title || 'RSS Feed'}
              </h3>
              <Badge variant="outline" className="text-xs">
                {feed.type.toUpperCase()}
              </Badge>
            </div>
            {feed.description && (
              <p className="text-xs text-gray-600 line-clamp-2">
                {feed.description}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Folder Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Folder <span className="text-red-500">*</span>
              </Label>
              <div className="space-y-1">
                {folders.map((folder) => (
                  <label
                    key={folder.id}
                    className="flex items-center gap-2 p-2 rounded border hover:bg-gray-50 cursor-pointer"
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
                  <p className="text-sm text-gray-500 py-2">
                    No folders available. Create a folder first.
                  </p>
                )}
              </div>
            </div>

            {/* Tags Selection */}
            {tags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tags (optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                        selectedTagIds.includes(tag.id)
                          ? 'bg-blue-100 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubscribing}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubscribing || !selectedFolderId}
                className="flex-1"
              >
                {isSubscribing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-2" />
                    Subscribing...
                  </>
                ) : (
                  <>
                    <BellPlus className="w-3 h-3 mr-2" />
                    Subscribe
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 