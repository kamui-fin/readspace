"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useFeeds, type Subscription, type Folder } from "@readspace/shared"
import { Loader2, Rss } from "lucide-react"
import { FolderSelect } from "./FolderSelect"
import { FeedIcon } from "./FeedIcon"
import { useFeedSubscription } from "./hooks/use-feed-subscription"
import { useMemo } from "react"

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
    const { data: feeds, isLoading: feedsLoading } = useFeeds({})

    const {
        selectedFolderId,
        setSelectedFolderId,
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

    const typedFolders = useMemo(() => {
        const folderMap = new Map<string, Folder>()
            ; ((feeds as unknown as Subscription[]) || []).forEach((sub) => {
                if (sub.folder) {
                    folderMap.set(sub.folder.id, sub.folder)
                }
            })
        return Array.from(folderMap.values())
    }, [feeds])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await handleSubscribe(feed.id, feed.url)
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
                        <FeedIcon
                            feed={feed}
                            className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-md"
                        />
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
                        }}
                        newFolderName={newFolderName}
                        onNewFolderNameChange={setNewFolderName}
                        isLoading={feedsLoading}
                    />

                    <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                if (isCreatingFolder) {
                                    setIsCreatingFolder(false)
                                    setNewFolderName("")
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
