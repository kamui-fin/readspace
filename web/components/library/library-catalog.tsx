"use client"

import { BookCard } from "@/components/library/book-card"
import { BookCardList } from "@/components/library/book-card-list"
import {
    BookCardListSkeleton,
    BookCardSkeleton,
} from "@/components/library/book-card-skeleton"
import { CatalogHeader } from "@/components/library/catalog-header"
import { useIsMobile } from "@/hooks/use-mobile"
import { BookMeta } from "@/types/library"
import { useEffect, useState } from "react"

export function LibraryCatalog({ books }: { books: BookMeta[] }) {
    const isMobile = useIsMobile()
    const [viewMode, setViewMode] = useState<"grid" | "list">(
        !isMobile ? "list" : "grid"
    )
    const [searchQuery, setSearchQuery] = useState("")
    const [filter, setFilter] = useState("all")
    const [sortBy, setSortBy] = useState("dateAdded")
    const [loading] = useState(false)

    useEffect(() => {
        setViewMode(!isMobile ? "list" : "grid")
    }, [isMobile])

    // Filter books based on search query and filter
    const filteredBooks = books.filter((book) => {
        const matchesSearch = book.title
            .toLowerCase()
            .includes(searchQuery.toLowerCase())

        // Calculate progress based on book type
        const progress =
            book.type === "pdf"
                ? Math.round(
                      ((book.pdf_page || 0) / (book.num_pages || 1)) * 100
                  )
                : Math.round(
                      ((book.epub_progress?.globalProgress?.current || 0) /
                          (book.epub_progress?.globalProgress?.total || 1)) *
                          100
                  )

        if (filter === "all") return matchesSearch
        if (filter === "completed") return matchesSearch && progress === 100
        if (filter === "in-progress")
            return matchesSearch && progress > 0 && progress < 100
        if (filter === "not-started") return matchesSearch && progress === 0

        return matchesSearch
    })

    // Sort books
    const sortedBooks = [...filteredBooks].sort((a, b) => {
        const aProgress =
            (a.epub_progress?.globalProgress?.current || 0) /
            (a.epub_progress?.globalProgress?.total || 1)
        const bProgress =
            (b.epub_progress?.globalProgress?.current || 0) /
            (b.epub_progress?.globalProgress?.total || 1)

        if (sortBy === "title") return a.title.localeCompare(b.title)
        if (sortBy === "author") return a.title.localeCompare(b.title) // Use title as fallback since creator is gone
        if (sortBy === "progress") return bProgress - aProgress
        // Default: sort by date_added (newest first)
        return (
            new Date(b.date_added || "").getTime() -
            new Date(a.date_added || "").getTime()
        )
    })

    return (
        <div className="space-y-6">
            <CatalogHeader
                viewMode={viewMode}
                setViewMode={setViewMode}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filter={filter}
                setFilter={setFilter}
                sortBy={sortBy}
                setSortBy={setSortBy}
            />

            {loading ? (
                <>
                    {/* Responsive Grid Skeleton - always shown initially */}
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <BookCardSkeleton key={index} />
                        ))}
                    </div>
                    {/* List Skeleton - hidden on mobile */}
                    <div className="hidden md:block space-y-4">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <BookCardListSkeleton key={index} />
                        ))}
                    </div>
                </>
            ) : (
                <>
                    {/* Responsive Grid View */}
                    <div
                        className={`grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 ${viewMode === "grid" ? "" : "hidden md:hidden"}`}
                    >
                        {sortedBooks.map((book) => (
                            <BookCard key={book.id} book={book} />
                        ))}
                    </div>
                    {/* List View - hidden on mobile, shown on md+ if viewMode is 'list' */}
                    <div
                        className={`space-y-4 ${viewMode === "list" ? "hidden md:block" : "hidden"}`}
                    >
                        {sortedBooks.map((book) => (
                            <BookCardList key={book.id} book={book} />
                        ))}
                    </div>
                </>
            )}

            {!loading && sortedBooks.length === 0 && (
                <div className="text-center py-12 md:py-8">
                    <p className="text-muted-foreground">
                        {books.length == 0
                            ? "Begin by adding some documents to your library"
                            : "No documents match your search."}
                    </p>
                </div>
            )}
        </div>
    )
}
