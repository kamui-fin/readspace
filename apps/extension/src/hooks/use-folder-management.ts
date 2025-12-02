import { Folder } from '@readspace/shared'
import { useFeeds } from './use-feeds'
import { useCreateFolder, useDeleteFolder, useUpdateFolder } from './use-folders'
import { useState } from 'react'
import toast from 'react-hot-toast'

export function useFolderManagement() {
    const { data: feedsData } = useFeeds()
    const folders = feedsData?.folders || []

    const createFolderMutation = useCreateFolder()
    const updateFolderMutation = useUpdateFolder()
    const deleteFolderMutation = useDeleteFolder()

    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')

    // Group editing state
    const [editingState, setEditingState] = useState<{ id: string; name: string } | null>(null)

    // Group deleting state
    const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null)

    const handleCreateFolder = async () => {
        const name = newFolderName.trim()
        if (!name) {
            toast.error('Please enter a folder name')
            return
        }

        try {
            await createFolderMutation.mutateAsync({ name })
            setNewFolderName('')
            setIsCreatingFolder(false)
            toast.success('Folder created successfully')
        } catch (error) {
            console.error('Failed to create folder:', error)
            toast.error('Failed to create folder')
        }
    }

    const handleRenameFolder = async () => {
        if (!editingState || !editingState.name.trim()) {
            toast.error('Please enter a folder name')
            return
        }

        try {
            await updateFolderMutation.mutateAsync({
                folderId: editingState.id,
                name: editingState.name.trim(),
            })
            setEditingState(null)
            toast.success('Folder renamed successfully')
        } catch (error) {
            console.error('Failed to rename folder:', error)
            toast.error('Failed to rename folder')
        }
    }

    const startEditingFolder = (folder: Folder) => {
        setEditingState({ id: folder.id, name: folder.name })
    }

    const confirmDeleteFolder = async () => {
        if (!deletingFolder) return

        try {
            await deleteFolderMutation.mutateAsync(deletingFolder.id)
            setDeletingFolder(null)
            toast.success('Folder deleted successfully')
        } catch (error) {
            console.error('Failed to delete folder:', error)
            toast.error('Failed to delete folder')
        }
    }

    return {
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
    }
}
