import { Badge } from '@/components/ui/badge'
import { DiscoveredFeed } from '@readspace/shared'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { getFeedDisplayName } from '@/lib/feed-utils'

interface FeedSelectionListProps {
    feeds: DiscoveredFeed[]
    selectedFeedIndex: number
    onSelectFeed: (index: number) => void
}

export function FeedSelectionList({
    feeds,
    selectedFeedIndex,
    onSelectFeed,
}: FeedSelectionListProps) {
    const [showAdvanced, setShowAdvanced] = useState(false)

    if (feeds.length <= 1) return null

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full"
            >
                {showAdvanced ? (
                    <ChevronUp className="w-4 h-4" />
                ) : (
                    <ChevronDown className="w-4 h-4" />
                )}
                <span>Advanced: Choose specific feed ({feeds.length} available)</span>
            </button>

            {showAdvanced && (
                <div className="space-y-1 pl-6">
                    {feeds.map((feed, index) => (
                        <label
                            key={index}
                            className="flex items-start gap-2 p-2 rounded border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                            <input
                                type="radio"
                                name="feed"
                                value={index}
                                checked={selectedFeedIndex === index}
                                onChange={() => onSelectFeed(index)}
                                className="w-4 h-4 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium truncate">
                                        {getFeedDisplayName(feed)}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                        {feed.type}
                                    </Badge>
                                </div>
                                {feed.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                        {feed.description}
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground/70 line-clamp-1 mt-0.5 font-mono">
                                    {feed.url}
                                </p>
                            </div>
                        </label>
                    ))}
                </div>
            )}
        </div>
    )
}
