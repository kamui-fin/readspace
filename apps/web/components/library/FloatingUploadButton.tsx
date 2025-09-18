"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useIsMobile } from "@/hooks/useMobile"
import { HTTPError } from "@/lib/errors"
import { LoaderCircle, Plus } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"
import { useQueryClient } from "@tanstack/react-query"
import { BOOK_QUERY_KEYS } from "@readspace/shared"
import { pdfjs } from "react-pdf"
import { DragDropBook } from "./UploadBook"
import { useUploadBook } from "./upload/api"
import { processFileMetadata } from "./upload/utils"

// Set PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url
).toString()

export default function FloatingUploadButton() {
    const [isOpen, setIsOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const { user } = useCurrentUser()
    const isMobile = useIsMobile()
    const queryClient = useQueryClient()
    const uploadBook = useUploadBook()

    const handleFileUpload = async () => {
        if (!selectedFile || !user) return

        setIsUploading(true)
        try {
            // Process file metadata
            const fileBuffer = await selectedFile.arrayBuffer()
            const isPdf = selectedFile.type === "application/pdf"
            const { metadata, charCounts } = await processFileMetadata(
                isPdf,
                selectedFile,
                fileBuffer
            )

            // Upload the book
            await uploadBook.mutateAsync({
                file: selectedFile,
                user,
                metadata,
                charCounts,
            })

            setIsOpen(false)
            // Invalidate books query to refresh the catalog
            queryClient.invalidateQueries({ queryKey: [BOOK_QUERY_KEYS.BOOKS] })
            toast.success("Book added to library")
        } catch (err) {
            console.error("Error during file upload process:", err)

            // Check if it's a storage limit error
            if (err instanceof HTTPError && err.status === 429) {
                return
            }

            toast.error(
                err instanceof Error
                    ? err.message
                    : "Upload failed. Please try again."
            )
        } finally {
            setIsUploading(false)
        }
    }

    if (!isMobile) {
        return null
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-50 p-0"
                    disabled={isUploading}
                >
                    {isUploading ? (
                        <LoaderCircle className="h-6 w-6 animate-spin" />
                    ) : (
                        <Plus className="h-6 w-6" />
                    )}
                    <span className="sr-only">Upload Book</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Upload a Book</DialogTitle>
                    <DialogDescription>
                        Upload a PDF or EPUB file to start reading.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <DragDropBook
                        isUploading={isUploading}
                        onFileSelect={setSelectedFile}
                        selectedFile={selectedFile}
                        onRemoveFile={() => setSelectedFile(null)}
                        user={user}
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button
                        onClick={handleFileUpload}
                        disabled={!selectedFile || isUploading}
                    >
                        {isUploading ? (
                            <>
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            "Upload"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
