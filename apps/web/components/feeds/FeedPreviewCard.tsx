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
    useDeleteFeed,
    useFeeds,
    useFolders,
    type Feed,
} from "@readspace/shared"
import { AlertCircle, FolderPlus, Loader2, Rss, Trash2 } from "lucide-react"
import NextImage from "next/image"
import { useState } from "react"
import { toast } from "react-hot-toast"

interface FeedPreviewCardProps {
    feed: Feed & {
        is_preview: true
        preview_url: string
    }
}

export function FeedPreviewCard({ feed }: FeedPreviewCardProps) {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedFolderId, setSelectedFolderId] = useState<string>("")
    const [error, setError] = useState<string | null>(null)
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState("")
    const [isUnsubscribeModalOpen, setIsUnsubscribeModalOpen] = useState(false)
    const [isProcessingUnsubscribe, setIsProcessingUnsubscribe] =
        useState(false)

    // Get the user's subscribed feeds to check if this feed is subscribed
    const { data: feedsData } = useFeeds(
        {},
        {
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
        }
    )

    console.log("feedsData", feedsData?.[0]?.url, feed.url)

    // Normalize URL function to handle www/non-www variations
    const normalizeUrl = (url: string) => {
        return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
    }

    // Check if this feed is in the user's subscription list
    // Compare by normalized RSS URL to handle www/non-www variations
    const isFollowed =
        feedsData?.some(
            (f) => normalizeUrl(f.url) === normalizeUrl(feed.url)
        ) ?? false
    console.log("isFollowed", isFollowed)

    const { data: folders, isLoading: foldersLoading } = useFolders()
    const createFeed = useCreateFeed()
    const createFolder = useCreateFolder()
    const deleteFeed = useDeleteFeed()

    const typedFolders = (folders as Array<{ id: string; name: string }>) || []

    const truncateText = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text
        return text.substring(0, maxLength) + "..."
    }

    const handleFollowClick = () => {
        if (isFollowed) {
            setIsUnsubscribeModalOpen(true)
        } else {
            setIsModalOpen(true)
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

            // Create the feed subscription using the preview URL
            await createFeed.mutateAsync({
                url: feed.preview_url,
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

    const handleUnsubscribeConfirm = async () => {
        setIsProcessingUnsubscribe(true)

        try {
            // Find the subscribed feed by normalized RSS URL to get its ID
            const subscribedFeed = feedsData?.find(
                (f) => normalizeUrl(f.url) === normalizeUrl(feed.url)
            )
            if (subscribedFeed) {
                await deleteFeed.mutateAsync({ feedId: subscribedFeed.id })
                setIsUnsubscribeModalOpen(false)
            }
        } catch {
            // Error toast is handled by the mutation
        } finally {
            setIsProcessingUnsubscribe(false)
        }
    }

    const handleClose = () => {
        if (!createFeed.isPending && !createFolder.isPending) {
            setSelectedFolderId("")
            setIsCreatingFolder(false)
            setNewFolderName("")
            setError(null)
            setIsModalOpen(false)
        }
    }

    return (
        <div className="p-4 border-2 border-dashed border-[#6A994E] bg-[#F3F9EF] rounded-lg">
            <div className="flex gap-4">
                <div className="relative">
                    {feed.image_url && (
                        <NextImage
                            src={feed.image_url}
                            alt={feed.title || "Feed icon"}
                            className="w-9 h-9 rounded object-cover"
                            width={36}
                            height={36}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = "none"
                                const fallback =
                                    target.nextElementSibling as HTMLElement
                                if (fallback) fallback.style.display = "flex"
                            }}
                        />
                    )}
                    <div
                        className={`w-9 h-9 rounded flex items-center justify-center text-white font-bold text-sm ${
                            feed.title?.toLowerCase().includes("techcrunch")
                                ? "bg-green-600"
                                : feed.title
                                        ?.toLowerCase()
                                        .includes("hacker news")
                                  ? "bg-orange-500"
                                  : "bg-gray-600"
                        }`}
                        style={{ display: feed.image_url ? "none" : "flex" }}
                    >
                        {feed.title?.toLowerCase().includes("techcrunch")
                            ? "TC"
                            : feed.title?.toLowerCase().includes("hacker news")
                              ? "Y"
                              : feed.title
                                ? feed.title.charAt(0).toUpperCase()
                                : "F"}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-semibold text-lg text-black leading-tight">
                                {feed.title || "Untitled Feed"}
                            </h3>
                            <a
                                href={feed.link || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#BDC6B7] mt-0.5"
                            >
                                {feed.link
                                    ?.replace(/^https?:\/\//, "")
                                    .replace(/\/$/, "") || "No URL"}
                            </a>
                            {feed.description && (
                                <p className="text-xs text-[#91998C] mt-2 leading-relaxed">
                                    {truncateText(feed.description, 120)}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-4 flex-shrink-0">
                            <Button
                                variant={isFollowed ? "outline" : "default"}
                                onClick={handleFollowClick}
                                className={`h-8 text-xs ${
                                    isFollowed
                                        ? "text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10"
                                        : "bg-[#6A994E] hover:bg-[#6A994E]/90 text-white"
                                }`}
                            >
                                {isFollowed && (
                                    <Trash2 className="mr-1 h-3 w-3" />
                                )}
                                {isFollowed ? "Unfollow" : "Follow"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <Dialog open={isModalOpen} onOpenChange={handleClose}>
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
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-medium text-sm leading-tight truncate">
                                        {feed.title || "Untitled Feed"}
                                    </h3>
                                </div>
                                <a
                                    href={feed.preview_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap truncate w-full"
                                >
                                    {feed.preview_url
                                        .replace(/^https?:\/\//, "")
                                        .replace(/\/$/, "")
                                        .slice(0, 30) +
                                        (feed.preview_url.length > 30
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
                                    createFeed.isPending ||
                                    createFolder.isPending
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
                                    (isCreatingFolder &&
                                        !newFolderName.trim()) ||
                                    (typedFolders.length === 0 &&
                                        !isCreatingFolder)
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

            {/* Unsubscribe Modal */}
            <Dialog
                open={isUnsubscribeModalOpen}
                onOpenChange={setIsUnsubscribeModalOpen}
            >
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-destructive" />
                            Unfollow Feed
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to unfollow &quot;
                            {feed.title || "this feed"}&quot;? You will no
                            longer receive new articles from this feed.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsUnsubscribeModalOpen(false)}
                            disabled={isProcessingUnsubscribe}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUnsubscribeConfirm}
                            disabled={isProcessingUnsubscribe}
                            variant="destructive"
                        >
                            {isProcessingUnsubscribe ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Unfollowing...
                                </>
                            ) : (
                                "Unfollow"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
