import { BookOpen, Check } from 'lucide-react'

interface ReadArticleCardProps {
    readAt: string | Date
}

export function ReadArticleCard({ readAt }: ReadArticleCardProps) {
    const readDate = new Date(readAt)
    const formattedDate = readDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
    const formattedTime = readDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    })

    return (
        <div className="bg-accent/50 dark:bg-accent border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
                {/* Icon with checkmark indicator */}
                <div className="bg-secondary/10 border border-secondary/30 rounded-full p-2 flex-shrink-0 relative">
                    <BookOpen className="w-4 h-4 text-secondary" />
                    <div className="absolute -top-0.5 -right-0.5 bg-secondary rounded-full p-0.5">
                        <Check className="w-2 h-2 text-secondary-foreground" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="font-semibold text-sm text-secondary">
                        Article read
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        Read on {formattedDate} at {formattedTime}
                    </p>
                </div>
            </div>
        </div>
    )
}
