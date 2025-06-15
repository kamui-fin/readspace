import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { PageMetadata, SaveOptions, Priority } from '@/types'
import { useExtensionStore } from '@/store'
import { ArrowLeft, Save, X } from 'lucide-react'

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
  isLoading = false
}: AdvancedSaveOptionsProps) {
  const { folders, tags } = useExtensionStore()
  
  const [titleOverride, setTitleOverride] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const handleSave = () => {
    const options: Partial<SaveOptions> = {
      title: titleOverride || undefined,
      folder_id: selectedFolderId || undefined,
      tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      note: note || undefined,
      priority,
    }
    onSave(options)
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
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            CUSTOMIZE YOUR SAVE
          </p>
        </div>
      </div>

      {/* Article Preview (simplified) */}
      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
        <h4 className="font-medium text-sm line-clamp-2">
          {metadata.title || 'Untitled Article'}
        </h4>
        {metadata.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {metadata.description}
          </p>
        )}
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

        {/* Folder Selection */}
        {folders.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Folder</Label>
            <Select 
              value={selectedFolderId} 
              onChange={(e) => setSelectedFolderId(e.target.value)}
              className="text-sm"
            >
              <option value="">No folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </Select>
          </div>
        )}

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

        {/* Tags */}
        {tags.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tags</Label>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  className="focus:outline-none"
                >
                  <Badge
                    variant={selectedTagIds.includes(tag.id) ? "default" : "secondary"}
                    className="text-xs cursor-pointer hover:bg-primary/80"
                  >
                    {tag.name}
                    {selectedTagIds.includes(tag.id) && (
                      <X className="w-3 h-3 ml-1" />
                    )}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Note */}
        <div className="space-y-2">
          <Label htmlFor="note" className="text-sm font-medium">
            Note (optional)
          </Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
            placeholder="Add a note about this article..."
            className="text-sm min-h-[60px] resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="flex-1"
        >
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
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
} 