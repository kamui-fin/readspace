"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Stepper,
    StepperIndicator,
    StepperItem,
    StepperSeparator,
    StepperTitle,
    StepperTrigger,
} from "@/components/ui/stepper"
import { useCurrentUser } from "@/hooks/use-current-user"
import { HTTPError } from "@/lib/errors"
import {
    ArrowRightIcon,
    BookOpen,
    Check,
    LoaderCircle,
    Plus,
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
    const [step, setStep] = useState(1)
    const [isLocalStorage, setIsLocalStorage] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadedBookId, setUploadedBookId] = useState<string>("")

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

            // Move to goals step instead of final step
            setStep(2)
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
            // Reset to upload step on failure
        } finally {
            setIsUploading(false)
        }
    }

    const stepContent = [
        {
            step: 1,
            stepTitle: "Upload",
            title: "Upload your document",
            description:
                "Select the document you want to upload and we'll take care of the rest.",
            children: (
                <DragDropBook
                    isUploading={isUploading}
                    onFileSelect={setSelectedFile}
                    selectedFile={selectedFile}
                    onRemoveFile={() => setSelectedFile(null)}
                    user={user}
                    isLocalStorage={isLocalStorage}
                    setIsLocalStorage={setIsLocalStorage}
                />
            ),
        },
        {
            step: 3,
            stepTitle: "Complete",
            title: "You're all set!",
            description:
                "Your book has been uploaded and is ready to read. You can now start reading and taking notes.",
            children: (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                    <BookOpen className="h-12 w-12 text-primary" />
                    <p className="text-center text-sm text-muted-foreground">
                        Your book has been uploaded successfully. You can now
                        dive right in to your book!
                    </p>
                    <Button
                        onClick={() => {
                            setIsOpen(false)
                            router.push(`/library/${uploadedBookId}`)
                        }}
                    >
                        Start Reading
                    </Button>
                </div>
            ),
        },
    ]

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
                    <Stepper value={step}>
                        {stepContent.map((content, index) => (
                            <StepperItem
                                key={content.step}
                                step={content.step}
                                className="flex-1"
                            >
                                <StepperTrigger
                                    disabled={step < content.step}
                                    className="flex w-full flex-col items-center gap-2"
                                >
                                    <StepperIndicator>
                                        {step > content.step ? (
                                            <Check className="h-4 w-4" />
                                        ) : (
                                            content.step
                                        )}
                                    </StepperIndicator>
                                    <StepperTitle>
                                        {content.stepTitle}
                                    </StepperTitle>
                                </StepperTrigger>
                                {index < stepContent.length - 1 && (
                                    <StepperSeparator />
                                )}
                            </StepperItem>
                        ))}
                    </Stepper>
                </div>
                <div className="py-4">{stepContent[step - 1].children}</div>
                <DialogFooter>
                    {step === 1 && (
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
                                <>
                                    Continue
                                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    )}
                    {step === 2 && (
                        <Button
                            onClick={() => setStep(3)}
                            disabled={!uploadedBookId}
                        >
                            Continue
                            <ArrowRightIcon className="ml-2 h-4 w-4" />
                        </Button>
                    )}
                    {step === 3 && (
                        <DialogClose asChild>
                            <Button
                                onClick={() => {
                                    router.push(`/library/${uploadedBookId}`)
                                }}
                            >
                                Start Reading
                            </Button>
                        </DialogClose>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
