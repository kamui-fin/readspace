import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageMetadata, SaveOptions, Priority } from '@readspace/shared'
import { ArrowLeft, Save } from 'lucide-react'
import toast from 'react-hot-toast'

interface AdvancedSaveOptionsProps {
  metadata: PageMetadata
  onSave: (options: Partial<SaveOptions>) => void
  onCancel: () => void
  isLoading?: boolean
}

export function AdvancedSaveOptions({
  metadata,
  onSave,
  onCancel,
  isLoading = false,
}: AdvancedSaveOptionsProps) {
  const [titleOverride, setTitleOverride] = useState('')
  const [note, setNote] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')

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
          <Input
            id="title"
            value={titleOverride}
            onChange={(e) => setTitleOverride(e.target.value)}
            placeholder={metadata.title || 'Enter custom title...'}
            className="text-sm"
          />
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Priority</Label>
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>

        {/* Note */}
        <div className="space-y-2">
          <Label htmlFor="note" className="text-sm font-medium">
            Note (optional)
          </Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setNote(e.target.value)
            }
            placeholder="Add a note about this article..."
            className="text-sm min-h-[60px] resize-none"
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
