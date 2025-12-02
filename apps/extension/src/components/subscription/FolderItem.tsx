
import {
    Check,
    Folder as FolderIcon,
    Pencil,
    Trash2,
    X,
} from 'lucide-react'
import { Folder } from '@readspace/shared'

interface FolderItemProps {
    folder: Folder
    isSelected: boolean
    isEditing: boolean
    editingName: string
    onSelect: () => void
    onStartEditing: () => void
    onEditNameChange: (name: string) => void
    onConfirmEdit: () => void
    onCancelEdit: () => void
    onDelete: () => void
}

export function FolderItem({
    folder,
    isSelected,
    isEditing,
    editingName,
    onSelect,
    onStartEditing,
    onEditNameChange,
    onConfirmEdit,
    onCancelEdit,
    onDelete,
}: FolderItemProps) {
    if (isEditing) {
        return (
            <div className="group flex items-center gap-2.5 p-2.5 rounded-lg border bg-primary/10 border-primary/40 shadow-sm transition-all cursor-pointer">
                <div className="bg-muted rounded p-1 flex-shrink-0">
                    <FolderIcon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <input
                    type="text"
                    value={editingName}
                    onChange={(e) => onEditNameChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onConfirmEdit()
                        if (e.key === 'Escape') onCancelEdit()
                    }}
                    className="flex-1 px-2 py-1 text-sm bg-transparent border-b border-primary/30 focus:border-primary outline-none"
                    autoFocus
                />
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        onConfirmEdit()
                    }}
                    className="text-primary hover:text-primary/80 p-1 rounded hover:bg-primary/10 transition-colors flex-shrink-0"
                >
                    <Check className="w-3.5 h-3.5" />
                </button>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        onCancelEdit()
                    }}
                    className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        )
    }

    return (
        <div
            className={`group flex items-center gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${isSelected
                ? 'bg-primary/10 border-primary/40 shadow-sm'
                : 'hover:bg-accent/50 border-border hover:border-border/60'
                }`}
            onClick={onSelect}
        >
            <div
                className={`rounded p-1 flex-shrink-0 transition-colors ${isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                    }`}
            >
                <FolderIcon className="w-3.5 h-3.5" />
            </div>
            <span className="flex-1 text-sm font-medium">{folder.name}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        onStartEditing()
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
                        onDelete()
                    }}
                    className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors flex-shrink-0"
                    title="Delete folder"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
        </div>
    )
}
