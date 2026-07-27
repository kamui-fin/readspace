import { cva, type VariantProps } from "class-variance-authority"
import { Flame, MoreHorizontal } from "lucide-react"
import * as React from "react"
import { CATEGORY_CONFIG } from "@/lib/categories"
import { FeedCategory } from "@readspace/shared"
import { cn } from "@/lib/utils"

const categoryBadgeVariants = cva(
    "inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-md active:scale-[0.98]",
    {
        variants: {
            variant: {
                default:
                    "border-[#E4ECDF] bg-white text-[#6B7566] hover:border-[#ACC59D] hover:bg-[#F8FAF7] hover:text-[#6A994E] dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-primary",
                selected:
                    "border-[#6A994E] bg-[#F3F9EF] text-[#6A994E] shadow-sm hover:border-[#5A8A3E] hover:bg-[#EBF5E4] dark:border-primary dark:bg-primary/10 dark:text-primary dark:hover:bg-primary/15",
                popular:
                    "border-amber-500/40 bg-amber-500/10 text-amber-600 hover:border-amber-500/60 hover:bg-amber-500/20 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-400 dark:hover:bg-amber-400/20 shadow-sm",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

const getCategoryIcon = (categoryName: string) => {
    const iconProps = { size: 16 }

    if (categoryName === "popular" || categoryName === "Popular") {
        return <Flame className="text-amber-500 dark:text-amber-400 fill-amber-500/20" {...iconProps} />
    }

    // Try to find by key (enum value)
    if (Object.values(FeedCategory).includes(categoryName as FeedCategory)) {
        const config = CATEGORY_CONFIG[categoryName as FeedCategory]
        if (config) return <config.icon {...iconProps} />
    }

    const config = CATEGORY_CONFIG[categoryName as FeedCategory]
    if (config) {
        const Icon = config.icon
        return <Icon {...iconProps} />
    }

    return <MoreHorizontal {...iconProps} />
}

export interface CategoryBadgeProps
    extends
        React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof categoryBadgeVariants> {
    category: string
    iconKey?: string
    selected?: boolean
}

function CategoryBadge({
    className,
    category,
    iconKey,
    selected = false,
    ...props
}: CategoryBadgeProps) {
    return (
        <div
            className={cn(
                categoryBadgeVariants({
                    variant: selected ? "selected" : "default",
                }),
                className
            )}
            {...props}
        >
            {getCategoryIcon(iconKey || category)}
            <span>{category}</span>
        </div>
    )
}

export { CategoryBadge, categoryBadgeVariants }
