import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ApiClient } from '@/lib/api-client'
import { useExtensionStore } from '@/store'
import { DiscoveredFeed, Folder } from '@readspace/shared'
import {
  BellPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Folder as FolderIcon,
  FolderPlus,
  Pencil,
  Rss,
  Trash2,
  X,
} from 'lucide-react'
import React, { useState } from 'react'
import toast from 'react-hot-toast'

interface FeedSubscriptionModalProps {
  feeds: DiscoveredFeed[]
  isOpen: boolean
  onClose: () => void
  onSubscribeStart?: () => void
  onSuccess?: () => void
  onError?: () => void
}

interface DeleteConfirmationDialogProps {
  folderName: string
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirmationDialog({
  folderName,
  onConfirm,
  onCancel,
}: DeleteConfirmationDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-sm w-full border border-border">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">
            Delete Folder
          </h3>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-foreground">
              "{folderName}"
            </span>
            ?
          </p>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive font-medium">
              ⚠️ This will permanently delete all feeds in this folder
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="flex-1">
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

export function FeedSubscriptionModal({
  feeds,
  isOpen,
  onClose,
  onSubscribeStart,
  onSuccess,
  onError,
}: FeedSubscriptionModalProps) {
  const {
    subscribeToFeed,
    folders: storeFolders,
    loadUserData,
  } = useExtensionStore()
  const [folders, setFolders] = useState<Folder[]>(storeFolders)
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    undefined
  )
  const [selectedFeedIndex, setSelectedFeedIndex] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null)

  // Update local folders when store folders change
  React.useEffect(() => {
    setFolders(storeFolders)
  }, [storeFolders])

