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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    useCreateFolder,
    useFolders,
    useRefreshFeed,
    useSubscribeToFeed,
} from "@readspace/shared"
import { AlertCircle, FolderPlus, Loader2, Rss } from "lucide-react"
import NextImage from "next/image"
import { useState } from "react"
import { toast } from "react-hot-toast"

interface FeedSubscriptionModalProps {
    feed: {
        id: string
        title: string | null
        url: string
        link?: string | null
        description?: string | null
        image_url?: string | null
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
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState("")

    const { data: folders, isLoading: foldersLoading } = useFolders()
    const subscribeToFeed = useSubscribeToFeed()
    const refreshFeed = useRefreshFeed()
    const createFolder = useCreateFolder()

    const typedFolders = (folders as Array<{ id: string; name: string }>) || []

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!isCreatingFolder && !selectedFolderId) {
            setError("Please select a folder")
            return
        }

        if (isCreatingFolder && !newFolderName.trim()) {
            setError("Please enter a folder name")
            return
        }

        try {
            let folderId = selectedFolderId

            // Create folder first if needed
            if (isCreatingFolder) {
                const newFolder = await createFolder.mutateAsync({
                    name: newFolderName.trim(),
                })
                folderId = newFolder.id
            }

            // Create the subscription
            await subscribeToFeed.mutateAsync({
                feedId: feed.id,
                folderId: folderId,
            })

            // Then refresh the feed to get latest articles
            setIsRefreshing(true)

            await refreshFeed.mutateAsync({
                feedId: feed.id,
                forceRefetch: true,
            })

            setIsRefreshing(false)

            toast.success("Successfully subscribed to feed")
            onSuccess?.()
            onClose()
            setSelectedFolderId("")
            setIsCreatingFolder(false)
            setNewFolderName("")
            setError(null)
        } catch (error: unknown) {
            setIsRefreshing(false)

            let errorMessage = "Failed to subscribe to feed"
            if (typeof error === "string") {
                errorMessage = error
            } else if (error instanceof Error) {
                errorMessage = error.message
            } else if (error && typeof error === "object") {
                if (
                    "message" in error &&
                    typeof (error as { message: unknown }).message === "string"
                ) {
                    errorMessage = (error as { message: string }).message
                } else if (
                    "detail" in error &&
                    typeof (error as { detail: unknown }).detail === "string"
                ) {
                    errorMessage = (error as { detail: string }).detail
                }
            }
            setError(errorMessage)
        }
    }

    const handleClose = () => {
        if (
            !subscribeToFeed.isPending &&
            !isRefreshing &&
            !createFolder.isPending
        ) {
            setSelectedFolderId("")
            setIsCreatingFolder(false)
            setNewFolderName("")
            setError(null)
            onClose()
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-[95vw] sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Rss className="h-5 w-5 text-orange-500" />
                        Subscribe to Feed
                    </DialogTitle>
                    <DialogDescription className="text-left">
                        Add this RSS feed to your collection
                    </DialogDescription>
                </DialogHeader>

                {/* Feed Preview Card */}
                <div className="rounded-lg border bg-muted/50 p-3 sm:p-4 space-y-2 sm:space-y-3">
                    <div className="flex items-start gap-2 sm:gap-3">
                        <div className="relative h-8 w-8 sm:h-10 sm:w-10 shrink-0 overflow-hidden rounded-md">
                            {feed.image_url ? (
                                <NextImage
                                    src={feed.image_url}
                                    alt={feed.title || "Feed icon"}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 640px) 32px, 40px"
                                    onError={(e) => {
                                        const target =
                                            e.target as HTMLImageElement
                                        target.style.display = "none"
                                        const fallback =
                                            target.nextElementSibling as HTMLElement
                                        if (fallback)
                                            fallback.style.display = "flex"
                                    }}
                                />
                            ) : null}
                            <div
                                className={`absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-semibold text-xs sm:text-sm ${
                                    feed.image_url ? "hidden" : "flex"
                                }`}
                            >
                                {feed.title
                                    ? feed.title.charAt(0).toUpperCase()
                                    : "F"}
                            </div>
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-center gap-2">
                                <h3
                                    className="font-medium text-sm leading-tight break-words hyphens-auto"
                                    style={{
                                        wordBreak: "break-word",
                                        overflowWrap: "break-word",
                                        hyphens: "auto",
                                    }}
                                >
                                    {feed.title ||
                                        (feed.link
                                            ? new URL(feed.link).pathname ||
                                              "/rss"
                                            : "Untitled Feed")}
                                </h3>
                            </div>
                            {feed.link && (
                                <a
                                    href={feed.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors block break-all leading-tight"
                                    style={{
                                        wordBreak: "break-all",
                                        overflowWrap: "break-word",
                                        lineBreak: "anywhere",
                                    }}
                                >
                                    {feed.link
                                        .replace(/^https?:\/\//, "")
                                        .replace(/\/$/, "")}
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
                        <Label
                            htmlFor="folder-select"
                            className="text-sm font-medium"
                        >
                            Choose Folder
                            <span className="text-destructive ml-1">*</span>
                        </Label>

                        {foldersLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                        ) : isCreatingFolder ? (
                            <div className="space-y-2">
                                <Input
                                    id="folder-name-input"
                                    placeholder="Enter folder name..."
                                    value={newFolderName}
                                    onChange={(e) =>
                                        setNewFolderName(e.target.value)
                                    }
                                    required
                                    autoFocus
                                />
                                <p className="text-xs text-muted-foreground">
                                    Creating a new folder: &quot;
                                    {newFolderName || "..."}&quot;
                                </p>
                            </div>
                        ) : (
                            <Select
                                value={selectedFolderId}
                                onValueChange={(value) => {
                                    if (value === "CREATE_NEW") {
                                        setSelectedFolderId("")
                                        setIsCreatingFolder(true)
                                        setNewFolderName("")
                                    } else {
                                        setSelectedFolderId(value)
                                    }
                                }}
                                required
                            >
                                <SelectTrigger id="folder-select">
                                    <SelectValue placeholder="Select a folder" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        value="CREATE_NEW"
                                        className="cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <FolderPlus className="h-4 w-4 text-primary" />
                                            <span className="font-medium">
                                                Create New Folder
                                            </span>
                                        </div>
                                    </SelectItem>
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

                    <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                if (isCreatingFolder) {
                                    setIsCreatingFolder(false)
                                    setNewFolderName("")
                                    setError(null)
                                } else {
                                    handleClose()
                                }
                            }}
                            disabled={
                                subscribeToFeed.isPending ||
                                isRefreshing ||
                                createFolder.isPending
                            }
                            className="w-full sm:w-auto"
                        >
                            {isCreatingFolder ? "Back" : "Cancel"}
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                subscribeToFeed.isPending ||
                                isRefreshing ||
                                createFolder.isPending ||
                                (!isCreatingFolder && !selectedFolderId) ||
                                (isCreatingFolder && !newFolderName.trim()) ||
                                (typedFolders.length === 0 && !isCreatingFolder)
                            }
                            className="min-w-[100px] w-full sm:w-auto"
                        >
                            {createFolder.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    <span className="hidden xs:inline">
                                        Creating...
                                    </span>
                                    <span className="xs:hidden">Creating</span>
                                </>
                            ) : subscribeToFeed.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    <span className="hidden xs:inline">
                                        Subscribing...
                                    </span>
                                    <span className="xs:hidden">
                                        Subscribing
                                    </span>
                                </>
                            ) : isRefreshing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    <span className="hidden xs:inline">
                                        Fetching...
                                    </span>
                                    <span className="xs:hidden">Fetching</span>
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
