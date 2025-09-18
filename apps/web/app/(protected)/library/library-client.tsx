"use client"

import { LibraryCatalog } from "@/components/library/LibraryCatalog"
import FloatingUploadButton from "@/components/library/FloatingUploadButton"
import UploadBookDialog from "@/components/library/UploadBook"
import Header from "@/components/navigation/header"
import { useBooks } from "@readspace/shared"
import { UserBookLibrary } from "@readspace/shared"
import {
    BookCardSkeleton,
    BookCardListSkeleton,
} from "@/components/library/BookCardSkeleton"
import { useIsMobile } from "@/hooks/useMobile"
import { useState, useEffect } from "react"

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
    const isMobile = useIsMobile()

    return (
        <div className="flex flex-col h-full">
            <Header
                classAttributes="rounded-t-xl"
                breadcrumbItems={[{ href: "/library", label: "Book Library" }]}
            />
            <main className="flex-1 px-4 py-6 md:px-6 overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Your Bookshelf</h1>
                    {!isMobile && <UploadBookDialog />}
                </div>
                <div className="overflow-y-auto h-full">{children}</div>
            </main>
            <FloatingUploadButton />
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

interface LibraryClientProps {
    userId: string
}

export default function LibraryClient({ userId }: LibraryClientProps) {
    const { data: books, isLoading, error } = useBooks(userId)

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
