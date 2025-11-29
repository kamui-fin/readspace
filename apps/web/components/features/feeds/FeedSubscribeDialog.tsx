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
    useCreateFeed,
    useCreateFolder,
    useFolders,
    type FeedSummary,
    type Subscription,
    RSS_QUERY_KEYS,
} from "@readspace/shared"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, FolderPlus, Loader2, Rss } from "lucide-react"
import NextImage from "next/image"
import { useState } from "react"
import { toast } from "react-hot-toast"

interface FeedSubscribeDialogProps {
    isOpen: boolean
    onClose: () => void
    feed: FeedSummary & { description?: string | null }
    isPreviewFeed?: boolean
    previewUrl?: string
}

export function FeedSubscribeDialog({
    isOpen,
    onClose,
    feed,
    isPreviewFeed = false,
    previewUrl,
}: FeedSubscribeDialogProps) {
    const [selectedFolderId, setSelectedFolderId] = useState<string>("")
    const [error, setError] = useState<string | null>(null)
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState("")

    const { data: folders, isLoading: foldersLoading } = useFolders()
    const queryClient = useQueryClient()
    const createFeed = useCreateFeed()
    const createFolder = useCreateFolder()

    const typedFolders = (folders as Array<{ id: string; name: string }>) || []

    const normalizeUrl = (url: string) => {
        return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
    }

    const handleClose = () => {
        if (!createFeed.isPending && !createFolder.isPending) {
            setSelectedFolderId("")
            setIsCreatingFolder(false)
            setNewFolderName("")
            setError(null)
            onClose()
        }
    }

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

            // Create the feed subscription
            const subscriptionUrl = isPreviewFeed ? previewUrl : feed.url
            await createFeed.mutateAsync({
                url: subscriptionUrl!,
                folder_id: folderId,
            })

            toast.success("Successfully subscribed to feed")
            handleClose()
        } catch (error: unknown) {
            let errorMessage = "Failed to subscribe to feed"
            if (typeof error === "string") {
                errorMessage = error
            } else if (error && typeof error === "object") {
                const err = error as Record<string, unknown>
                if (typeof err.message === "string") {
                    errorMessage = err.message
                } else if (typeof err.detail === "string") {
                    errorMessage = err.detail
                } else if (err.response && typeof err.response === "object") {
                    const response = err.response as Record<string, unknown>
                    if (response.data && typeof response.data === "object") {
                        const data = response.data as Record<string, unknown>
                        if (typeof data.detail === "string") {
                            errorMessage = data.detail
                        } else if (typeof data.message === "string") {
                            errorMessage = data.message
                        }
                    }
                }
            }
            setError(errorMessage)
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
                                className={`absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-semibold text-sm ${feed.image_url ? "hidden" : "flex"}`}
                            >
                                {feed.title
                                    ? feed.title.charAt(0).toUpperCase()
                                    : "F"}
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm leading-tight truncate">
                                {feed.title || "Untitled Feed"}
                            </h3>
                            <a
                                href={isPreviewFeed ? previewUrl : feed.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground truncate block"
                            >
                                {((isPreviewFeed ? previewUrl : feed.url) || "")
                                    .replace(/^https?:\/\//, "")
                                    .replace(/\/$/, "")
                                    .slice(0, 30) +
                                    ((
                                        (isPreviewFeed
                                            ? previewUrl
                                            : feed.url) || ""
                                    ).length > 30
                                        ? "..."
                                        : "")}
                            </a>
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

                    <DialogFooter>
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
                                createFeed.isPending || createFolder.isPending
                            }
                        >
                            {isCreatingFolder ? "Back" : "Cancel"}
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                createFeed.isPending ||
                                createFolder.isPending ||
                                (!isCreatingFolder && !selectedFolderId) ||
                                (isCreatingFolder && !newFolderName.trim()) ||
                                (typedFolders.length === 0 && !isCreatingFolder)
                            }
                            className="min-w-[100px]"
                        >
                            {createFolder.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : createFeed.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Subscribing...
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
