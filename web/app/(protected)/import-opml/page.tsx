'use client'

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ApiClient } from "@/lib/api/client"
import { RSS_QUERY_KEYS } from "@/lib/api/hooks/feeds"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle, Upload, Clock } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState, useEffect } from "react"
import { toast } from "react-hot-toast"

// OPML import response types
interface OPMLImportResponse {
    processing_mode: 'background';
    task_id: string;
    message: string;
    estimated_feeds: number;
    check_status_url: string;
    // Results when completed
    imported_count?: number;
    failed_count?: number;
    already_existed_count?: number;
    total_feeds?: number;
    errors?: Array<{
        url: string;
        title: string;
        error: string;
        status: string;
    }>;
    summary?: {
        successful: number;
        failed: number;
        already_existed: number;
    };
}

interface ImportStatus {
    task_id: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    message: string;
    result?: OPMLImportResponse;
    error?: string;
    progress?: {
        completed: number;
        total: number;
        successful: number;
        failed: number;
        already_existed: number;
    };
}

export default function ImportOPMLPage() {
    const [isUploading, setIsUploading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [importResult, setImportResult] = useState<OPMLImportResponse | null>(null)
    const [backgroundTask, setBackgroundTask] = useState<{taskId: string, estimatedFeeds: number} | null>(null)
    const [taskStatus, setTaskStatus] = useState<ImportStatus | null>(null)
    const [showDetails, setShowDetails] = useState(false)
    
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const queryClient = useQueryClient()

    // Poll for background task status
    useEffect(() => {
        if (!backgroundTask) return

        const pollStatus = async () => {
            try {
                const status = await ApiClient.get<ImportStatus>(`/rss/opml/import/status/${backgroundTask.taskId}`)
                setTaskStatus(status)

                if (status.status === 'completed') {
                    setImportResult(status.result!)
                    setBackgroundTask(null)
                    // Invalidate queries
                    await Promise.all([
                        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] }),
                        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FOLDERS] }),
                        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] }),
                        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.UNREAD_COUNTS] })
                    ])
                    toast.success(`Import completed! ${status.result?.imported_count || 0} feeds imported.`)
                } else if (status.status === 'failed') {
                    setBackgroundTask(null)
                    toast.error(`Import failed: ${status.error || 'Unknown error'}`)
                }
            } catch (error) {
                console.error('Error polling task status:', error)
            }
        }

        const interval = setInterval(pollStatus, 3000) // Poll every 3 seconds
        return () => clearInterval(interval)
    }, [backgroundTask, queryClient])

    const handleFileUpload = async (file: File) => {
        if (!file || (!file.name.endsWith('.opml') && !file.name.endsWith('.xml'))) {
            toast.error('Please select a valid OPML or XML file')
            return
        }

        const formData = new FormData()
        formData.append('opml_file', file)
        formData.append('default_folder_name', 'Imported Feeds')

        setIsUploading(true)
        setImportResult(null)
        setBackgroundTask(null)
        setTaskStatus(null)

        try {
            const data = await ApiClient.uploadFile('/rss/opml/import', formData) as OPMLImportResponse;

            // All imports are now background
            setBackgroundTask({
                taskId: data.task_id,
                estimatedFeeds: data.estimated_feeds || 0
            })
            toast.success(`Queued ${data.estimated_feeds} feeds for import processing in parallel.`)
            
        } catch (error) {
            console.error('Error uploading OPML file:', error)
            toast.error('Failed to import OPML file. Please try again.')
        } finally {
            setIsUploading(false)
        }
    }

    const renderImportResults = () => {
        if (!importResult) return null

        const { summary, errors } = importResult
        const totalProcessed = (summary?.successful || 0) + (summary?.failed || 0) + (summary?.already_existed || 0)

        return (
            <div className="mt-6 space-y-4">
                <div className="bg-white border rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <h3 className="text-lg font-medium">Import Complete</h3>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                            <div className="text-2xl font-semibold text-green-600">{summary?.successful || 0}</div>
                            <div className="text-sm text-muted-foreground">Imported</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-semibold text-blue-600">{summary?.already_existed || 0}</div>
                            <div className="text-sm text-muted-foreground">Already had</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-semibold text-red-600">{summary?.failed || 0}</div>
                            <div className="text-sm text-muted-foreground">Failed</div>
                        </div>
                    </div>

                    {errors && errors.length > 0 && (
                        <div className="border-t pt-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDetails(!showDetails)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                {showDetails ? 'Hide' : 'Show'} failed feeds ({errors.length})
                            </Button>
                            
                            {showDetails && (
                                <div className="mt-3 max-h-48 overflow-y-auto space-y-2">
                                    {errors.map((error, index) => (
                                        <div key={index} className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                                            <div className="font-medium text-red-900">{error.title || 'Unknown feed'}</div>
                                            <div className="text-red-700 text-xs mt-1 truncate">{error.url}</div>
                                            <div className="text-red-600 text-xs mt-1">{error.error}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    <Button onClick={() => window.location.href = '/articles'} className="flex-1">
                        View Articles
                    </Button>
                    <Button variant="outline" onClick={() => {
                        setImportResult(null)
                        setShowDetails(false)
                        setTaskStatus(null)
                    }}>
                        Import More
                    </Button>
                </div>
            </div>
        )
    }

    const renderBackgroundStatus = () => {
        if ((!backgroundTask && !taskStatus) || importResult) return null

        return (
            <div className="mt-6 bg-grey-50 border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Clock className="h-6 w-6 text-blue-600" />
                    <h3 className="text-lg font-medium">Processing Feeds</h3>
                </div>
                
                <div className="space-y-4">
                    {taskStatus?.progress ? (
                        <div>
                            <div className="flex justify-between text-sm text-muted-foreground mb-2">
                                <span>{taskStatus.progress.completed} of {taskStatus.progress.total} completed</span>
                                <span>{taskStatus.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                            </div>
                            <Progress 
                                value={(taskStatus.progress.completed / taskStatus.progress.total) * 100} 
                                className="h-2 mb-3" 
                            />
                            <div className="grid grid-cols-3 gap-4 text-center text-sm">
                                <div>
                                    <div className="font-medium text-green-600">{taskStatus.progress.successful}</div>
                                    <div className="text-xs text-muted-foreground">Imported</div>
                                </div>
                                <div>
                                    <div className="font-medium text-blue-600">{taskStatus.progress.already_existed}</div>
                                    <div className="text-xs text-muted-foreground">Already had</div>
                                </div>
                                <div>
                                    <div className="font-medium text-red-600">{taskStatus.progress.failed}</div>
                                    <div className="text-xs text-muted-foreground">Failed</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex justify-between text-sm text-muted-foreground mb-2">
                                <span>Processing {backgroundTask?.estimatedFeeds} feeds...</span>
                                <span className="capitalize">{taskStatus?.status || 'pending'}</span>
                            </div>
                            <Progress value={undefined} className="h-2" />
                        </div>
                    )}
                </div>
            </div>
        )
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
        <div className="flex h-[calc(100vh-1rem)] w-full bg-background rounded-xl shadow-sm">
            <div className="flex flex-col w-full p-6 items-center justify-center">
                <div className="max-w-xl w-full">
                    <h1 className="text-3xl font-semibold mb-2">OPML Import</h1>
                    <p className="text-muted-foreground mb-8">
                        Import feeds from an OPML file exported from another RSS reader.
                    </p>

                    {!importResult && !backgroundTask && (
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
                                        {isDragging ? 'Drop your OPML file here' : 'Upload OPML File'}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Drag and drop or click to select
                                    </p>
                                </div>

                                <Button
                                    onClick={handleButtonClick}
                                    disabled={isUploading}
                                    className="mt-4"
                                >
                                    {isUploading ? 'Uploading...' : 'Choose File'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {renderBackgroundStatus()}
                    {renderImportResults()}
                </div>
            </div>
        </div>
    )
} 