import { CategoryBadge } from "@/components/ui/category-badge"
import { useIsMobile } from "@/hooks/use-mobile"

import { FEED_CATEGORIES, MOBILE_CATEGORY_NAMES } from "@readspace/shared"

interface CategoryGridProps {
    onCategoryClick: (category: string) => void
}

/**
 * Grid of category badges for feed discovery
 */
export function CategoryGrid({ onCategoryClick }: CategoryGridProps) {
    const isMobile = useIsMobile()

    const getCategoryName = (category: string) => {
        return isMobile ? MOBILE_CATEGORY_NAMES[category] || category : category
    }

    return (
        <div className="flex flex-wrap gap-2.5 md:gap-3 justify-center mx-auto">
            {FEED_CATEGORIES.map((category) => (
                <CategoryBadge
                    key={category}
                    category={getCategoryName(category)}
                    iconKey={category}
                    onClick={() => onCategoryClick(category)}
                    className={isMobile ? "text-xs px-4 py-2" : ""}
                />
            ))}
        </div>
    )
}
