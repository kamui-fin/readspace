import EPUBReader from "@/components/reader/reader"
import { createClient } from "@/lib/supabase/server"
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { PDFViewer } from "../../../../components/reader/pdf-reader"
import { EpubHighlight, PdfHighlight } from "../../../../types/library"
import { getBook, getHighlights } from "./actions"
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
    const book = await getBook((await params).id) // your data fetch
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
    const bookMeta = await getBook(bookId)
    const highlights = await getHighlights(
        bookId,
        bookMeta?.type as "epub" | "pdf"
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
