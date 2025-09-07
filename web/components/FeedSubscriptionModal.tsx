"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useFolders, useRefreshFeed, useSubscribeToFeed } from "@/lib/api/hooks/feeds"
import { AlertCircle, FolderPlus, Loader2, Rss } from "lucide-react"
import NextImage from "next/image"
import { useState } from "react"
import { toast } from "react-hot-toast"

interface FeedSubscriptionModalProps {
    feed: {
        id: string
        title: string
        url: string
        link?: string
        description?: string
        image_url?: string
    }
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
}

export function FeedSubscriptionModal({
    feed,
    isOpen,
    onClose,
    onSuccess,
}: FeedSubscriptionModalProps) {
    const [selectedFolderId, setSelectedFolderId] = useState<string>("")
    const [error, setError] = useState<string | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const { data: folders, isLoading: foldersLoading } = useFolders()
    const subscribeToFeed = useSubscribeToFeed()
    const refreshFeed = useRefreshFeed()

    const typedFolders = (folders as Array<{ id: string; name: string }>) || []

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!selectedFolderId) {
            setError("Please select a folder")
            return
        }

        try {
            // Create the subscription first
            await subscribeToFeed.mutateAsync({
                feedId: feed.id,
                folderId: selectedFolderId,
            })

            // Then refresh the feed to get latest articles
            setIsRefreshing(true)
            
            await refreshFeed.mutateAsync({
                feedId: feed.id,
                forceRefetch: true,
                silent: true,
            })

            setIsRefreshing(false)

            toast.success("Successfully subscribed to feed")
            onSuccess?.()
            onClose()
            setSelectedFolderId("")
            setError(null)

        } catch (error: any) {
            setIsRefreshing(false)

            let errorMessage = "Failed to subscribe to feed"
            if (error?.message) {
                errorMessage = error.message
            } else if (error?.detail) {
                errorMessage = error.detail
            } else if (typeof error === 'string') {
                errorMessage = error
            } else if (error?.response?.data?.detail) {
                errorMessage = error.response.data.detail
            } else if (error?.response?.data?.message) {
                errorMessage = error.response.data.message
            }
            setError(errorMessage)
        }
    }

    const handleClose = () => {
        if (!subscribeToFeed.isPending && !isRefreshing) {
            setSelectedFolderId("")
            setError(null)
            onClose()
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Rss className="h-5 w-5 text-orange-500" />
                        Subscribe to Feed
                    </DialogTitle>
                    <DialogDescription>
                        Add this RSS feed to your collection
                    </DialogDescription>
                </DialogHeader>

                {/* Feed Preview Card */}
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
                            {feed.image_url ? (
                                <NextImage
                                    src={feed.image_url}
                                    alt={feed.title || "Feed icon"}
                                    fill
                                    className="object-cover"
                                    sizes="40px"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement
                                        target.style.display = 'none'
                                        const fallback = target.nextElementSibling as HTMLElement
                                        if (fallback) fallback.style.display = 'flex'
                                    }}
                                />
                            ) : null}
                            <div
                                className={`absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-semibold text-sm ${feed.image_url ? 'hidden' : 'flex'
                                    }`}
                            >
                                {feed.title ? feed.title.charAt(0).toUpperCase() : 'F'}
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-medium text-sm leading-tight truncate">
                                    {feed.title || "Untitled Feed"}
                                </h3>
                            </div>
                            {feed.link && (
                                <a href={feed.link} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap truncate w-full">
                                    {feed.link.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 30) + (feed.link.length > 30 ? '...' : '')}
                                </a>
                            )}
                        </div>
                    </div>
                    {feed.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed break-words">
                            {feed.description}
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="folder-select" className="text-sm font-medium">
                            Choose Folder
                            <span className="text-destructive ml-1">*</span>
                        </Label>

                        {foldersLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                        ) : typedFolders.length === 0 ? (
                            <Alert>
                                <FolderPlus className="h-4 w-4" />
                                <AlertDescription>
                                    No folders available. Create a folder first to organize your feeds.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Select
                                value={selectedFolderId}
                                onValueChange={setSelectedFolderId}
                                required
                            >
                                <SelectTrigger id="folder-select">
                                    <SelectValue placeholder="Select a folder" />
                                </SelectTrigger>
                                <SelectContent>
                                    {typedFolders.map((folder) => (
                                        <SelectItem
                                            key={folder.id}
                                            value={folder.id}
                                            className="cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-primary/60" />
                                                {folder.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={subscribeToFeed.isPending || isRefreshing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={subscribeToFeed.isPending || isRefreshing || !selectedFolderId || typedFolders.length === 0}
                            className="min-w-[100px]"
                        >
                            {subscribeToFeed.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Subscribing...
                                </>
                            ) : isRefreshing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Fetching...
                                </>
                            ) : (
                                "Subscribe"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}