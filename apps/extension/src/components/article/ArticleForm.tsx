import { Flag, Pencil, StickyNote } from 'lucide-react'
import { useState } from 'react'
import { PageMetadata, Priority, ArticlePriority } from '@readspace/shared'

interface ArticleFormProps {
  customTitle: string
  setCustomTitle: (title: string) => void
  note: string
  setNote: (note: string) => void
  priority: Priority
  setPriority: (priority: Priority) => void
  metadata?: PageMetadata
}

export function ArticleForm({
  customTitle,
  setCustomTitle,
  note,
  setNote,
  priority,
  setPriority,
  metadata,
}: ArticleFormProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingNote, setIsEditingNote] = useState(false)

  const handleEditTitle = () => {
    // Preserve the current title (custom or metadata) when editing
    if (!customTitle && metadata?.title) {
      setCustomTitle(metadata.title)
    }
    setIsEditingTitle(true)
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      {/* Article Image */}
      {metadata?.image_url && (
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
            placeholder={metadata?.title || 'Enter custom title...'}
            className="flex-1 px-2 py-1 text-sm bg-transparent border-b border-primary/30 focus:border-primary outline-none transition-colors placeholder:text-muted-foreground"
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
                {customTitle || metadata?.title || 'Untitled Article'}
              </h4>
            </div>
            <button
              onClick={handleEditTitle}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted flex-shrink-0 cursor-pointer"
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
            onClick={() => setPriority(ArticlePriority.LOW)}
            className={`
              px-2 py-1.5 rounded text-xs font-medium transition-all cursor-pointer
              ${priority === ArticlePriority.LOW
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
            onClick={() => setPriority(ArticlePriority.MEDIUM)}
            className={`
              px-2 py-1.5 rounded text-xs font-medium transition-all cursor-pointer
              ${priority === ArticlePriority.MEDIUM
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
            onClick={() => setPriority(ArticlePriority.HIGH)}
            className={`
              px-2 py-1.5 rounded text-xs font-medium transition-all cursor-pointer
              ${priority === ArticlePriority.HIGH
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
          Note{' '}
          {!note && (
            <span className="text-muted-foreground/60">(optional)</span>
          )}
        </label>
        {isEditingNote || note ? (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add your thoughts, why you're saving this, or what to remember..."
            className="w-full px-2 py-1.5 text-xs bg-transparent border border-primary/20 focus:border-primary/50 rounded outline-none resize-none min-h-[60px] transition-colors placeholder:text-muted-foreground"
            autoFocus={isEditingNote && !note}
            onBlur={() => {
              if (!note) setIsEditingNote(false)
            }}
          />
        ) : (
          <button
            onClick={() => setIsEditingNote(true)}
            className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded border border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 transition-all cursor-pointer"
          >
            Click to add a note...
          </button>
        )}
      </div>
    </div>
  )
}
