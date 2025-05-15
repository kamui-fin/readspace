import { BookActions } from "@/components/library/book-actions"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useSignedImageUrl } from "@/hooks/use-signed-image-url"
import { formatDate } from "@/lib/utils"
import { BookMeta } from "@/types/library"
import localforage from "localforage"
import { BookOpenCheck, Cloud, HardDrive } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { estimateReadingTime } from "./book-card"

interface BookCardListProps {
    book: BookMeta
}

/**
 * Rounds a number to one decimal place.
 * @param num - The number to round.
 * @returns The number rounded to one decimal place.
 */
function roundToOneDecimal(num: number): number {
    return Math.round((num + Number.EPSILON) * 10) / 10
}

export function BookCardList({ book }: BookCardListProps) {
    const [isLocallyAvailable, setIsLocallyAvailable] = useState(true)
    let coverUrl
    if (book.cover_url) {
        const { url } = useSignedImageUrl(book.cover_url, 3600)
        coverUrl = url
    } else {
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

    const CardContent = (
        <Card className={`transition-all duration-300 ${cardStyle}`}>
            <div className="p-2 sm:p-4 flex gap-2 sm:gap-4">
                <div className="relative w-[60px] h-[90px] sm:w-[80px] sm:h-[120px] rounded shrink-0 bg-muted overflow-hidden">
                    <Image
                        src={coverUrl || "/placeholder.svg"}
                        alt={`Cover of ${book.title}`}
                        fill
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex justify-between items-start">
                        <div className="min-w-0 pr-2">
                            <h3 className="font-semibold text-base sm:text-lg truncate">
                                {book.title}
                            </h3>
                            <div className="flex flex-wrap items-center text-xs sm:text-sm text-muted-foreground mt-1 space-x-2">
                                <span className="truncate max-w-[150px] sm:max-w-none">
                                    {book.author}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-muted-foreground hidden sm:block"></span>
                                {estReadingTimeLeft ? (
                                    <span className="hidden sm:inline">
                                        {estReadingTimeLeft} left
                                    </span>
                                ) : (
                                    <div className="flex gap-1 sm:gap-2 items-center">
                                        <BookOpenCheck className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span>Complete</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex mt-1 sm:mt-2">
                                <Badge
                                    variant="outline"
                                    className="text-[10px] sm:text-xs flex items-center gap-1 px-1 sm:px-2 py-0 sm:py-0.5"
                                >
                                    {book.file_url === null ? (
                                        <>
                                            <HardDrive className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                            <span className="hidden xs:inline">
                                                {isLocallyAvailable
                                                    ? "Local"
                                                    : "Not on this device"}
                                            </span>
                                            <span className="xs:hidden">
                                                {isLocallyAvailable
                                                    ? "Local"
                                                    : "N/A"}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <Cloud className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                            <span>Cloud</span>
                                        </>
                                    )}
                                </Badge>
                            </div>
                        </div>
                        <div className="shrink-0">
                            {(!isLocal || isLocallyAvailable) && (
                                <BookActions book={book} />
                            )}
                        </div>
                    </div>

                    <p className="text-xs sm:text-sm text-muted-foreground my-1 sm:my-2 line-clamp-1 sm:line-clamp-2 hidden xs:block">
                        {book.description || "No description yet."}
                    </p>

                    <div className="mt-auto flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
                        <span className="hidden sm:inline">
                            Added{" "}
                            {formatDate(
                                book.date_added || new Date().toISOString()
                            )}
                        </span>
                        <span className="sm:hidden">
                            {new Date(
                                book.date_added || new Date().toISOString()
                            ).toLocaleDateString()}
                        </span>
                        <span>
                            {roundToOneDecimal((1 - progress) * 100)}% left
                        </span>
                    </div>
                </div>
            </div>
            <Progress
                value={Math.round(progress * 100)}
                className="h-1 w-full rounded-none bg-gray-200 dark:bg-sidebar"
                indicatorClassName="bg-linear-to-r from-secondary to-primary transition-all duration-300 ease-in-out"
            />
        </Card>
    )

    return isLocal && !isLocallyAvailable ? (
        <div className="block group">{CardContent}</div>
    ) : (
        <Link href={`/library/${book.id}`} className="block group">
            {CardContent}
        </Link>
    )
}
