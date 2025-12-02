import { Button } from '@/components/ui/button'
import { BookOpen, Trash2 } from 'lucide-react'

interface ArticleHeaderProps {
    isSaved: boolean
    hasUnsavedChanges: boolean
    readingTime?: number
    onSave: () => void
    isPending: boolean
    isUnsavePending: boolean
    isUpdatePending: boolean
    isSavePending: boolean
    isPreparingToSave: boolean
}

export function ArticleHeader({
    isSaved,
    hasUnsavedChanges,
    readingTime,
    onSave,
    isPending,
    isUnsavePending,
    isUpdatePending,
    isSavePending,
    isPreparingToSave,
}: ArticleHeaderProps) {
    return (
        <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="bg-primary rounded-full p-2 flex-shrink-0">
                <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="font-semibold text-sm">
                    {isSaved ? 'Saved article' : 'Save article for later'}
                </h3>
                {readingTime && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {readingTime} min read
                    </p>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                    onClick={onSave}
                    disabled={isPending}
                    size="sm"
                    variant={isSaved && !hasUnsavedChanges ? 'outline' : 'default'}
                    className={`flex-shrink-0 w-[100px] ${isSaved && !hasUnsavedChanges
                            ? 'border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground'
                            : ''
                        }`}
                >
                    {isSaved && !hasUnsavedChanges && !isUnsavePending ? (
                        <div className="flex items-center justify-center">
                            <Trash2 className="w-3 h-3 mr-1.5" />
                            <span>Unsave</span>
                        </div>
                    ) : isUnsavePending ? (
                        <div className="px-2 flex items-center justify-center">
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
                            <span>Removing</span>
                        </div>
                    ) : isSaved && hasUnsavedChanges && !isUpdatePending ? (
                        'Update'
                    ) : isUpdatePending ? (
                        <div className="flex items-center justify-center">
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
                            <span>Updating</span>
                        </div>
                    ) : isSavePending || isPreparingToSave ? (
                        <div className="flex items-center justify-center">
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
                            <span>Saving</span>
                        </div>
                    ) : (
                        'Save'
                    )}
                </Button>
            </div>
        </div>
    )
}
