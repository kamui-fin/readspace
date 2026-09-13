import { ArticlePriority, PageMetadata, Priority } from '@readspace/shared'
import { Flag, Pencil, StickyNote } from 'lucide-react'
import React, { useId, useState } from 'react'
import { ArticleHeroImage } from './ArticleHeroImage'

const PRIORITY_OPTIONS = [
  {
    value: ArticlePriority.LOW,
    label: 'Low',
    selectedClass: 'border-secondary/30 bg-secondary/10 text-secondary',
  },
  {
    value: ArticlePriority.MEDIUM,
    label: 'Medium',
    selectedClass:
      'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    value: ArticlePriority.HIGH,
    label: 'High',
    selectedClass:
      'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  },
] as const

const SECTION_LABEL_CLASS =
  'flex items-center gap-1.5 text-xs font-medium text-muted-foreground'

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
  const id = useId()
  const priorityLabelId = `${id}-priority`
  const noteId = `${id}-note`
  const selectedIndex = PRIORITY_OPTIONS.findIndex(
    (option) => option.value === priority
  )

  const handleEditTitle = () => {
    // Preserve the current title (custom or metadata) when editing
    if (!customTitle && metadata?.title) {
      setCustomTitle(metadata.title)
    }
    setIsEditingTitle(true)
  }

  // Radio-group arrow-key navigation: move selection and focus together
  const handlePriorityKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (!step) return
    event.preventDefault()
    const count = PRIORITY_OPTIONS.length
    const next =
      PRIORITY_OPTIONS[(Math.max(selectedIndex, 0) + step + count) % count]
    setPriority(next.value)
    event.currentTarget
      .querySelector<HTMLButtonElement>(`[data-priority="${next.value}"]`)
      ?.focus()
  }

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      {/* Article: image + title read as one unit */}
      <div className="space-y-3">
        <ArticleHeroImage key={metadata?.image_url} src={metadata?.image_url} />

        <div className="flex items-start gap-2">
          {isEditingTitle ? (
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={metadata?.title || 'Enter custom title...'}
              aria-label="Article title"
              className="flex-1 border-b border-primary/30 bg-transparent py-0.5 text-base font-semibold leading-snug tracking-[-0.02em] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              autoFocus
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  setIsEditingTitle(false)
                }
              }}
            />
          ) : (
            <>
              <h4 className="min-w-0 flex-1 text-base font-semibold leading-snug tracking-[-0.02em]">
                {customTitle || metadata?.title || 'Untitled Article'}
              </h4>
              <button
                type="button"
                onClick={handleEditTitle}
                className="-mr-1 shrink-0 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                title="Edit title"
                aria-label="Edit title"
              >
                <Pencil className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <p id={priorityLabelId} className={SECTION_LABEL_CLASS}>
          <Flag className="size-3" aria-hidden="true" />
          Priority
        </p>
        <div
          role="radiogroup"
          aria-labelledby={priorityLabelId}
          onKeyDown={handlePriorityKeyDown}
          className="grid grid-cols-3 gap-2"
        >
          {PRIORITY_OPTIONS.map((option, index) => {
            const isSelected = index === selectedIndex
            const isTabStop =
              isSelected || (selectedIndex === -1 && index === 0)
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isTabStop ? 0 : -1}
                data-priority={option.value}
                onClick={() => setPriority(option.value)}
                className={`flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                  isSelected
                    ? option.selectedClass
                    : 'border-transparent bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground'
                }`}
              >
                <Flag className="size-3" aria-hidden="true" />
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Note */}
      <div className="space-y-2">
        <label htmlFor={noteId} className={SECTION_LABEL_CLASS}>
          <StickyNote className="size-3" aria-hidden="true" />
          Note
          {!note && (
            <span className="font-normal text-muted-foreground/70">
              (optional)
            </span>
          )}
        </label>
        {isEditingNote || note ? (
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add your thoughts, why you're saving this, or what to remember..."
            className="block min-h-[64px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
            autoFocus={isEditingNote && !note}
            onBlur={() => {
              if (!note) setIsEditingNote(false)
            }}
          />
        ) : (
          <button
            id={noteId}
            type="button"
            onClick={() => setIsEditingNote(true)}
            className="flex h-9 w-full cursor-pointer items-center rounded-md border border-dashed border-muted-foreground/25 bg-foreground/[0.02] px-3 text-left text-xs text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:bg-foreground/[0.04] hover:text-foreground"
          >
            Click to add a note...
          </button>
        )}
      </div>
    </div>
  )
}
