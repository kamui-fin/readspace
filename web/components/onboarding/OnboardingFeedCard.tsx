import { Button } from "@/components/ui/button"
import { useSubscribeToFeed, useRefreshFeed } from "@/lib/api/hooks/feeds"
import { CheckCircle, Plus } from "lucide-react"
import NextImage from "next/image"
import { useState } from "react"

interface OnboardingFeedCardProps {
    feed: {
        id: string
        title: string | null
        description: string | null
        url: string
        link: string | null
        image_url: string | null
        category?: string | null
        popularity_score?: number
    }
    onSubscribed?: (feedId: string) => void
}

export function OnboardingFeedCard({ feed, onSubscribed }: OnboardingFeedCardProps) {
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const subscribeToFeed = useSubscribeToFeed()
    const refreshFeed = useRefreshFeed()

    const truncateText = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text
        return text.substring(0, maxLength) + "..."
    }

    const handleSubscribe = async () => {
        if (isSubscribed) return

        try {
            // Subscribe to feed with default folder (backend will handle creating default folder)
            await subscribeToFeed.mutateAsync({ 
                feedId: feed.id, 
                folderId: 'default' // Backend will handle this
            })
            setIsSubscribed(true)
            onSubscribed?.(feed.id)

            // Trigger manual refresh to get latest articles, similar to FeedSubscriptionModal
            setIsRefreshing(true)
            try {
                await refreshFeed.mutateAsync({
                    feedId: feed.id,
                    forceRefetch: true,
                    silent: true,
                })
            } catch (refreshError) {
                console.error('Failed to refresh feed after subscription:', refreshError)
                // Don't show error to user for refresh failures during onboarding
            } finally {
                setIsRefreshing(false)
            }
        } catch (error) {
            // Error handling is done by the mutation hook
            console.error('Failed to subscribe:', error)
        }
    }

    const getFeedIcon = () => {
        if (feed.title?.toLowerCase().includes('techcrunch')) {
            return (
                <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center text-white font-bold text-xs">
                    TC
                </div>
            )
        }
        if (feed.title?.toLowerCase().includes('hacker news')) {
            return (
                <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center text-white font-bold text-xs">
                    Y
                </div>
            )
        }
        return (
            <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center text-white font-bold text-xs">
                {feed.title ? feed.title.charAt(0).toUpperCase() : 'F'}
            </div>
        )
    }

    return (
        <div className="p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-all">
            <div className="flex gap-3">
                <div className="relative flex-shrink-0">
                    {feed.image_url ? (
                        <NextImage
                            src={feed.image_url}
                            alt={feed.title || 'Feed icon'}
                            className="w-8 h-8 rounded object-cover"
                            width={32}
                            height={32}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                const fallback = target.nextElementSibling as HTMLElement
                                if (fallback) fallback.style.display = 'flex'
                            }}
                        />
                    ) : null}
                    <div
                        className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs ${
                            feed.title?.toLowerCase().includes('techcrunch') ? 'bg-green-600' :
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
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-sm text-black leading-tight mb-1">
                                {feed.title || "Untitled Feed"}
                            </h3>
                            <a 
                                href={feed.link || feed.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-xs text-[#BDC6B7] hover:text-[#91998C] transition-colors"
                            >
                                {(feed.link || feed.url)?.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'No URL'}
                            </a>
                            {feed.description && (
                                <p className="text-xs text-[#91998C] mt-1 leading-relaxed line-clamp-2">
                                    {truncateText(feed.description, 80)}
                                </p>
                            )}
                        </div>

                        <Button
                            variant={isSubscribed ? "outline" : "secondary"}
                            size="sm"
                            onClick={handleSubscribe}
                            disabled={subscribeToFeed.isPending || isSubscribed || isRefreshing}
                            className={`h-7 text-xs px-3 flex items-center gap-1 flex-shrink-0 ${
                                isSubscribed 
                                    ? 'text-primary border-primary/20 bg-primary/5 cursor-default' 
                                    : ''
                            }`}
                        >
                            {subscribeToFeed.isPending || isRefreshing ? (
                                <div className="w-3 h-3 border border-muted-foreground/30 border-t-transparent rounded-full animate-spin" />
                            ) : isSubscribed ? (
                                <>
                                    <CheckCircle className="w-3 h-3" />
                                    Following
                                </>
                            ) : (
                                <>
                                    <Plus className="w-3 h-3" />
                                    Follow
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}