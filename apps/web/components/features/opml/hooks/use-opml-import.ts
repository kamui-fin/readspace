import { useImportOPML, ApiError, validateOpml } from "@readspace/shared"
import { useRouter } from "next/navigation"
import { useState, useCallback } from "react"
import { toast } from "react-hot-toast"

export function useOpmlImport() {
    const [file, setFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const uploadOpmlMutation = useImportOPML()
    const router = useRouter()

    const handleFileUpload = useCallback(
        async (file: File) => {
            if (
                !file ||
                (!file.name.endsWith(".opml") && !file.name.endsWith(".xml"))
            ) {
                toast.error("Please select a valid OPML or XML file")
                return
            }

            // Validate OPML file
            const validation = await validateOpml(file)
            if (!validation.isValid) {
                toast.error(validation.error || "Invalid OPML file")
                return
            }

            if (validation.hasNestedCategories) {
                toast.error(
                    "OPML files with nested categories are not supported. Please flatten your categories before importing."
                )
                return
            }

            const formData = new FormData()
            formData.append("opml_file", file)
            formData.append("default_folder_name", "Imported Feeds")

            uploadOpmlMutation.mutate(formData, {
                onSuccess: (data) => {
                    toast.success(
                        `Processing ${data.estimated_feeds} feeds. Import will run silently in background.`
                    )
                    router.push(`/import-opml/status/${data.task_id}`)
                },
                onError: (error) => {
                    console.error("Error uploading OPML file:", error)
                    if (error instanceof ApiError && error.status === 429) {
                        toast.error(error.message, { duration: 8000 })
                        return
                    }
                    if (error instanceof ApiError) {
                        toast.error(error.message)
                        return
                    }
                    toast.error("Failed to import OPML file. Please try again.")
                },
            })
        },
        [uploadOpmlMutation, router]
    )

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0])
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0])
        }
    }

    return {
        isDragging,
        isLoading: uploadOpmlMutation.isPending,
        handleFileChange,
        handleDragOver,
        handleDragLeave,
        handleDrop,
    }
}
