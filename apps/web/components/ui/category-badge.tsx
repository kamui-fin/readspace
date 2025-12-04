import { cva, type VariantProps } from "class-variance-authority"
import {
    Code2,
    Cpu,
    Gamepad2,
    GraduationCap,
    Heart,
    Microscope,
    MoreHorizontal,
    Newspaper,
    Paintbrush,
    Palette,
    Shield,
    TrendingUp,
} from "lucide-react"
import * as React from "react"

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
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

const getCategoryIcon = (categoryName: string) => {
    const iconProps = { size: 16 }

    switch (categoryName) {
        case "Technology & Programming":
            return <Code2 {...iconProps} />
        case "AI":
        case "Artificial Intelligence":
            return <Cpu {...iconProps} />
        case "Design & Creativity":
            return <Palette {...iconProps} />
        case "Business & Finance":
            return <TrendingUp {...iconProps} />
        case "News & Politics":
            return <Newspaper {...iconProps} />
        case "Gaming & Entertainment":
            return <Gamepad2 {...iconProps} />
        case "Science & Research":
            return <Microscope {...iconProps} />
        case "Lifestyle & Personal":
            return <Heart {...iconProps} />
        case "Culture & Arts":
            return <Paintbrush {...iconProps} />
        case "Security & Privacy":
            return <Shield {...iconProps} />
        case "Education & Learning":
            return <GraduationCap {...iconProps} />
        case "Miscellaneous":
            return <MoreHorizontal {...iconProps} />
        default:
            return <MoreHorizontal {...iconProps} />
    }
}

export interface CategoryBadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
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
