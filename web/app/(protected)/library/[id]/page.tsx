import EPUBReader from "@/components/reader/reader"
import { ApiClient } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/server"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { PDFViewer } from "../../../../components/reader/pdf-reader"
import {
    BookViewProps,
    EpubHighlight,
    EpubLocation,
    PdfHighlight,
    UserLibraryBook,
} from "../../../../types/library"

interface PageProps {
    params: Promise<{
        id: string
    }>
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>
}): Promise<Metadata> {
    const libraryBookId = (await params).id
    const libraryBook = await ApiClient.get<UserLibraryBook>(`/books/${libraryBookId}`)
    const bookMetaData = libraryBook?.book_metadata
    return {
        title: `${bookMetaData?.title}`,
        description:
            bookMetaData?.description ||
            `Reading ${bookMetaData?.title} by ${bookMetaData?.author || "Unknown Author"}`,
    }
}

export default async function Page({ params }: PageProps) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const libraryBookId = (await params).id

    let libraryBook: UserLibraryBook | null = null;
    try {
        libraryBook = await ApiClient.get<UserLibraryBook>(`/books/${libraryBookId}`);
        console.log("Full Library Book Fetched:", libraryBook);
    } catch (error) {
        console.error("Failed to fetch library book:", error);
    }

    const highlights: (EpubHighlight | PdfHighlight)[] = []

    if (!libraryBook || !libraryBook.book_metadata) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <h1 className="text-3xl font-bold">Book not found</h1>
                    <p className="mt-2">
                        The book you&apos;re looking for doesn&apos;t exist or
                        has been removed.
                    </p>
                </div>
            </div>
        )
    }

    const bookViewProps: BookViewProps = {
        ...libraryBook.book_metadata,
        library_id: libraryBook.id,
        pdf_current_page: libraryBook.pdf_current_page,
        epub_progress: libraryBook.epub_progress ? libraryBook.epub_progress as unknown as EpubLocation : null,
    };

    console.log("BookViewProps being passed to viewer:", bookViewProps);

    const isPdf = bookViewProps.format === "PDF";

    if (isPdf) {
        return (
            <PDFViewer
                bookMeta={bookViewProps}
                savedHighlights={highlights as PdfHighlight[]}
            />
        )
    } else {
        return (
            <EPUBReader
                bookMeta={bookViewProps}
                savedHighlights={highlights as EpubHighlight[]}
            />
        )
    }
}
