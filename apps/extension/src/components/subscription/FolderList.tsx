import { useFolderManagement } from '@/hooks/use-folder-management'
import {
    Check,
    Folder as FolderIcon,
    FolderPlus,
    X,
} from 'lucide-react'
import { useEffect } from 'react'
import { FolderItem } from './FolderItem'
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog'

interface FolderListProps {
    selectedFolderId: string | undefined
    onSelectFolder: (id: string | undefined) => void
}

export function FolderList({
    selectedFolderId,
    onSelectFolder,
}: FolderListProps) {
    const {
        folders,
        isCreatingFolder,
        setIsCreatingFolder,
        newFolderName,
        setNewFolderName,
        editingState,
        setEditingState,
        deletingFolder,
        setDeletingFolder,
        handleCreateFolder,
        handleRenameFolder,
        startEditingFolder,
        confirmDeleteFolder,
    } = useFolderManagement()

    // Handle side effects of deletion on selection
    useEffect(() => {
        if (deletingFolder && deletingFolder.id === selectedFolderId) {
            // We don't clear selection here, we do it after confirmation success
        }
    }, [deletingFolder, selectedFolderId])

    const onConfirmDelete = async () => {
        if (deletingFolder?.id === selectedFolderId) {
            onSelectFolder(undefined)
        }
        await confirmDeleteFolder()
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                    Folder <span className="text-red-500">*</span>
                </label>
                <button
                    type="button"
                    onClick={() => setIsCreatingFolder(true)}
                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                    <FolderPlus className="w-3.5 h-3.5" />
                    New Folder
                </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {folders.map((folder) => (
                    <FolderItem
                        key={folder.id}
                        folder={folder}
                        isSelected={selectedFolderId === folder.id}
                        isEditing={editingState?.id === folder.id}
                        editingName={editingState?.name || ''}
                        onSelect={() => !editingState && onSelectFolder(folder.id)}
                        onStartEditing={() => startEditingFolder(folder)}
                        onEditNameChange={(name) => setEditingState(prev => prev ? { ...prev, name } : null)}
                        onConfirmEdit={handleRenameFolder}
                        onCancelEdit={() => setEditingState(null)}
                        onDelete={() => setDeletingFolder(folder)}
                    />
                ))}

                {/* Create New Folder Input */}
                {isCreatingFolder && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-primary/40 bg-primary/10 shadow-sm">
                        <div className="bg-primary rounded p-1 flex-shrink-0">
                            <FolderIcon className="w-3.5 h-3.5 text-primary-foreground" />
                        </div>
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateFolder()
                                if (e.key === 'Escape') {
                                    setIsCreatingFolder(false)
                                    setNewFolderName('')
                                }
                            }}
                            placeholder="Enter folder name..."
                            className="flex-1 px-2 py-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={handleCreateFolder}
                            className="text-primary hover:text-primary/80 p-1 rounded hover:bg-primary/10 transition-colors flex-shrink-0"
                        >
                            <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsCreatingFolder(false)
                                setNewFolderName('')
                            }}
                            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {folders.length === 0 && !isCreatingFolder && (
                    <p className="text-sm text-muted-foreground py-2 text-center">
                        No folders yet. Click "New Folder" to create one.
                    </p>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            {deletingFolder && (
                <DeleteConfirmationDialog
                    folderName={deletingFolder.name}
                    onConfirm={onConfirmDelete}
                    onCancel={() => setDeletingFolder(null)}
                />
            )}
        </div>
    )
}
