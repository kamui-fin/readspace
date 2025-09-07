import { FeedSubscriptionModal } from "@/components/FeedSubscriptionModal"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDeleteFeed, useFeeds } from "@/lib/api/hooks/feeds"
import { Trash2 } from "lucide-react"
import NextImage from "next/image"
import Link from "next/link"
import { useState } from "react"

interface FeedCardProps {
    feed: {
        id: string
        title: string | null
        description: string | null
        url: string
        link: string | null
        image_url: string | null
        tags?: string[]
        category?: string | null
        popularity_score?: number
        relevance?: number
        search_metadata?: Record<string, any>
        is_preview?: boolean
        preview_url?: string
    }
    showFollowButton?: boolean
    showSimilarButton?: boolean
    showPreviewButton?: boolean
}

export function FeedCard({
    feed,
    showFollowButton = true,
    showSimilarButton = true,
    showPreviewButton = true
}: FeedCardProps) {
    // Get the user's subscribed feeds to check if this feed is subscribed
    const { data: feedsData } = useFeeds({}, {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    // Check if this feed is in the user's subscription list
    const isFollowed = feedsData?.some(f => f.id === feed.id) ?? false
    console.log("isFollowed", isFollowed, feed)

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isUnsubscribeModalOpen, setIsUnsubscribeModalOpen] = useState(false)
    const [isProcessingUnsubscribe, setIsProcessingUnsubscribe] = useState(false)
    const deleteFeed = useDeleteFeed()

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

    const handleUnsubscribeConfirm = async () => {
        setIsProcessingUnsubscribe(true)

        try {
            await deleteFeed.mutateAsync({ feedId: feed.id })
            setIsUnsubscribeModalOpen(false)
        } catch (error) {
            // Error toast is handled by the mutation
        } finally {
            setIsProcessingUnsubscribe(false)
        }
    }

    const handleSubscriptionSuccess = () => {
        // No need to set local state - the subscription mutation should update the feeds query data
        // which will cause useIsSubscribed to return the updated value
    }


    return (
        <div className="p-4">
            <div className="flex gap-4">
                <div className="relative">
                    {feed.image_url && (
                        <NextImage
                            src={feed.image_url}
                            alt={feed.title || 'Feed icon'}
                            className="w-9 h-9 rounded object-cover"
                            width={36}
                            height={36}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                const fallback = target.nextElementSibling as HTMLElement
                                if (fallback) fallback.style.display = 'flex'
                            }}
                        />
                    )}
                    <div
                        className={`w-9 h-9 rounded flex items-center justify-center text-white font-bold text-sm ${feed.title?.toLowerCase().includes('techcrunch') ? 'bg-green-600' :
                            feed.title?.toLowerCase().includes('hacker news') ? 'bg-orange-500' :
                                'bg-gray-600'
                            }`}
                        style={{ display: feed.image_url ? 'none' : 'flex' }}
                    >
                        {feed.title?.toLowerCase().includes('techcrunch') ? 'TC' :
                            feed.title?.toLowerCase().includes('hacker news') ? 'Y' :
                                (feed.title ? feed.title.charAt(0).toUpperCase() : 'F')}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-semibold text-lg text-black leading-tight">
                                {feed.title || "Untitled Feed"}
                            </h3>
                            <a href={feed.link || feed.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#BDC6B7] mt-0.5">
                                {(feed.link || feed.url)?.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'No URL'}
                            </a>
                            {feed.description && (
                                <p className="text-xs text-[#91998C] mt-2 leading-relaxed">
                                    {truncateText(feed.description, 120)}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-4 flex-shrink-0">
                            {showSimilarButton && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[#91998C] hover:text-[#6A994E] text-xs px-2 py-1 h-auto font-normal"
                                    asChild
                                >
                                    <Link href={`/feeds/${feed.id}/similar`}>
                                        Similar Feeds
                                    </Link>
                                </Button>
                            )}
                            {showFollowButton && (
                                <Button
                                    variant={isFollowed ? "outline" : "secondary"}
                                    onClick={handleFollowClick}
                                    className={`h-8 text-xs ${isFollowed ? 'text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10' : ''}`}
                                >
                                    {isFollowed && <Trash2 className="mr-1 h-3 w-3" />}
                                    {isFollowed ? 'Unfollow' : 'Follow'}
                                </Button>
                            )}
                        </div>
                    </div>

                    {showPreviewButton && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary/80 text-xs px-0 py-1 h-auto font-normal mt-2"
                            asChild
                        >
                            <Link href={`/feeds/${feed.id}/articles?preview=true`}>
                                Preview
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            <FeedSubscriptionModal
                feed={feed}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSubscriptionSuccess}
            />

            {/* Unsubscribe Modal */}
            <Dialog
                open={isUnsubscribeModalOpen}
                onOpenChange={setIsUnsubscribeModalOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Unfollow Feed</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to unfollow "{feed.title || 'this feed'}"?
                            You will no longer receive new articles from this feed.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsUnsubscribeModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUnsubscribeConfirm}
                            disabled={isProcessingUnsubscribe}
                            variant="destructive"
                        >
                            {isProcessingUnsubscribe ? "Unfollowing..." : "Unfollow"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}