"use client"

import { BookCard } from "@/components/library/BookCard"
import { BookCardList } from "@/components/library/BookCardList"
import {
    BookCardListSkeleton,
    BookCardSkeleton,
} from "@/components/library/BookCardSkeleton"
import { CatalogHeader } from "@/components/library/CatalogHeader"
import { useIsMobile } from "@/hooks/useMobile"
import { ApiClient } from "@readspace/shared"
import { BOOK_QUERY_KEYS } from "@readspace/shared"
import { UserBookLibrary, isEpubProgress } from "@readspace/shared"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

export function LibraryCatalog({
    books: initialBooks,
}: {
    books: UserBookLibrary[]
}) {
    const isMobile = useIsMobile()
    const [viewMode, setViewMode] = useState<"grid" | "list">(
        !isMobile ? "list" : "grid"
    )
    const [searchQuery, setSearchQuery] = useState("")
    const [filter, setFilter] = useState("all")
    const [sortBy, setSortBy] = useState("dateAdded")

    // Use React Query to keep books in sync with client-side mutations
    const { data: books = initialBooks, isLoading: loading } = useQuery<
        UserBookLibrary[]
    >({
        queryKey: [BOOK_QUERY_KEYS.BOOKS],
        queryFn: async () => {
            const response = await ApiClient.books.getUserBooks()
            return response as UserBookLibrary[]
        },
        initialData: initialBooks,
    })

    useEffect(() => {
        setViewMode(!isMobile ? "list" : "grid")
    }, [isMobile])

    // Filter books based on search query and filter
    const filteredBooks = books.filter((book: UserBookLibrary) => {
        const matchesSearch = book.book_metadata.title
            .toLowerCase()
            .includes(searchQuery.toLowerCase())

        // Calculate progress based on book type
        const progress =
            book.book_metadata.format === "PDF"
                ? Math.round(
                      ((book.pdf_current_page || 0) /
                          (book.book_metadata.num_pages || 1)) *
                          100
                  )
                : Math.round(
                      isEpubProgress(book.epub_progress)
                          ? (book.epub_progress.globalProgress.current /
                                book.epub_progress.globalProgress.total) *
                                100
                          : 0
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
        const aProgress = isEpubProgress(a.epub_progress)
            ? a.epub_progress.globalProgress.current /
              a.epub_progress.globalProgress.total
            : 0
        const bProgress = isEpubProgress(b.epub_progress)
            ? b.epub_progress.globalProgress.current /
              b.epub_progress.globalProgress.total
            : 0

        if (sortBy === "title")
            return a.book_metadata.title.localeCompare(b.book_metadata.title)
        if (sortBy === "author")
            return (a.book_metadata.author || "").localeCompare(
                b.book_metadata.author || ""
            )
        if (sortBy === "progress") return bProgress - aProgress
        // Default: sort by date_added (newest first)
        return (
            new Date(b.date_added).getTime() - new Date(a.date_added).getTime()
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
                    {/* Show appropriate skeleton based on view mode */}
                    {viewMode === "grid" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                            {Array.from({ length: 8 }).map((_, index) => (
                                <BookCardSkeleton key={index} />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4 hidden md:block">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <BookCardListSkeleton key={index} />
                            ))}
                        </div>
                    )}

                    {/* Mobile always shows grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <BookCardSkeleton key={index} />
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
