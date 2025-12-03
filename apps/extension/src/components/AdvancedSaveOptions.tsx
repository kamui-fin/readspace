import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PageMetadata, SaveOptions, Priority } from '@readspace/shared'
import { ArrowLeft, Save, Flag, StickyNote } from 'lucide-react'
import toast from 'react-hot-toast'

interface AdvancedSaveOptionsProps {
  metadata: PageMetadata
  initialValues?: {
    title?: string
    note?: string
    priority?: Priority
  }
  onSave: (options: Partial<SaveOptions>) => void
  onCancel: () => void
  isLoading?: boolean
}

export function AdvancedSaveOptions({
  metadata,
  initialValues,
  onSave,
  onCancel,
  isLoading = false,
}: AdvancedSaveOptionsProps) {
  const [titleOverride, setTitleOverride] = useState(initialValues?.title || metadata.title || '')
  const [note, setNote] = useState(initialValues?.note || '')
  const [priority, setPriority] = useState<Priority>(initialValues?.priority || 'LOW')

  const handleSave = async () => {
    const options: Partial<SaveOptions> = {
      title: titleOverride || undefined,
      note: note || undefined,
      priority,
    }

    try {
      await onSave(options)
      toast.success('Article saved with custom options!')
    } catch (error) {
      console.error('Failed to save article with custom options:', error)
      toast.error('Failed to save article with custom options')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 w-8 p-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h3 className="font-medium">Advanced Save Options</h3>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-4">
        {/* Title Override */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-medium">
            Custom Title (optional)
          </Label>
          <input
            type="text"
            id="title"
            value={titleOverride}
            onChange={(e) => setTitleOverride(e.target.value)}
            placeholder={metadata.title || 'Enter custom title...'}
            className="w-full px-3 py-2 text-sm bg-transparent border border-primary/20 focus:border-primary/50 rounded outline-none transition-colors"
          />
        </div>

        {/* Priority - Visual buttons */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5" />
            Priority
          </Label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPriority('LOW')}
              className={`
                px-3 py-2 rounded text-sm font-medium transition-all
                ${priority === 'LOW'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
                }
              `}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Flag className="w-3.5 h-3.5" />
                Low
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPriority('MEDIUM')}
              className={`
                px-3 py-2 rounded text-sm font-medium transition-all
                ${priority === 'MEDIUM'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
                }
              `}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Flag className="w-3.5 h-3.5" />
                Medium
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPriority('HIGH')}
              className={`
                px-3 py-2 rounded text-sm font-medium transition-all
                ${priority === 'HIGH'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent'
                }
              `}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Flag className="w-3.5 h-3.5" />
                High
              </div>
            </button>
          </div>
        </div>

        {/* Note - Enhanced design */}
        <div className="space-y-2">
          <Label
            htmlFor="note"
            className="text-sm font-medium flex items-center gap-1.5"
          >
            <StickyNote className="w-3.5 h-3.5" />
            Note{' '}
            <span className="text-muted-foreground/60 font-normal">
              (optional)
            </span>
          </Label>
          <textarea
            id="note"
            value={note}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setNote(e.target.value)
            }
            placeholder="Add your thoughts, why you're saving this, or what to remember..."
            className="w-full px-3 py-2 text-sm bg-transparent border border-primary/20 focus:border-primary/50 rounded outline-none resize-none min-h-[80px] transition-colors"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button onClick={handleSave} disabled={isLoading} className="flex-1">
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Article
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
