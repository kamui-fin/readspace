"use client"

import { LibraryCatalog } from "@/components/library/library-catalog"
import UploadBookDialog from "@/components/library/upload-book"
import Header from "@/components/navigation/header"
import { useBooks } from "@/lib/api/hooks/books"
import { UserBookLibrary } from "@/types/api"
import { useCurrentUser } from "@/hooks/use-current-user"
import {
    BookCardSkeleton,
    BookCardListSkeleton,
} from "@/components/library/book-card-skeleton"
import { useIsMobile } from "@/hooks/use-mobile"
import { useState, useEffect } from "react"

// export const metadata = {
//     title: "Library | Readspace",
//     description: "Your personal library of books",
// }

interface LibraryErrorProps {
    message: string
}

function LibraryError({ message }: LibraryErrorProps) {
    return (
        <div className="text-center text-red-500">
            <p className="text-lg font-medium">Error loading books</p>
            <p className="text-muted-foreground">{message}</p>
        </div>
    )
}

interface LibraryLayoutProps {
    children: React.ReactNode
}

function LibraryLayout({ children }: LibraryLayoutProps) {
    return (
        <div className="flex flex-col min-h-screen">
            <Header
                breadcrumbItems={[{ href: "/library", label: "Book Library" }]}
            />
            <main className="flex-1 container mx-auto px-8 py-8">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Your Bookshelf</h1>
                    <UploadBookDialog />
                </div>
                {children}
            </main>
        </div>
    )
}

function LibraryLoadingSkeleton() {
    const isMobile = useIsMobile()
    const [viewMode, setViewMode] = useState<"grid" | "list">(
        !isMobile ? "list" : "grid"
    )

    useEffect(() => {
        setViewMode(!isMobile ? "list" : "grid")
    }, [isMobile])

    return (
        <div className="space-y-6">
            {/* Catalog header skeleton */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between flex-wrap">
                <div className="relative flex-1 md:max-w-md min-w-[200px] h-10 bg-muted animate-pulse rounded-md" />
                <div className="flex items-center gap-2">
                    <div className="w-[160px] h-10 bg-muted animate-pulse rounded-md" />
                    <div className="w-[160px] h-10 bg-muted animate-pulse rounded-md" />
                    <div className="w-[80px] h-10 bg-muted animate-pulse rounded-md hidden md:block" />
                </div>
            </div>

            {/* Conditional skeleton based on view mode */}
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
        </div>
    )
}

export default function Library() {
    const { user, isLoading: isUserLoading } = useCurrentUser()
    const { data: books, isLoading, error } = useBooks(user?.id || "")

    // Show loading skeleton while user is being loaded
    if (isUserLoading || !user) {
        return (
            <LibraryLayout>
                <LibraryLoadingSkeleton />
            </LibraryLayout>
        )
    }

    if (isLoading) {
        return (
            <LibraryLayout>
                <LibraryLoadingSkeleton />
            </LibraryLayout>
        )
    }

    if (error) {
        return (
            <LibraryLayout>
                <LibraryError message="Failed to load books. Please try again later." />
            </LibraryLayout>
        )
    }

    return (
        <LibraryLayout>
            <LibraryCatalog books={(books as UserBookLibrary[]) || []} />
        </LibraryLayout>
    )
}
