import { BookActions } from "@/components/library/BookActions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useSignedImageUrl } from "@/hooks/useSignedImageUrl"
import { formatRelativeDate } from "@readspace/shared"
import { UserBookLibrary, isEpubProgress } from "@readspace/shared"
import humanizeDuration from "humanize-duration"
import { BookOpenCheck } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface BookCardProps {
    book: UserBookLibrary
}

/**
 * Calculates the estimated reading time for an article based on the number of characters.
 * @param charCount - The total number of characters in the article.
 * @param wordsPerMinute - The average reading speed in words per minute (default: 200).
 * @returns The estimated reading time in minutes (rounded up).
 */
export function estimateReadingTime(
    charCount: number,
    wordsPerMinute: number = 200
): string | boolean {
    if (charCount < 0) {
        return false
    }

    // Average word length is approximately 5 characters
    const averageWordLength = 5

    // Calculate the total number of words
    const wordCount = charCount / averageWordLength

    // Calculate reading time in minutes
    const readingTime = wordCount / wordsPerMinute

    // Round up to the nearest whole number for readability
    const totalMinutes = Math.ceil(readingTime)

    if (totalMinutes == 0) {
        return false
    }

    return humanizeDuration(totalMinutes * 60 * 1000)
}

export function BookCard({ book }: BookCardProps) {
    const { url: signedUrl } = useSignedImageUrl(
        book.book_metadata.cover_url || "",
        3600
    )

    const coverUrl =
        book.book_metadata.cover_url && signedUrl
            ? signedUrl
            : book.book_metadata.format === "PDF"
              ? "/default_pdf_cover.png"
              : "/placeholder.svg"

    // Calculate progress based on book type
    const progress =
        book.book_metadata.format === "PDF"
            ? book.pdf_current_page || 0 // (book.book_metadata.num_pages || 1)
            : isEpubProgress(book.epub_progress)
              ? book.epub_progress.globalProgress.current /
                book.epub_progress.globalProgress.total
              : 0

    const remainingNumChars =
        book.book_metadata.format === "PDF"
            ? 0 // PDF doesn't use character count
            : (isEpubProgress(book.epub_progress)
                  ? book.epub_progress.globalProgress.total
                  : 0) -
              (isEpubProgress(book.epub_progress)
                  ? book.epub_progress.globalProgress.current
                  : 0)

    const estReadingTimeLeft =
        book.book_metadata.format === "PDF"
            ? `${Math.ceil((book.book_metadata.num_pages || 0) - (book.pdf_current_page || 0))} pages`
            : estimateReadingTime(remainingNumChars, 250)

    const bookCardContent = (
        <Card className="transition-all duration-300 hover:shadow-md">
            <div className="relative">
                <div className="aspect-[3/2] w-full relative rounded-t-lg overflow-hidden bg-muted">
                    <Image
                        src={coverUrl}
                        alt={`Cover of ${book.book_metadata.title}`}
                        fill
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                </div>
            </div>

            <CardContent className="flex-1 p-3">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <h3 className="font-semibold leading-tight line-clamp-1 text-sm">
                            {book.book_metadata.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {book.book_metadata.author}
                        </p>
                    </div>
                    <BookActions book={book} />
                </div>

                {book.book_metadata.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                        {book.book_metadata.description}
                    </p>
                )}

                <div className="flex mt-2">
                    <Badge
                        variant="outline"
                        className="text-xs flex items-center gap-1"
                    >
                        <BookOpenCheck className="h-3 w-3" />
                        {book.book_metadata.format}
                    </Badge>
                </div>

                <div className="mt-3 flex justify-between items-center text-xs text-muted-foreground">
                    <span>
                        Added {formatRelativeDate(new Date(book.date_added))}
                    </span>
                    <span>
                        {progress < 1 ? (
                            <>
                                {estReadingTimeLeft}{" "}
                                {book.book_metadata.format === "PDF"
                                    ? "remaining"
                                    : "left"}
                            </>
                        ) : (
                            "Completed"
                        )}
                    </span>
                </div>
            </CardContent>
            <Progress
                value={Math.round(progress * 100)}
                className="h-1 w-full rounded-none bg-gray-200 dark:bg-sidebar"
                indicatorClassName="bg-linear-to-r from-secondary to-primary transition-all duration-300 ease-in-out"
            />
        </Card>
    )

    return (
        <Link href={`/library/${book.id}`} className="block group">
            {bookCardContent}
        </Link>
    )
}
