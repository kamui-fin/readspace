import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { extractDomain } from '@readspace/shared'
import type { PageMetadata, Priority, SaveOptions } from '@readspace/shared'
import { BookOpen, Pencil, Flag, StickyNote, Check } from 'lucide-react'
import { browser } from '@/lib/browser'
import { useExtensionStore } from '@/store'
import { ApiClient } from '@/lib/api-client'
import toast from 'react-hot-toast'

interface ArticlePreviewProps {
  metadata?: PageMetadata
  isMetadataLoading?: boolean
  onSave: (options?: Partial<SaveOptions>) => void
  readingTime?: number
  currentUrl?: string
}

// Skeleton loading component
function ArticlePreviewSkeleton() {
  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      {/* Header with logo */}
      <div className="bg-primary/5 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-primary">Current article</h2>
        </div>
      </div>

      <div className="p-4 space-y-4 animate-pulse">
        {/* Image placeholder */}
        <div className="relative overflow-hidden rounded-md bg-muted h-32 w-full" />

        {/* Article Info */}
        <div className="space-y-3">
          {/* Title */}
          <div className="space-y-2">
            <div className="h-6 bg-muted rounded w-full" />
            <div className="h-6 bg-muted rounded w-3/4" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-4">
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-3 bg-muted rounded w-20" />
            <div className="h-3 bg-muted rounded w-16" />
          </div>

          {/* Reading time */}
          <div className="h-3 bg-muted rounded w-28" />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <div className="h-9 bg-muted rounded flex-1" />
          <div className="h-9 bg-muted rounded w-24" />
        </div>
      </div>
    </div>
  )
}

