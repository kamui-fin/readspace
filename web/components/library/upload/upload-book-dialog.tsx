"use client"

import { getUserRoleFromId } from "@/app/(protected)/library/[id]/actions"
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
import { toast } from "@/components/ui/sonner"
import {
    Stepper,
    StepperIndicator,
    StepperItem,
    StepperSeparator,
    StepperTitle,
    StepperTrigger,
} from "@/components/ui/stepper"
import { useCreateDeck } from "@/hooks/deck/use-create-deck"
import { useIsMobile } from "@/hooks/use-mobile"
import { HTTPError } from "@/lib/errors"
import { createClient } from "@/lib/supabase/client"
import { useUpgradeDialog } from "@/stores/upgrade-dialog"
import { getFrontendLimit, UserRole } from "@/utils/limits"
import { User } from "@supabase/supabase-js"
import { ArrowRightIcon, BookOpen, LoaderCircle, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { pdfjs } from "react-pdf"
import { uploadBook } from "./api"
import { BookGoalsForm } from "./book-form"
import { DragDropBook } from "./drag-drop-book"
import { formatFileSize, processFileMetadata } from "./utils"

// Set PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url
).toString()

export default function UploadBookDialog() {
    const [isOpen, setIsOpen] = useState(false)
    const [step, setStep] = useState(1)
    const [enableRag, setEnableRag] = useState(true)
    const [isLocalStorage, setIsLocalStorage] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [userRole, setUserRole] = useState<UserRole | null>(null)
    const [uploadedBookId, setUploadedBookId] = useState<string>("")

    const supabase = createClient()
    const openUpgradeDialog = useUpgradeDialog((state) => state.open)
    const createDeckMutation = useCreateDeck()
    const isMobile = useIsMobile()

    useEffect(() => {
        const getUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser()
            const userRole = await getUserRoleFromId(user?.id)
            if (!userRole) {
                toast.error("Failed to get user role")
                return
            }
            setUser(user)
            setUserRole(userRole)
        }
        getUser()
    }, [supabase])

    const setupDeck = async (name: string, bookId: string) => {
        await createDeckMutation.mutateAsync({
            name: name,
        })
    }

    const handleFileUpload = async () => {
        if (!selectedFile || !user || !userRole) return

        setIsUploading(true)
        try {
            // Get current usage limits first
            const { data: usageLimits, error: limitsError } = await supabase
                .from("user_usage_limits")
                .select("storage_used_bytes, rag_pages_current_month")
                .eq("user_id", user.id)
                .single()

            if (limitsError) {
                console.error("Error fetching usage limits:", limitsError)
                throw new Error("Failed to check usage limits")
            }

            const currentStorage = usageLimits?.storage_used_bytes || 0
            const currentRagPages = usageLimits?.rag_pages_current_month || 0

            // Check storage limit
            const storageLimit = getFrontendLimit(userRole, "storageBytes")
            if (
                !isLocalStorage &&
                currentStorage + selectedFile.size > storageLimit
            ) {
                toast.error(
                    `Adding this file would exceed your storage limit of ${formatFileSize(storageLimit)}.`
                )
                return
            }

            // Process file metadata
            const fileBuffer = await selectedFile.arrayBuffer()
            const isPdf = selectedFile.type === "application/pdf"
            const { metadata, charCounts } = await processFileMetadata(
                isPdf,
                selectedFile,
                fileBuffer
            )

            const estimatedPages = metadata.total_pages || 1

            // --- RAG Page Limit Check ---
            if (enableRag && !isLocalStorage) {
                const ragPagesLimit = getFrontendLimit(
                    userRole,
                    "ragPagesPerMonth"
                )
                if (currentRagPages + estimatedPages > ragPagesLimit) {
                    toast.error(
                        `Processing this document (${estimatedPages} pages) would exceed your monthly RAG limit of ${ragPagesLimit} pages.`
                    )
                    setEnableRag(false) // Disable RAG automatically
                }
            }

            // Upload the book
            const { bookId, dbBookData } = await uploadBook(
                selectedFile,
                user,
                userRole,
                enableRag,
                isLocalStorage,
                supabase,
                metadata,
                charCounts
            )

            await setupDeck(dbBookData.title, bookId)
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
                "Failed to upload book",
                err instanceof Error
                    ? err.message
                    : "An unexpected error occurred. Please try again."
            )
            // Reset to upload step on failure
        } finally {
            setIsUploading(false)
        }
    }

    const handleGoalsComplete = () => {
        setStep(3) // Move to final step
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
                    enableRag={enableRag}
                    setEnableRag={setEnableRag}
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
            step: 2,
            stepTitle: "Personalize",
            title: "Add some goals",
            description:
                "Tell us what you want to achieve with this document and we'll help you get there.",
            children:
                userRole && uploadedBookId ? (
                    <BookGoalsForm
                        bookId={uploadedBookId}
                        userRole={userRole}
                        onComplete={handleGoalsComplete}
                    />
                ) : null,
        },
        {
            step: 3,
            stepTitle: "Done",
            title: "You're all set!",
            description:
                "Your book has been successfully uploaded and is ready to read.",
            children: (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <BookOpen className="w-16 h-16 text-primary mb-4" />
                    <p className="text-lg font-medium mb-2">
                        Ready to start reading
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {enableRag && !isLocalStorage
                            ? "Your book is processing in the background. You can start reading now while it completes."
                            : "Your book has been processed and is ready for you to explore."}
                    </p>
                </div>
            ),
        },
    ]

    const totalSteps = stepContent.length

    const handleContinue = () => {
        if (step === 1 && selectedFile) {
            handleFileUpload()
        } else if (step < totalSteps) {
            setStep(step + 1)
        }
    }

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open)
                if (!open) {
                    setStep(1)
                    setEnableRag(true)
                    setSelectedFile(null)
                    setUploadedBookId("")
                }
            }}
        >
            <DialogTrigger asChild>
                <Button className={isMobile ? "size-9 p-0 flex" : undefined}>
                    <Plus className="h-4 w-4" />
                    {!isMobile && <span className="mx-2">Add content</span>}
                </Button>
            </DialogTrigger>
            <DialogContent className="gap-0 p-0 [&>button:last-child]:text-white w-full max-w-full sm:max-w-[700px]">
                <div className="space-y-6 px-4 sm:px-6 pt-3 pb-6">
                    <div className="space-y-8 w-full max-w-full text-left mt-2 mb-8">
                        <Stepper value={step}>
                            {stepContent.map(({ step, stepTitle }) => (
                                <StepperItem
                                    key={step}
                                    step={step}
                                    className="not-last:flex-1 max-md:items-start"
                                >
                                    <StepperTrigger className="cursor-default">
                                        <StepperIndicator />
                                        <div className="text-left sm:text-center hidden md:block">
                                            <StepperTitle>
                                                {stepTitle}
                                            </StepperTitle>
                                        </div>
                                    </StepperTrigger>
                                    {step <= stepContent.length && (
                                        <StepperSeparator className="max-md:mt-3.5 md:mx-4" />
                                    )}
                                </StepperItem>
                            ))}
                        </Stepper>
                    </div>
                    <DialogHeader className="text-left">
                        <DialogTitle>{stepContent[step - 1].title}</DialogTitle>
                        <DialogDescription className="mb-4 text-left">
                            {stepContent[step - 1].description}
                        </DialogDescription>
                        {stepContent[step - 1].children}
                    </DialogHeader>
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <DialogFooter className="justify-end w-full">
                            {step < totalSteps ? (
                                step === 1 ? (
                                    <Button
                                        className="group"
                                        type="button"
                                        disabled={isUploading || !selectedFile}
                                        onClick={handleContinue}
                                    >
                                        {isUploading ? (
                                            <div className="flex items-center gap-2">
                                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                                <span>Uploading...</span>
                                            </div>
                                        ) : (
                                            <>
                                                Next
                                                <ArrowRightIcon
                                                    className="-me-1 opacity-60 transition-transform group-hover:translate-x-0.5"
                                                    size={16}
                                                    aria-hidden="true"
                                                />
                                            </>
                                        )}
                                    </Button>
                                ) : null
                            ) : (
                                <DialogClose asChild>
                                    <Button>Okay</Button>
                                </DialogClose>
                            )}
                        </DialogFooter>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
