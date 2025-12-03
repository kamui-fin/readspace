import { useFolders } from '@/hooks/use-feeds'
import { FolderItem } from './FolderItem'

interface FolderListProps {
    selectedFolderId: string | undefined
    onSelectFolder: (id: string | undefined) => void
}

export function FolderList({
    selectedFolderId,
    onSelectFolder,
}: FolderListProps) {
    const { data: folders } = useFolders()

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                    Folder <span className="text-red-500">*</span>
                </label>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {folders?.map((folder) => (
                    <FolderItem
                        key={folder.id}
                        folder={folder}
                        isSelected={selectedFolderId === folder.id}
                        onSelect={() => onSelectFolder(folder.id)}
                    />
                ))}

                {folders?.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2 text-center">
                        No folders found.
                    </p>
                )}
            </div>
        </div>
    )
}
