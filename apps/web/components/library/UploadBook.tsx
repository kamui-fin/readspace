"use client"

export { UploadBookDialog as default } from "./upload/index"

import { Card } from "@/components/ui/card"
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
import { cn } from "@readspace/shared"
import { BookOpen, LoaderCircle, X } from "lucide-react"
import { useCallback } from "react"
import { useDropzone } from "react-dropzone"

if (typeof Promise.withResolvers === "undefined") {
    if (window)
        // @ts-expect-error This does not exist outside of polyfill which this is doing
        window.Promise.withResolvers = function () {
            let resolve, reject
            const promise = new Promise((res, rej) => {
                resolve = res
                reject = rej
            })
            return { promise, resolve, reject }
        }
}

import { DragDropBookProps } from "./upload/types"
import { formatFileSize } from "./upload/utils"

export const DragDropBook = ({
    isUploading,
    onFileSelect,
    selectedFile,
    onRemoveFile,
    user,
}: DragDropBookProps) => {
    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            const file = acceptedFiles[0]
            if (!file || !user) return
            onFileSelect(file)
        },
        [user, onFileSelect]
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
                            <div className="flex flex-row items-center gap-2">
                                <LoaderCircle className="animate-spin text-muted-foreground" />
                                <p className="text-sm text-muted-foreground mt-1">
                                    Uploading...
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
        </div>
    )
}
