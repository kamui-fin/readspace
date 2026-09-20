import {
    Bookmark,
    Headphones,
    Mail,
    Newspaper,
    PenLine,
    Users,
    Video,
} from "lucide-react"
import { useMemo } from "react"
import { useRefinementList } from "react-instantsearch"

import {
    ContentType,
    CURATED_CONTENT_TYPES,
    CONTENT_TYPE_DISPLAY_NAMES,
} from "@readspace/shared"
import { cn } from "@/lib/utils"

const CONTENT_TYPE_ICONS: Partial<
    Record<ContentType, React.ComponentType<{ className?: string; size?: number }>>
> = {
    [ContentType.NEWSLETTER]: Mail,
    [ContentType.PODCAST_FEED]: Headphones,
    [ContentType.INDIE_BLOG]: PenLine,
    [ContentType.NEWS_OUTLET]: Newspaper,
    [ContentType.MAGAZINE_EDITORIAL]: Bookmark,
    [ContentType.VIDEO_CHANNEL]: Video,
    [ContentType.FORUM_COMMUNITY]: Users,
}

interface ContentTypeFilterProps {
    className?: string
}

export function ContentTypeFilter({ className }: ContentTypeFilterProps) {
    const { items, refine, canRefine } = useRefinementList({
        attribute: "content_type",
    })

    // Map items by value for quick lookup and preserve curated ordering
    const curatedItems = useMemo(() => {
        const itemMap = new Map(items.map((item) => [item.value, item]))

        return CURATED_CONTENT_TYPES.map((type) => {
            const item = itemMap.get(type)
            return {
                type,
                label: CONTENT_TYPE_DISPLAY_NAMES[type] || type,
                count: item?.count ?? 0,
                isRefined: item?.isRefined ?? false,
                existsInResults: Boolean(item),
            }
        }).filter((entry) => entry.existsInResults || entry.isRefined)
    }, [items])

    if (!canRefine || curatedItems.length === 0) {
        return null
    }

    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-2",
                className
            )}
            role="toolbar"
            aria-label="Filter by content type"
        >
            {curatedItems.map(({ type, label, isRefined }) => {
                const Icon = CONTENT_TYPE_ICONS[type]

                return (
                    <button
                        key={type}
                        type="button"
                        onClick={() => refine(type)}
                        aria-pressed={isRefined}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 cursor-pointer shrink-0",
                            isRefined
                                ? "border-[#6A994E] bg-[#F3F9EF] text-[#6A994E] shadow-xs dark:border-primary dark:bg-primary/10 dark:text-primary"
                                : "border-[#E4ECDF] bg-white text-[#6B7566] hover:border-[#ACC59D] hover:bg-[#F8FAF7] hover:text-[#6A994E] dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-primary"
                        )}
                    >
                        {Icon && <Icon size={13} className="shrink-0" />}
                        <span>{label}</span>
                    </button>
                )
            })}
        </div>
    )
}
