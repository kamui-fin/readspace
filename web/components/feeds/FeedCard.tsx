import { useState } from "react"
import NextImage from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FeedSubscriptionModal } from "@/components/FeedSubscriptionModal"

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
    const [isFollowed, setIsFollowed] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const truncateText = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text
        return text.substring(0, maxLength) + "..."
    }

    const handleFollowClick = () => {
        if (isFollowed) {
            // TODO: Implement unfollow functionality
            setIsFollowed(false)
        } else {
            setIsModalOpen(true)
        }
    }

    const handleSubscriptionSuccess = () => {
        setIsFollowed(true)
    }

    const getFeedIcon = () => {
        if (feed.title?.toLowerCase().includes('techcrunch')) {
            return (
                <div className="w-9 h-9 bg-green-600 rounded flex items-center justify-center text-white font-bold text-sm">
                    TC
                </div>
            )
        }
        if (feed.title?.toLowerCase().includes('hacker news')) {
            return (
                <div className="w-9 h-9 bg-orange-500 rounded flex items-center justify-center text-white font-bold text-sm">
                    Y
                </div>
            )
        }
        return (
            <div className="w-9 h-9 bg-gray-600 rounded flex items-center justify-center text-white font-bold text-sm">
                {feed.title ? feed.title.charAt(0).toUpperCase() : 'F'}
            </div>
        )
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
                        className={`w-9 h-9 rounded flex items-center justify-center text-white font-bold text-sm ${
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
                                    className="text-[#91998C] hover:text-[#6A994E] text-xs px-0 h-auto font-normal"
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
                                    className="h-8 text-xs"
                                >
                                    {isFollowed ? 'Followed' : 'Follow'}
                                </Button>
                            )}
                        </div>
                    </div>

                    {showPreviewButton && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary/80 text-xs p-0 h-auto font-normal mt-2"
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
        </div>
    )
}