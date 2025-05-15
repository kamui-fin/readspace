"use client"

import { getUserRoleFromId } from "@/app/(protected)/library/[id]/actions"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
    FileList,
    FileListAction,
    FileListActions,
    FileListDescription,
    FileListDescriptionSeparator,
    FileListDescriptionText,
    FileListHeader,
    FileListIcon,
    FileListInfo,
    FileListItem,
    FileListName,
    FileListSize,
} from "@/components/ui/file-list"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { getFrontendLimit } from "@/utils/limits"
import { BookOpen, LoaderCircle, X } from "lucide-react"
import { useCallback, useId, useState } from "react"
import { useDropzone } from "react-dropzone"
import { DragDropBookProps } from "./types"
import { formatFileSize } from "./utils"

export const DragDropBook = ({
    isUploading,
    enableRag,
    setEnableRag,
    onFileSelect,
    selectedFile,
    onRemoveFile,
    user,
    isLocalStorage,
    setIsLocalStorage,
}: DragDropBookProps) => {
    const ragId = useId()
    const localStorageId = useId()
    const [isLocalForceEnabled, setIsLocalForceEnabled] = useState(false)

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            const file = acceptedFiles[0]
            if (!file || !user) return

            // --- Max File Size Check ---
            // Only check size limit for cloud storage, not for local storage
            if (!isLocalStorage) {
                // Assume user role is in user_metadata, adjust if needed
                const userRole = await getUserRoleFromId(user.id)
                if (!userRole) {
                    toast.error("Failed to get user role")
                    return
                }
                const maxSizeLimit = getFrontendLimit(
                    userRole,
                    "maxFileSizeBytes"
                )
                if (file.size > maxSizeLimit) {
                    // Automatically switch to local storage
                    setIsLocalStorage(true)
                    setEnableRag(false) // Disable RAG as it's not available in local storage
                    setIsLocalForceEnabled(true) // Mark as force enabled due to size
                    toast.info(
                        `Using local storage as file exceeds cloud limit of ${formatFileSize(maxSizeLimit)}.`
                    )
                    // Continue with file selection in local mode
                }
            }
            // --- End Max File Size Check ---

            onFileSelect(file)
        },
        [user, onFileSelect, isLocalStorage, setIsLocalStorage, setEnableRag]
    )

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/epub+zip": [".epub"],
            "application/pdf": [".pdf"],
        },
        multiple: false,
    })

    return (
        <div className="w-full space-y-4">
            {selectedFile ? (
                <>
                    <FileList className="pb-8">
                        <FileListItem>
                            <FileListHeader>
                                <FileListIcon>
                                    <BookOpen className="h-4 w-4" />
                                </FileListIcon>
                                <FileListInfo>
                                    <FileListName className="truncate max-w-[200px]">
                                        {selectedFile.name}
                                    </FileListName>
                                    <FileListDescription>
                                        <FileListSize>
                                            {formatFileSize(selectedFile.size)}
                                        </FileListSize>
                                        <FileListDescriptionSeparator>
                                            •
                                        </FileListDescriptionSeparator>
                                        <FileListDescriptionText>
                                            {selectedFile.type ===
                                            "application/pdf"
                                                ? "PDF"
                                                : "EPUB"}
                                        </FileListDescriptionText>
                                    </FileListDescription>
                                </FileListInfo>
                                <FileListActions>
                                    <FileListAction onClick={onRemoveFile}>
                                        <X className="h-4 w-4" />
                                        <span className="sr-only">Remove</span>
                                    </FileListAction>
                                </FileListActions>
                            </FileListHeader>
                        </FileListItem>
                    </FileList>
                </>
            ) : (
                <Card
                    {...getRootProps()}
                    className={cn(
                        "p-12 border-2 border-dashed cursor-pointer transition-colors",
                        isDragActive
                            ? "border-primary bg-primary/5"
                            : "border-muted-foreground/25"
                    )}
                >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-4 text-center">
                        {isUploading ? (
                            <div className="flex flex-col items-center gap-4">
                                <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">
                                    Uploading your document...
                                </p>
                            </div>
                        ) : (
                            <>
                                <BookOpen className="w-12 h-12 text-muted-foreground" />
                                <div>
                                    <p className="text-xl font-medium">
                                        Drop your epub or pdf here
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        or click to select
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </Card>
            )}
            {selectedFile && (
                <div className="flex items-start gap-2">
                    <Checkbox
                        id={localStorageId}
                        checked={isLocalStorage}
                        onCheckedChange={
                            isLocalForceEnabled ? undefined : setIsLocalStorage
                        }
                        disabled={isLocalForceEnabled}
                        aria-describedby={`${localStorageId}-description`}
                    />
                    <div className="grid grow gap-2">
                        <Label
                            htmlFor={localStorageId}
                            className={isLocalForceEnabled ? "opacity-70" : ""}
                        >
                            Store locally only{" "}
                            {isLocalForceEnabled &&
                                "(Required due to file size)"}
                        </Label>
                        <p
                            id={`${localStorageId}-description`}
                            className="text-muted-foreground text-xs"
                        >
                            Store only on this device. No upload, no file size
                            limits, but AI processing will be disabled.
                        </p>
                    </div>
                </div>
            )}
            {!isLocalStorage && selectedFile && (
                <div className="flex items-start gap-2">
                    <Checkbox
                        id={ragId}
                        checked={enableRag}
                        onCheckedChange={setEnableRag}
                        aria-describedby={`${ragId}-description`}
                    />
                    <div className="grid grow gap-2">
                        <Label htmlFor={ragId}>Enable AI Processing</Label>
                        <p
                            id={`${ragId}-description`}
                            className="text-muted-foreground text-xs"
                        >
                            Process the document for enhanced AI interactions.
                            This enables better citations and deeper document
                            understanding, but may take longer to process in the
                            background.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
