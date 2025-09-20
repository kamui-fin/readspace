import { PDFViewer } from "@/components/reader/PdfReader"
import EPUBReader from "@/components/reader/Reader"
import "@/lib/configure-api-client"
import { getQueryClient } from "@/lib/get-query-client"
import { createClient } from "@/lib/supabase/server"
import { EpubHighlight, EpubLocation, PdfHighlight } from "@/types/library"
import {
    ApiClient,
    BOOK_QUERY_KEYS,
    BookViewProps,
    isEpubProgress,
    isSerializedRange,
    SerializedRange,
} from "@readspace/shared"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { Metadata } from "next"
import { redirect } from "next/navigation"

// Force dynamic rendering since we're fetching user-specific data
export const dynamic = "force-dynamic"

interface PageProps {
    params: Promise<{
        id: string
    }>
}

interface BookNotFoundProps {
    message?: string
}

function BookNotFound({
    message = "The book you're looking for doesn't exist or has been removed.",
}: BookNotFoundProps) {
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center">
                <h1 className="text-3xl font-bold">Book not found</h1>
                <p className="mt-2">{message}</p>
            </div>
        </div>
    )
}

export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const resolvedParams = await params
    try {
        const libraryBook = await ApiClient.books.getBook(resolvedParams.id)
        const bookMetaData = libraryBook?.book_metadata

        if (!bookMetaData) {
            return {
                title: "Book Not Found | Readspace",
                description: "The requested book could not be found",
            }
        }

        return {
            title: `${bookMetaData.title} | Readspace`,
            description:
                bookMetaData.description ||
                `Reading ${bookMetaData.title} by ${bookMetaData.author || "Unknown Author"}`,
        }
    } catch {
        return {
            title: "Book Not Found | Readspace",
            description: "The requested book could not be found",
        }
    }
}

export default async function BookReaderPage({ params }: PageProps) {
    const resolvedParams = await params
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const queryClient = getQueryClient()

    // Prefetch book data and highlights in parallel
    const [libraryBook, fetchedHighlights] = await Promise.all([
        queryClient.fetchQuery({
            queryKey: [BOOK_QUERY_KEYS.BOOK, resolvedParams.id],
            queryFn: () => ApiClient.books.getBook(resolvedParams.id),
        }),
        queryClient.fetchQuery({
            queryKey: [BOOK_QUERY_KEYS.HIGHLIGHTS, resolvedParams.id],
            queryFn: () =>
                ApiClient.highlights.getBookHighlights(resolvedParams.id),
        }),
    ])

    if (!libraryBook?.book_metadata) {
        return <BookNotFound />
    }

    // Convert epub_progress from JSON to typed format
    const epubProgress =
        libraryBook.epub_progress && isEpubProgress(libraryBook.epub_progress)
            ? libraryBook.epub_progress
            : null

    // Convert EpubProgress to EpubLocation for the reader component
    const epubLocation: EpubLocation | null = epubProgress
        ? {
              globalProgress: epubProgress.globalProgress,
              loc: epubProgress.loc,
          }
        : null

    const bookViewProps: BookViewProps = {
        ...libraryBook.book_metadata,
        library_id: libraryBook.id,
        pdf_current_page: libraryBook.pdf_current_page,
        epub_progress: epubProgress,
    }

    // Create props for reader components that expect EpubLocation and local BookViewProps type
    const readerBookProps = {
        ...bookViewProps,
        epub_progress: epubLocation,
    } as import("@/types/library").BookViewProps

    const isPdf = bookViewProps.format === "PDF"

    const highlights: (EpubHighlight | PdfHighlight)[] = fetchedHighlights.map(
        (h): EpubHighlight | PdfHighlight => {
            if (isPdf) {
                return {
                    id: h.id,
                    note: h.note || undefined,
                    color: h.color || undefined,
                    book_id: bookViewProps.id,
                    type: "text",
                    position:
                        h.pdf_rect_position as unknown as PdfHighlight["position"],
                    content: { text: h.original_text },
                    user_book_lib_id: h.user_book_lib_id,
                    library_id: h.user_book_lib_id,
                } as PdfHighlight
            } else {
                return {
                    id: h.id,
                    user_book_lib_id: h.user_book_lib_id,
                    original_text: h.original_text,
                    color: h.color || undefined,
                    note: h.note || undefined,
                    range:
                        h.html_range && isSerializedRange(h.html_range)
                            ? (h.html_range as SerializedRange)
                            : {
                                  startContainerPath: [],
                                  startOffset: 0,
                                  endContainerPath: [],
                                  endOffset: 0,
                              },
                    chapter: {
                        idx: h.chapter_idx || 0,
                        href: h.chapter_href || "",
                        title: h.chapter_title || undefined,
                    },
                    page: h.page || 0,
                } as EpubHighlight
            }
        }
    )

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            {isPdf ? (
                <PDFViewer
                    bookMeta={readerBookProps}
                    savedHighlights={highlights as PdfHighlight[]}
                />
            ) : (
                <EPUBReader
                    bookMeta={readerBookProps}
                    savedHighlights={highlights as EpubHighlight[]}
                />
            )}
        </HydrationBoundary>
    )
}
