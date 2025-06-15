import { PDFViewer } from "@/components/reader/pdf-reader"
import EPUBReader from "@/components/reader/reader"
import { ApiClient } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/server"
import { UserBookLibrary } from "@/types/api"
import {
    BookViewProps,
    EpubHighlight,
    EpubLocation,
    PdfHighlight,
} from "@/types/library"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { Tables } from "@/database.types"

type Highlight = Tables<"highlights">

interface PageProps {
    params: Promise<{
        id: string
    }>
}

interface BookNotFoundProps {
    message?: string
}

function BookNotFound({ message = "The book you're looking for doesn't exist or has been removed." }: BookNotFoundProps) {
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center">
                <h1 className="text-3xl font-bold">Book not found</h1>
                <p className="mt-2">{message}</p>
            </div>
        </div>
    )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const resolvedParams = await params
    try {
        const libraryBook = await ApiClient.get<UserBookLibrary>(`/api/books/${resolvedParams.id}`)
        const bookMetaData = libraryBook?.book_metadata

        if (!bookMetaData) {
            return {
                title: "Book Not Found | ReadSpace",
                description: "The requested book could not be found",
            }
        }

        return {
            title: `${bookMetaData.title} | ReadSpace`,
            description: bookMetaData.description ||
                `Reading ${bookMetaData.title} by ${bookMetaData.author || "Unknown Author"}`,
        }
    } catch (error) {
        return {
            title: "Book Not Found | ReadSpace",
            description: "The requested book could not be found",
        }
    }
}

export default async function BookReaderPage({ params }: PageProps) {
    const resolvedParams = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    let libraryBook: UserBookLibrary | null = null
    try {
        libraryBook = await ApiClient.get<UserBookLibrary>(`/api/books/${resolvedParams.id}`)
    } catch (error) {
        return <BookNotFound message="Failed to load the book. Please try again later." />
    }

    if (!libraryBook?.book_metadata) {
        return <BookNotFound />
    }

    const bookViewProps: BookViewProps = {
        ...libraryBook.book_metadata,
        library_id: libraryBook.id,
        pdf_current_page: libraryBook.pdf_current_page,
        epub_progress: libraryBook.epub_progress ?
            libraryBook.epub_progress as unknown as EpubLocation :
            null,
    }

    const isPdf = bookViewProps.format === "PDF"
    const fetchedHighlights = await ApiClient.get<Highlight[]>(`/highlights/book/${resolvedParams.id}`)

    let highlights: (EpubHighlight | PdfHighlight)[] = fetchedHighlights.map((h): EpubHighlight | PdfHighlight => {
        if (isPdf) {
            return {
                id: h.id,
                note: h.note || undefined,
                color: h.color || undefined,
                book_id: bookViewProps.id,
                type: "text",
                position: h.pdf_rect_position as unknown as PdfHighlight['position'],
                content: { text: h.original_text },
                user_book_lib_id: h.user_book_lib_id,
                library_id: h.user_book_lib_id,
            } as PdfHighlight;
        } else {
            return {
                id: h.id,
                user_book_lib_id: h.user_book_lib_id,
                original_text: h.original_text,
                color: h.color || undefined,
                note: h.note || undefined,
                range: h.html_range as unknown as EpubHighlight['range'],
                chapter: {
                    idx: h.chapter_idx || 0,
                    href: h.chapter_href || "",
                    title: h.chapter_title || undefined,
                },
                page: h.page || 0,
            } as EpubHighlight;
        }
    });


    console.log(highlights)

    return isPdf ? (
        <PDFViewer
            bookMeta={bookViewProps}
            savedHighlights={highlights as PdfHighlight[]}
        />
    ) : (
        <EPUBReader
            bookMeta={bookViewProps}
            savedHighlights={highlights as EpubHighlight[]}
        />
    )
}
