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
import { useCurrentUser } from "@/hooks/use-current-user"
import { HTTPError } from "@/lib/errors"
import {
    LoaderCircle,
    Plus
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import toast from "react-hot-toast"
import { pdfjs } from "react-pdf"
import { DragDropBook } from "../upload-book"
import { useUploadBook } from "./api"
import { processFileMetadata } from "./utils"

// Set PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url
).toString()

export default function UploadBookDialog() {
    const [isOpen, setIsOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadedBookId, setUploadedBookId] = useState<string>("")
    const [isLocalStorage, setIsLocalStorage] = useState(false)

    const { user } = useCurrentUser()
    const router = useRouter()
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
            const { bookId } = await uploadBook.mutateAsync({
                file: selectedFile,
                user,
                isLocalStorage,
                metadata,
                charCounts,
            })

            setUploadedBookId(bookId)
            setIsOpen(false)
            router.push(`/library/${bookId}`)
        } catch (err) {
            console.error("Error during file upload process:", err)

            // Check if it's a storage limit error
            if (err instanceof HTTPError && err.status === 429) {
                return
            }

            toast.error(
                err instanceof Error
                    ? err.message
                    : "An unexpected error occurred. Please try again."
            )
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={isUploading}
                >
                    {isUploading ? (
                        <>
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Plus className="h-4 w-4" />
                            Upload Book
                        </>
                    )}
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
                        isLocalStorage={isLocalStorage}
                        setIsLocalStorage={setIsLocalStorage}
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
