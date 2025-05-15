import { BookActions } from "@/components/library/book-actions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useSignedImageUrl } from "@/hooks/use-signed-image-url"
import { formatDate } from "@/lib/utils"
import { BookMeta } from "@/types/library"
import humanizeDuration from "humanize-duration"
import localforage from "localforage"
import { BookOpenCheck, Cloud, HardDrive } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"

interface BookCardProps {
    book: BookMeta
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

export function BookCard({ book }: BookCardProps) {
    const [isLocallyAvailable, setIsLocallyAvailable] = useState(false)

    let coverUrl
    if (book.cover_url) {
        const { url } = useSignedImageUrl(book.cover_url, 3600)
        coverUrl = url
    }

    if (!coverUrl) {
        coverUrl =
            book.type === "pdf" ? "/default_pdf_cover.png" : "/placeholder.svg"
    }

    // Check if the book is available in local storage
    useEffect(() => {
        const checkLocalAvailability = async () => {
            const isLocal = book.file_url === null
            if (isLocal) {
                const keys = await localforage.keys()
                setIsLocallyAvailable(keys.includes(book.id))
            }
        }

        checkLocalAvailability()
    }, [book.id, book.file_url])

    // Calculate progress based on book type
    const progress =
        book.type === "pdf"
            ? (book.pdf_page || 0) / (book.num_pages || 1)
            : (book.epub_progress?.globalProgress?.current || 0) /
              (book.epub_progress?.globalProgress?.total || 1)

    const remainingNumChars =
        book.type === "pdf"
            ? 0 // PDF doesn't use character count
            : (book.epub_progress?.globalProgress?.total || 0) -
              (book.epub_progress?.globalProgress?.current || 0)

    const estReadingTimeLeft =
        book.type === "pdf"
            ? `${Math.ceil((book.num_pages || 0) - (book.pdf_page || 0))} pages`
            : estimateReadingTime(remainingNumChars, 250)

    // Determine card style based on local availability
    const isLocal = book.file_url === null
    const cardStyle =
        isLocal && !isLocallyAvailable
            ? "opacity-50 hover:opacity-70"
            : "hover:shadow-md"

    const bookCardContent = (
        <Card
            className={`h-full flex flex-col overflow-hidden transition-all duration-300 ${cardStyle}`}
        >
            <div className="relative aspect-square pt-[60%] bg-muted overflow-hidden">
                <Image
                    src={coverUrl}
                    alt={`Cover for ${book.title}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
            </div>

            <Progress
                value={Math.round(progress * 100)}
                className="h-1 w-full rounded-none bg-gray-200 dark:bg-sidebar"
                indicatorClassName="bg-linear-to-r from-secondary to-primary transition-all duration-300 ease-in-out"
            />

            <CardContent className="flex-1 p-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <h3 className="font-semibold leading-tight line-clamp-1">
                            {book.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {book.author}
                        </p>
                    </div>
                    {(!isLocal || isLocallyAvailable) && (
                        <BookActions book={book} />
                    )}
                </div>

                {book.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                        {book.description}
                    </p>
                )}

                <div className="flex mt-2">
                    <Badge
                        variant="outline"
                        className="text-xs flex items-center gap-1"
                    >
                        {book.file_url === null ? (
                            <>
                                <HardDrive className="h-3 w-3" />
                                {isLocallyAvailable
                                    ? "Local"
                                    : "Not on this device"}
                            </>
                        ) : (
                            <>
                                <Cloud className="h-3 w-3" />
                                Cloud
                            </>
                        )}
                    </Badge>
                </div>

                <div className="mt-4 flex justify-between items-center text-xs text-muted-foreground">
                    <span>
                        Added{" "}
                        {formatDate(
                            book.date_added || new Date().toISOString()
                        )}
                    </span>
                    <span>
                        {estReadingTimeLeft ? (
                            <span>
                                {roundToOneDecimal((1 - progress) * 100)}% left
                            </span>
                        ) : (
                            <div className="flex gap-2 items-center">
                                <BookOpenCheck className="w-4 h-4" />
                                <span>Complete</span>
                            </div>
                        )}
                    </span>
                </div>
            </CardContent>
        </Card>
    )

    return isLocal && !isLocallyAvailable ? (
        <div className="block group">{bookCardContent}</div>
    ) : (
        <Link href={`/library/${book.id}`} className="block group">
            {bookCardContent}
        </Link>
    )
}
