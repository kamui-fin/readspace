import { BookActions } from "@/components/library/book-actions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useSignedImageUrl } from "@/hooks/use-signed-image-url"
import { formatDate } from "@/lib/utils"
import { UserBookLibrary } from "@/types/api"
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
        // throw new Error("Character count must be greater than zero.")
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

/**
 * Rounds a number to one decimal place.
 * @param num - The number to round.
 * @returns The number rounded to one decimal place.
 */
function roundToOneDecimal(num: number): number {
    return Math.round((num + Number.EPSILON) * 10) / 10
}

// Type guard to check if epub_progress has the expected structure
function isEpubProgressObject(
    progress: any
): progress is { globalProgress: { current: number; total: number } } {
    return (
        progress &&
        typeof progress === "object" &&
        progress.globalProgress &&
        typeof progress.globalProgress === "object" &&
        typeof progress.globalProgress.current === "number" &&
        typeof progress.globalProgress.total === "number"
    )
}

export function BookCard({ book }: BookCardProps) {
    let coverUrl
    if (book.book_metadata.cover_url) {
        const { url } = useSignedImageUrl(book.book_metadata.cover_url, 3600)
        coverUrl = url
    }

    if (!coverUrl) {
        coverUrl =
            book.book_metadata.format === "PDF"
                ? "/default_pdf_cover.png"
                : "/placeholder.svg"
    }

    // Calculate progress based on book type
    const progress =
        book.book_metadata.format === "PDF"
            ? (book.pdf_current_page || 0) / (book.book_metadata.num_pages || 1)
            : isEpubProgressObject(book.epub_progress)
              ? book.epub_progress.globalProgress.current /
                book.epub_progress.globalProgress.total
              : 0

    const remainingNumChars =
        book.book_metadata.format === "PDF"
            ? 0 // PDF doesn't use character count
            : (isEpubProgressObject(book.epub_progress)
                  ? book.epub_progress.globalProgress.total
                  : 0) -
              (isEpubProgressObject(book.epub_progress)
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
                    <span>Added {formatDate(book.date_added)}</span>
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
