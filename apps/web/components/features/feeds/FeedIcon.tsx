import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@readspace/shared"

interface FeedIconProps {
    feed: {
        title?: string | null
        image_url?: string | null
    }
    className?: string
}

export function FeedIcon({ feed, className }: FeedIconProps) {
    const getFeedInitials = () => {
        return feed.title ? feed.title.charAt(0).toUpperCase() : "F"
    }

    // Deterministic color based on title length or char code
    const getBgColor = () => {
        const colors = [
            "bg-red-500",
            "bg-orange-500",
            "bg-amber-500",
            "bg-yellow-500",
            "bg-lime-500",
            "bg-green-500",
            "bg-emerald-500",
            "bg-teal-500",
            "bg-cyan-500",
            "bg-sky-500",
            "bg-blue-500",
            "bg-indigo-500",
            "bg-violet-500",
            "bg-purple-500",
            "bg-fuchsia-500",
            "bg-pink-500",
            "bg-rose-500",
        ]
        if (!feed.title) return "bg-gray-500"
        const index = feed.title.charCodeAt(0) % colors.length
        return colors[index]
    }

    return (
        <Avatar className={cn("rounded", className)}>
            <AvatarImage
                src={feed.image_url || undefined}
                alt={feed.title || "Feed icon"}
                className="object-cover"
            />
            <AvatarFallback
                className={cn("text-white font-bold rounded", getBgColor())}
            >
                {getFeedInitials()}
            </AvatarFallback>
        </Avatar>
    )
}