export function ArticlePreview({
  metadata,
  isMetadataLoading = false,
  onSave,
  readingTime,
  currentUrl,
}: ArticlePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(true) // Default to expanded
  const [isInitialized, setIsInitialized] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [note, setNote] = useState('')
  const [priority, setPriority] = useState<Priority>('low')

  const checkArticleSaved = useExtensionStore((state) => state.checkArticleSaved)
  const isArticlePendingSave = useExtensionStore((state) => state.isArticlePendingSave)
  const unsaveArticle = useExtensionStore((state) => state.unsaveArticle)
  const cancelSave = useExtensionStore((state) => state.cancelSave)

  const [savedArticle, setSavedArticle] = useState<any | null>(null)
  const [optimisticallySaved, setOptimisticallySaved] = useState(false)
  const isSaved = !!savedArticle || optimisticallySaved
  const isPending = currentUrl ? isArticlePendingSave(currentUrl) : false
  const [isUnsaving, setIsUnsaving] = useState(false)

  // Track original saved values to detect changes
  const [originalNote, setOriginalNote] = useState('')
  const [originalPriority, setOriginalPriority] = useState<Priority>('low')

  // Check if user has made changes to note or priority
  const hasUnsavedChanges = savedArticle && (
    note !== originalNote ||
    priority !== originalPriority
  )

  // Check if article is already saved when URL changes
  useEffect(() => {
    const checkIfSaved = async () => {
      if (!currentUrl) {
        setSavedArticle(null)
        setOptimisticallySaved(false)
        return
      }

      try {
        const result = await checkArticleSaved(currentUrl)
        setSavedArticle(result)
        // Clear optimistic state if we have real data
        if (result) {
          setOptimisticallySaved(false)
        }

        // Prefill form fields if article is already saved
        if (result) {
          if (result.title && !customTitle) {
            setCustomTitle(result.title)
          }
          const savedNote = result.note || ''
          const savedPriority = (result.priority || 'low') as Priority

          setNote(savedNote)
          setPriority(savedPriority)

          // Store original values to track changes
          setOriginalNote(savedNote)
          setOriginalPriority(savedPriority)
        }
      } catch (error) {
        console.error('Failed to check if article is saved:', error)
      }
    }
    checkIfSaved()
  }, [currentUrl, checkArticleSaved])

  // Load expanded state from storage on mount
  useEffect(() => {
    const loadExpandedState = async () => {
      try {
        const result = await browser.storage.local.get('articlePreviewExpanded')
        if (typeof result.articlePreviewExpanded === 'boolean') {
          setIsExpanded(result.articlePreviewExpanded)
        }
        // Mark as initialized after loading state
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to load expanded state:', error)
        setIsInitialized(true)
      }
    }
    loadExpandedState()
  }, [])

  // Preload image in background if we know we'll be expanded
  // This happens AFTER initialization so we know the actual expanded state
  useEffect(() => {
    if (isInitialized && isExpanded && metadata?.image_url) {
      const img = new Image()
      img.src = metadata.image_url
    }
  }, [isInitialized, isExpanded, metadata?.image_url])

  // Show skeleton while loading metadata
  if (isMetadataLoading || !metadata) {
    return <ArticlePreviewSkeleton />
  }
  const domain = metadata.canonical_url
    ? extractDomain(metadata.canonical_url)
    : ''

  const handleSave = async () => {
    if (isSaved && currentUrl) {
      // Check if save is still pending
      if (isPending) {
        // Cancel the pending save
        cancelSave(currentUrl)
        setOptimisticallySaved(false)
        toast.success('Article removed')
        return
      }

      // If article is already saved, update it if there are changes
      if (savedArticle && hasUnsavedChanges) {
        try {
          await ApiClient.rss.updateArticle(
            savedArticle.id,
            {
              priority,
              note, // Send the note as-is (empty string or text)
            },
            'clipped'
          )
          toast.success('Article updated')
          // Refresh the saved article data and update original values
          const updated = await checkArticleSaved(currentUrl)
          setSavedArticle(updated)
          setOriginalNote(note)
          setOriginalPriority(priority)
        } catch (error) {
          console.error('Failed to update article:', error)
          toast.error(
            `Failed to update article: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
        return
      }

      // If saved but no changes, just show a message
      if (savedArticle && !hasUnsavedChanges) {
        toast('Article already saved', { icon: '✓' })
        return
      }

      // Unsave article (this case shouldn't happen now, but keep for safety)
      setIsUnsaving(true)
      try {
        await unsaveArticle(currentUrl)
        setSavedArticle(null) // Clear saved article state
        setOptimisticallySaved(false) // Clear optimistic state
        toast.success('Article removed')
      } catch (error) {
        console.error('Failed to unsave article:', error)
        toast.error(
          `Failed to remove article: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      } finally {
        setIsUnsaving(false)
      }
    } else {
      // Save article - set optimistic state immediately
      setOptimisticallySaved(true)
      const options: Partial<SaveOptions> = {
        title: customTitle || undefined,
        note: note || undefined,
        priority, // Always include priority (defaults to 'low')
      }
      onSave(options)
    }
  }

  const handleEditTitle = () => {
    // Preserve the current title (custom or metadata) when editing
    if (!customTitle) {
      setCustomTitle(metadata.title || '')
    }
    setIsEditingTitle(true)
  }

  // Show minimal card for read articles
  if (savedArticle?.is_read && savedArticle?.read_at) {
    const readDate = new Date(savedArticle.read_at)
    const formattedDate = readDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const formattedTime = readDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    return (
      <div className="bg-accent/50 dark:bg-accent border border-border rounded-lg p-4">
        <div className="flex items-center gap-3">
          {/* Icon with checkmark indicator */}
          <div className="bg-secondary/10 border border-secondary/30 rounded-full p-2 flex-shrink-0 relative">
            <BookOpen className="w-4 h-4 text-secondary" />
            <div className="absolute -top-0.5 -right-0.5 bg-secondary rounded-full p-0.5">
              <Check className="w-2 h-2 text-secondary-foreground" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="font-semibold text-sm text-secondary">
              Article read
            </h3>
            <p className="text-xs text-muted-foreground">
              {domain}
              {readingTime && ` • ${readingTime} min read`}
            </p>
            <p className="text-xs text-secondary/80 font-medium mt-0.5">
              Read on {formattedDate} at {formattedTime}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-accent/50 dark:bg-accent border border-border rounded-lg p-4">
      {/* Header - always visible */}
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="bg-primary rounded-full p-2 flex-shrink-0">
          <BookOpen className="w-4 h-4 text-primary-foreground" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h3 className="font-semibold text-sm">
            {isSaved ? 'Saved article' : 'Save article for later'}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {domain}
            {readingTime && ` • ${readingTime} min read`}
          </p>
        </div>

        {/* Actions - aligned to match FeedDiscoveryCard */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            onClick={handleSave}
            disabled={isUnsaving}
            size="sm"
            variant={isSaved && !hasUnsavedChanges ? 'outline' : 'default'}
            className={`flex-shrink-0 w-[100px] ${
              isSaved && !hasUnsavedChanges ? 'hover:bg-primary/10 dark:hover:bg-primary/20' : ''
            }`}
          >
            {isUnsaving ? (
              <div className="flex items-center justify-center">
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
                <span>Removing...</span>
              </div>
            ) : isSaved && !hasUnsavedChanges ? (
              <div className="flex items-center justify-center">
                <Check className="w-3 h-3 mr-1.5" />
                <span>Saved</span>
              </div>
            ) : isSaved && hasUnsavedChanges ? (
              'Update'
            ) : (
              'Save'
            )}
          </Button>
          {/* <button
            onClick={handleToggleExpanded}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded hover:bg-muted flex items-center justify-center"
            title={isExpanded ? "Hide options" : "Show options"}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button> */}
        </div>
      </div>

      {/* Expanded content - always shown */}
      <div
        className="overflow-hidden"
      >
        {/* Always render content */}
        {isInitialized && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
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

            {/* Title with edit functionality */}
            <div className="flex items-start gap-2">
              {isEditingTitle ? (
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={metadata.title || 'Enter custom title...'}
                  className="flex-1 px-2 py-1 text-sm bg-transparent border-b border-primary/30 focus:border-primary outline-none transition-colors"
                  autoFocus
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingTitle(false)
                    }
                  }}
                />
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm leading-tight">
                      {customTitle || metadata.title || 'Untitled Article'}
                    </h4>
                  </div>
                  <button
                    onClick={handleEditTitle}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted flex-shrink-0"
                    title="Edit title"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Priority Selector - Visual buttons */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Flag className="w-3 h-3" />
                Priority
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setPriority('low')}
                  className={`
                    px-2 py-1.5 rounded text-xs font-medium transition-all
                    ${priority === 'low'
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Flag className="w-3 h-3" />
                    Low
                  </div>
                </button>
                <button
                  onClick={() => setPriority('medium')}
                  className={`
                    px-2 py-1.5 rounded text-xs font-medium transition-all
                    ${priority === 'medium'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Flag className="w-3 h-3" />
                    Medium
                  </div>
                </button>
                <button
                  onClick={() => setPriority('high')}
                  className={`
                    px-2 py-1.5 rounded text-xs font-medium transition-all
                    ${priority === 'high'
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Flag className="w-3 h-3" />
                    High
                  </div>
                </button>
              </div>
            </div>

            {/* Note field - Enhanced design */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <StickyNote className="w-3 h-3" />
                Note {!note && <span className="text-muted-foreground/60">(optional)</span>}
              </label>
              {isEditingNote || note ? (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add your thoughts, why you're saving this, or what to remember..."
                  className="w-full px-2 py-1.5 text-xs bg-transparent border border-primary/20 focus:border-primary/50 rounded outline-none resize-none min-h-[60px] transition-colors"
                  autoFocus={isEditingNote && !note}
                  onBlur={() => {
                    if (!note) setIsEditingNote(false)
                  }}
                />
              ) : (
                <button
                  onClick={() => setIsEditingNote(true)}
                  className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded border border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 transition-all"
                >
                  Click to add a note...
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