  const selectedFeed = feeds[selectedFeedIndex] || feeds[0]

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Please enter a folder name')
      return
    }

    try {
      const newFolder = (await ApiClient.rss.createFolder({
        name: newFolderName.trim(),
      })) as Folder
      setFolders([...folders, newFolder])
      setNewFolderName('')
      setIsCreatingFolder(false)
      toast.success('Folder created successfully')
      // Reload user data to sync with store
      await loadUserData()
    } catch (error) {
      console.error('Failed to create folder:', error)
      toast.error('Failed to create folder')
    }
  }

  const handleRenameFolder = async (folderId: string) => {
    if (!editingFolderName.trim()) {
      toast.error('Please enter a folder name')
      return
    }

    try {
      const updatedFolder = (await ApiClient.rss.updateFolder(folderId, {
        name: editingFolderName.trim(),
      })) as Folder
      setFolders(folders.map((f) => (f.id === folderId ? updatedFolder : f)))
      setEditingFolderId(null)
      setEditingFolderName('')
      toast.success('Folder renamed successfully')
      // Reload user data to sync with store
      await loadUserData()
    } catch (error) {
      console.error('Failed to rename folder:', error)
      toast.error('Failed to rename folder')
    }
  }

  const startEditingFolder = (folder: Folder) => {
    setEditingFolderId(folder.id)
    setEditingFolderName(folder.name)
  }

  const cancelEditing = () => {
    setEditingFolderId(null)
    setEditingFolderName('')
  }

  const handleDeleteFolder = async (folder: Folder) => {
    setDeletingFolder(folder)
  }

  const confirmDeleteFolder = async () => {
    if (!deletingFolder) return

    try {
      await ApiClient.rss.deleteFolder(deletingFolder.id)
      setFolders(folders.filter((f) => f.id !== deletingFolder.id))

      // If we were editing or had this folder selected, clear that state
      if (selectedFolderId === deletingFolder.id) {
        setSelectedFolderId(undefined)
      }
      if (editingFolderId === deletingFolder.id) {
        setEditingFolderId(null)
        setEditingFolderName('')
      }

      setDeletingFolder(null)
      toast.success('Folder deleted successfully')

      // Reload user data to sync with store
      await loadUserData()
    } catch (error) {
      console.error('Failed to delete folder:', error)
      toast.error('Failed to delete folder')
    }
  }

  const cancelDeleteFolder = () => {
    setDeletingFolder(null)
  }

  // Generate a user-friendly feed name from the URL if no title is provided
  const getFeedDisplayName = (feed: DiscoveredFeed): string => {
    if (feed.title) return feed.title

    try {
      const url = new URL(feed.url)
      const path = url.pathname

      // Extract meaningful name from path
      // E.g., /rss → "RSS Feed", /blog/feed → "Blog Feed", /news/rss → "News Feed"
      const parts = path
        .split('/')
        .filter((p) => p && p !== 'feed' && p !== 'rss' && p !== 'atom')

      if (parts.length > 0) {
        // Capitalize first letter of each part
        const name = parts[parts.length - 1]
          .split(/[-_]/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        return `${name} Feed`
      }

      // Fallback to domain name
      const domain = url.hostname.replace('www.', '')
      return `${domain} Feed`
    } catch {
      return 'RSS Feed'
    }
  }

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

    // Start the API call synchronously (don't await) so AbortController is created immediately
    // This allows the follow to be cancelled if user clicks "Following" quickly
    // Use captured feed URL instead of selectedFeed.url
    subscribeToFeed(feedUrlToSubscribe, {
      folder_id: selectedFolderId,
    })
      .then(async () => {
        // Reload user data to get the feed ID
        await loadUserData()
        onSuccess?.()
      })
      .catch((error) => {
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

  if (!isOpen) return null

  return (
    <>
      {/* Delete Confirmation Dialog */}
      {deletingFolder && (
        <DeleteConfirmationDialog
          folderName={deletingFolder.name}
          onConfirm={confirmDeleteFolder}
          onCancel={cancelDeleteFolder}
        />
      )}

      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-background rounded-lg shadow-lg max-w-md w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
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
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* Feed Preview */}
            <div className="bg-accent/50 dark:bg-accent border border-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="bg-orange-500 rounded-full p-1.5 flex-shrink-0">
                  <Rss className="w-3 h-3 text-white" />
                </div>
                <h3 className="font-medium text-sm truncate flex-1">
                  {getFeedDisplayName(selectedFeed)}
                </h3>
                <Badge variant="outline" className="text-xs">
                  {selectedFeed?.type.toUpperCase()}
                </Badge>
              </div>
              {selectedFeed?.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
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
                                {getFeedDisplayName(feed)}
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
                            <p className="text-xs text-muted-foreground/70 line-clamp-1 mt-0.5 font-mono">
                              {feed.url}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Folder Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Folder <span className="text-red-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(true)}
                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    New Folder
                  </button>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className={`group flex items-center gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                        selectedFolderId === folder.id
                          ? 'bg-primary/10 border-primary/40 shadow-sm'
                          : 'hover:bg-accent/50 border-border hover:border-border/60'
                      }`}
                      onClick={() =>
                        !editingFolderId && setSelectedFolderId(folder.id)
                      }
                    >
                      {editingFolderId === folder.id ? (
                        <>
                          <div className="bg-muted rounded p-1 flex-shrink-0">
                            <FolderIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <input
                            type="text"
                            value={editingFolderName}
                            onChange={(e) =>
                              setEditingFolderName(e.target.value)
                            }
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter')
                                handleRenameFolder(folder.id)
                              if (e.key === 'Escape') cancelEditing()
                            }}
                            className="flex-1 px-2 py-1 text-sm bg-transparent border-b border-primary/30 focus:border-primary outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRenameFolder(folder.id)
                            }}
                            className="text-primary hover:text-primary/80 p-1 rounded hover:bg-primary/10 transition-colors flex-shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              cancelEditing()
                            }}
                            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <div
                            className={`rounded p-1 flex-shrink-0 transition-colors ${
                              selectedFolderId === folder.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            <FolderIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="flex-1 text-sm font-medium">
                            {folder.name}
                          </span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                startEditingFolder(folder)
                              }}
                              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
                              title="Rename folder"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteFolder(folder)
                              }}
                              className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors flex-shrink-0"
                              title="Delete folder"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Create New Folder Input */}
                  {isCreatingFolder && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-primary/40 bg-primary/10 shadow-sm">
                      <div className="bg-primary rounded p-1 flex-shrink-0">
                        <FolderIcon className="w-3.5 h-3.5 text-primary-foreground" />
                      </div>
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateFolder()
                          if (e.key === 'Escape') {
                            setIsCreatingFolder(false)
                            setNewFolderName('')
                          }
                        }}
                        placeholder="Enter folder name..."
                        className="flex-1 px-2 py-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateFolder}
                        className="text-primary hover:text-primary/80 p-1 rounded hover:bg-primary/10 transition-colors flex-shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingFolder(false)
                          setNewFolderName('')
                        }}
                        className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {folders.length === 0 && !isCreatingFolder && (
                    <p className="text-sm text-muted-foreground py-2 text-center">
                      No folders yet. Click "New Folder" to create one.
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
    </>
  )
}
