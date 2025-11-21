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
    cn,
    useCreateFeed,
    useCreateFolder,
    useDeleteFeed,
    useFeeds,
    useFolders,
    type Feed,
    RSS_QUERY_KEYS,
} from "@readspace/shared"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, FolderPlus, Loader2, Rss, Trash2 } from "lucide-react"
import NextImage from "next/image"
import { ReactNode, useState } from "react"
import { toast } from "react-hot-toast"

interface BaseFeedCardProps {
    /** The feed to display */
    feed: Feed | (Feed & { is_preview: true; preview_url: string })
    /** Variant for styling */
    variant?: "default" | "preview"
    /** Additional className */
    className?: string
    /** Custom actions to show in the header (e.g., dropdown menu) */
    headerActions?: ReactNode
    /** Whether to show follow/unfollow button */
    showFollowButton?: boolean
}

/**
 * Base feed card component with shared logic for displaying and managing feeds.
 *
 * This component handles:
 * - Feed display (image, title, description, link)
 * - Follow/unfollow state management with URL normalization
 * - Subscription modal handling
 * - Unsubscribe modal handling
 *
 * Used by both FeedCard (default variant) and FeedPreviewCard (preview variant).
 */
export function BaseFeedCard({
    feed,
    variant = "default",
    className,
    headerActions,
    showFollowButton = true,
}: BaseFeedCardProps) {
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
            refetchOnReconnect: false,
            staleTime: 10 * 60 * 1000, // 10 minutes
            gcTime: 15 * 60 * 1000, // 15 minutes
            refetchInterval: false,
        }
    )

    // Normalize URL function to handle www/non-www variations
    const normalizeUrl = (url: string) => {
        return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
    }

    // Check if this feed is in the user's subscription list
    const isPreviewFeed = "is_preview" in feed && feed.is_preview === true
    const feedUrl = isPreviewFeed ? feed.url : feed.url

    // For preview feeds, compare by normalized RSS URL
    // For regular feeds, compare by ID first, then fall back to URL comparison
    const isFollowed =
        feedsData?.some((f) => {
            if (!isPreviewFeed) {
                // Regular feed: check by ID
                return f.id === feed.id
            }
            // Preview feed: check by normalized URL
            return normalizeUrl(f.url) === normalizeUrl(feedUrl)
        }) ?? false

    const { data: folders, isLoading: foldersLoading } = useFolders()
    const queryClient = useQueryClient()
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

            // Create the feed subscription
            // For preview feeds, use the preview_url; for regular feeds, use the url
            const subscriptionUrl = isPreviewFeed
                ? (feed as any).preview_url
                : feed.url
            await createFeed.mutateAsync({
                url: subscriptionUrl!,
                folder_id: folderId,
            })

            // Optimistically update the feeds query data to reflect the new subscription
            queryClient.setQueryData(
                [RSS_QUERY_KEYS.FEEDS],
                (old: Feed[] | undefined) => {
                    if (!old) return old
                    // Add the current feed to the subscribed feeds list if it's not already there
                    const feedExists = old.some(
                        (f) => normalizeUrl(f.url) === normalizeUrl(feedUrl)
                    )
                    if (!feedExists) {
                        // Create a proper Feed object from the feed
                        const newFeed = {
                            ...feed,
                            url: subscriptionUrl,
                            folder_id: folderId,
                            unread_count: 0,
                            is_favorite: false,
                        } as Feed
                        return [...old, newFeed]
                    }
                    return old
                }
            )

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
            // Find the subscribed feed to get its ID
            const subscribedFeed = feedsData?.find((f) => {
                if (!isPreviewFeed) {
                    return f.id === feed.id
                }
                return normalizeUrl(f.url) === normalizeUrl(feedUrl)
            })
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

    const isPreview = variant === "preview"

    return (
        <div
            className={cn(
                "w-full",
                isPreview &&
                    "p-4 border-2 border-dashed border-primary bg-primary/5 dark:bg-primary/10 rounded-lg",
                className
            )}
        >
            <div className="flex gap-3 md:gap-4 w-full min-w-0">
                {/* Feed Icon */}
                <div className="relative flex-shrink-0">
                    {feed.image_url && (
                        <NextImage
                            src={feed.image_url}
                            alt={feed.title || "Feed icon"}
                            className="w-8 h-8 md:w-9 md:h-9 rounded object-cover"
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
                        className={`w-8 h-8 md:w-9 md:h-9 rounded flex items-center justify-center text-white font-bold text-xs md:text-sm ${
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

                {/* Feed Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg text-black dark:text-foreground leading-tight tracking-tight">
                                {feed.title || "Untitled Feed"}
                            </h3>
                            <a
                                href={feed.link || feed.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#BDC6B7] dark:text-secondary truncate block mt-0.5"
                            >
                                {(feed.link || feed.url)
                                    ?.replace(/^https?:\/\//, "")
                                    ?.replace(/^www\./, "")
                                    .replace(/\/$/, "") || "No URL"}
                            </a>
                        </div>

                        {/* Header Actions (Follow button + custom actions) */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {showFollowButton && (
                                <Button
                                    variant={
                                        isFollowed
                                            ? "outline"
                                            : isPreview
                                              ? "default"
                                              : "secondary"
                                    }
                                    onClick={handleFollowClick}
                                    className={cn(
                                        "h-8 text-xs",
                                        isFollowed
                                            ? "text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10"
                                            : isPreview &&
                                                  "bg-primary hover:bg-primary/90 text-primary-foreground"
                                    )}
                                >
                                    {isFollowed && (
                                        <Trash2 className="mr-1 h-3 w-3" />
                                    )}
                                    {isFollowed ? "Unfollow" : "Follow"}
                                </Button>
                            )}
                            {headerActions}
                        </div>
                    </div>

                    {/* Description */}
                    {feed.description && (
                        <p
                            className={cn(
                                "text-xs mt-2 leading-relaxed break-words",
                                isPreview
                                    ? "text-muted-foreground"
                                    : "text-[#91998C]"
                            )}
                            style={{
                                wordWrap: "break-word",
                                overflowWrap: "anywhere",
                                display: "-webkit-box",
                                WebkitLineClamp: isPreview ? 2 : 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                            }}
                        >
                            {isPreview && feed.description.length > 120
                                ? truncateText(feed.description, 120)
                                : feed.description}
                        </p>
                    )}
                </div>
            </div>

            {/* Subscription Modal */}
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
                            <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-sm leading-tight truncate">
                                    {feed.title || "Untitled Feed"}
                                </h3>
                                <a
                                    href={
                                        isPreviewFeed
                                            ? (feed as any).preview_url
                                            : feed.url
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground truncate block"
                                >
                                    {(
                                        (isPreviewFeed
                                            ? (feed as any).preview_url
                                            : feed.url) || ""
                                    )
                                        .replace(/^https?:\/\//, "")
                                        .replace(/\/$/, "")
                                        .slice(0, 30) +
                                        ((
                                            (isPreviewFeed
                                                ? (feed as any).preview_url
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
