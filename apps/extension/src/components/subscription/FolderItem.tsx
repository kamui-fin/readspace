import {
    Folder as FolderIcon,
} from 'lucide-react'
import { Folder } from '@readspace/shared'

interface FolderItemProps {
    folder: Folder
    isSelected: boolean
    onSelect: () => void
}

export function FolderItem({
    folder,
    isSelected,
    onSelect,
}: FolderItemProps) {
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
        </div>
    )
}
