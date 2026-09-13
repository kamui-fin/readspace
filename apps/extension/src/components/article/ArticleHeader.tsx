import { Button } from '@/components/ui/button'
import { BookOpen, Loader2, Trash2 } from 'lucide-react'

interface ArticleHeaderProps {
  isSaved: boolean
  hasUnsavedChanges: boolean
  readingTime?: number
  onSave: () => void
  isPending: boolean
  isUnsavePending: boolean
  isUpdatePending: boolean
  isSavePending: boolean
  isPreparingToSave: boolean
}

export function ArticleHeader({
  isSaved,
  hasUnsavedChanges,
  readingTime,
  onSave,
  isPending,
  isUnsavePending,
  isUpdatePending,
  isSavePending,
  isPreparingToSave,
}: ArticleHeaderProps) {
  const isSaving = isSavePending || isPreparingToSave
  const isBusy = isSaving || isUpdatePending || isUnsavePending
  // Pending states win: `isSaved` is already true while a first save is in flight
  const showUnsave =
    isSaved && !hasUnsavedChanges && !isSaving && !isUpdatePending
  const buttonLabel = isSaving
    ? 'Saving'
    : isUpdatePending
      ? 'Updating'
      : isUnsavePending
        ? 'Removing'
        : showUnsave
          ? 'Unsave'
          : isSaved
            ? 'Update'
            : 'Save'

  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
        <BookOpen className="size-4 text-primary-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-tight">
          {isSaved ? 'Saved article' : 'Save article for later'}
        </h3>
        {readingTime ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {readingTime} min read
          </p>
        ) : null}
      </div>

      <Button
        onClick={() => onSave()}
        disabled={isPending}
        size="sm"
        variant={showUnsave ? 'outline' : 'default'}
        aria-busy={isBusy}
        className={`w-[104px] shrink-0 ${
          showUnsave
            ? 'border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground'
            : ''
        }`}
      >
        {isBusy ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : showUnsave ? (
          <Trash2 aria-hidden="true" />
        ) : null}
        {buttonLabel}
      </Button>
    </div>
  )
}
