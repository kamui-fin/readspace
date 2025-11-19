import { ChevronLeft, ChevronRight } from "lucide-react"
import { usePagination } from "react-instantsearch"

import { Button } from "@/components/ui/button"

/**
 * Pagination component using Previous/Next buttons
 */
export function Pagination() {
    const { currentRefinement, nbPages, refine, isFirstPage, isLastPage } = usePagination()

    const handlePageChange = (page: number) => {
        refine(page)
        // Scroll to top smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    if (nbPages <= 1) {
        return null
    }

    return (
        <div className="flex items-center justify-center gap-2 mt-8 mb-4">
            <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentRefinement - 1)}
                disabled={isFirstPage}
                className="h-9 px-3 gap-1.5 disabled:opacity-50"
            >
                <ChevronLeft className="w-4 h-4" />
                Previous
            </Button>

            <div className="flex items-center gap-2 px-4 text-sm text-[#91998C] dark:text-muted-foreground">
                <span>{currentRefinement + 1}</span>
                <span>of</span>
                <span>{nbPages}</span>
            </div>

            <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentRefinement + 1)}
                disabled={isLastPage}
                className="h-9 px-3 gap-1.5 disabled:opacity-50"
            >
                Next
                <ChevronRight className="w-4 h-4" />
            </Button>
        </div>
    )
}
