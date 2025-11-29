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
import { useFolders } from "@readspace/shared"
import { AlertCircle, Loader2, Rss } from "lucide-react"
import NextImage from "next/image"
import { FolderSelect } from "./FolderSelect"
import { useFeedSubscription } from "./hooks/useFeedSubscription"

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
    const { data: folders, isLoading: foldersLoading } = useFolders()

    const {
        selectedFolderId,
        setSelectedFolderId,
        error,
        setError,
        isCreatingFolder,
        setIsCreatingFolder,
        newFolderName,
        setNewFolderName,
        handleSubscribe,
        resetState,
        isSubmitting,
    } = useFeedSubscription({
        onSuccess,
        onClose,
    })

    const typedFolders = (folders as Array<{ id: string; name: string }>) || []

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await handleSubscribe(feed.id)
    }

    const handleClose = () => {
        if (!isSubmitting) {
            resetState()
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
                    <FolderSelect
                        folders={typedFolders}
                        selectedFolderId={selectedFolderId}
                        onFolderSelect={setSelectedFolderId}
                        isCreatingFolder={isCreatingFolder}
                        onCreateNew={() => {
                            setSelectedFolderId("")
                            setIsCreatingFolder(true)
                            setNewFolderName("")
                        }}
                        onCancelCreate={() => {
                            setIsCreatingFolder(false)
                            setNewFolderName("")
                            setError(null)
                        }}
                        newFolderName={newFolderName}
                        onNewFolderNameChange={setNewFolderName}
                        isLoading={foldersLoading}
                    />

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
                            disabled={isSubmitting}
                            className="w-full sm:w-auto"
                        >
                            {isCreatingFolder ? "Back" : "Cancel"}
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                isSubmitting ||
                                (!isCreatingFolder && !selectedFolderId) ||
                                (isCreatingFolder && !newFolderName.trim()) ||
                                (typedFolders.length === 0 && !isCreatingFolder)
                            }
                            className="min-w-[100px] w-full sm:w-auto"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    <span className="hidden xs:inline">
                                        Processing...
                                    </span>
                                    <span className="xs:hidden">
                                        Processing
                                    </span>
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
