import EPUBReader from "@/components/reader/reader"
import { ApiClient } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/server"
import { Highlight } from "@/types/api"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { PDFViewer } from "../../../../components/reader/pdf-reader"
import {
    BookMeta,
    EpubHighlight,
    PdfHighlight,
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
    const bookId = (await params).id
    const book = await ApiClient.get<BookMeta>(`/books/${bookId}`)
    return {
        title: `${book?.title}`,
        description:
            book?.description ||
            `Reading ${book?.title} by ${book?.author || "Unknown Author"}`,
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

    const bookId = (await params).id
    const bookMeta = await ApiClient.get<BookMeta>(`/books/${bookId}`)
    const highlights = await ApiClient.get<Highlight[]>(
        `/highlights/book/${bookId}`
    )

    if (!bookMeta) {
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

    // Determine book type either by file extension or type field
    const isPdf = bookMeta.type === "pdf" || bookMeta.file_url?.endsWith(".pdf")

    if (isPdf) {
        return (
            <PDFViewer
                bookMeta={bookMeta}
                savedHighlights={highlights as unknown as PdfHighlight[]}
            />
        )
    } else {
        return (
            <EPUBReader
                bookMeta={bookMeta}
                savedHighlights={highlights as unknown as EpubHighlight[]}
            />
        )
    }
}
