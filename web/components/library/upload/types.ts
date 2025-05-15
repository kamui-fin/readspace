import { User } from "@supabase/supabase-js"
import { NavItem } from "epubjs/types/navigation"

export interface PdfMetadata {
    info: {
        Title?: string
        Author?: string
    }
}

export interface BookProgress {
    globalProgress: {
        current: number
        total: number
    }
}

export interface BookMetadata {
    title: string
    author: string
    description?: string
    coverUrl: string
    total_pages?: number
    toc?: NavItem[]
}

export interface DragDropBookProps {
    isUploading: boolean
    enableRag: boolean
    setEnableRag: (value: boolean) => void
    onFileSelect: (file: File | null) => void
    selectedFile: File | null
    onRemoveFile: () => void
    user: User | null
    isLocalStorage: boolean
    setIsLocalStorage: (value: boolean) => void
}

export interface ProcessedFileMetadata {
    metadata: BookMetadata
    charCounts: number[]
}
