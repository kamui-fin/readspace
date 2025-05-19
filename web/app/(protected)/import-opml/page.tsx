'use client'

import { Button } from "@/components/ui/button"
import { ApiClient } from "@/lib/api/client"
import { RSS_QUERY_KEYS } from "@/lib/api/hooks/feeds"
import { useQueryClient } from "@tanstack/react-query"
import { Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState } from "react"
import { toast } from "react-hot-toast"

// Define the OPML import response type
interface OPMLImportResponse {
    imported_count: number;
    failed_count: number;
    errors?: Array<{
        url: string;
        title: string;
        error: string;
    }>;
}

export default function ImportOPMLPage() {
    const [isUploading, setIsUploading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const queryClient = useQueryClient()

    const handleFileUpload = async (file: File) => {
        if (!file || (!file.name.endsWith('.opml') && !file.name.endsWith('.xml'))) {
            toast.error('Please select a valid OPML or XML file')
            return
        }

        const formData = new FormData()
        formData.append('opml_file', file)
        formData.append('default_folder_name', 'Imported Feeds')

        setIsUploading(true)

        try {
            // Use the dedicated uploadFile method for multipart form data
            const data = await ApiClient.uploadFile('/rss/opml/import', formData);

            // Invalidate all feed and folder queries after successful import
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] }),
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FOLDERS] }),
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] }),
                queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS] })
            ])

            // Show success message with import stats
            toast.success(`Successfully imported ${data.imported_count} feeds`)

            // If there were any errors, show them
            if (data.failed_count > 0) {
                toast.error(`Failed to import ${data.failed_count} feeds`)
            }

            // Redirect to main articles page
            router.push('/articles')
        } catch (error) {
            console.error('Error uploading OPML file:', error)
            toast.error('Failed to import OPML file. Please try again.')
        } finally {
            setIsUploading(false)
        }
    }

    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0])
        }
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0])
        }
    }

    const handleButtonClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }

    return (
        <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl rounded-bl-none shadow-sm">
            <div className="flex flex-col w-full p-6 items-center justify-center">
                <div className="max-w-xl w-full">
                    <h1 className="text-3xl font-semibold mb-2">OPML Import</h1>
                    <p className="text-muted-foreground mb-8">
                        Batch import feeds from an OPML file
                    </p>

                    <div
                        className={`border-2 border-dashed rounded-xl p-12 text-center ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'
                            } transition-colors duration-200 ease-in-out`}
                        onDrop={handleFileDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileInputChange}
                            accept=".opml,.xml"
                            className="hidden"
                        />
                        <div className="flex flex-col items-center justify-center gap-4">
                            <Upload size={48} className="text-muted-foreground" />

                            <div className="space-y-2">
                                <h3 className="text-lg font-medium">
                                    {isDragging ? 'Drop your OPML file here' : 'Choose OPML File'}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    or drag an OPML file here
                                </p>
                            </div>

                            <Button
                                onClick={handleButtonClick}
                                disabled={isUploading}
                                className="mt-4"
                            >
                                {isUploading ? 'Uploading...' : 'Choose OPML File'}
                            </Button>
                        </div>
                    </div>

                    <div className="mt-6 text-sm text-muted-foreground">
                        <p className="mb-2">
                            <strong>What is an OPML file?</strong>
                        </p>
                        <p>
                            OPML (Outline Processor Markup Language) is a standard format for storing lists of RSS feeds.
                            Most RSS readers allow you to export your feed subscriptions as an OPML file, which you can
                            then import into Readspace.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
} 