import { BookActions } from "@/components/library/book-actions"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useSignedImageUrl } from "@/hooks/use-signed-image-url"
import { formatRelativeDate } from "@readspace/shared"
import { UserBookLibrary, isEpubProgress } from "@readspace/shared"
import { BookOpenCheck } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface BookCardListProps {
    book: UserBookLibrary
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
            ? (book.pdf_current_page || 0) / (book.book_metadata.num_pages || 1)
            : isEpubProgress(book.epub_progress)
              ? book.epub_progress.globalProgress.current /
                book.epub_progress.globalProgress.total
              : 0

    const CardContent = (
        <Card className="transition-all duration-300 hover:shadow-md">
            <div className="p-2 sm:p-4 flex gap-2 sm:gap-4">
                <div className="relative w-[60px] h-[90px] sm:w-[80px] sm:h-[120px] rounded shrink-0 bg-muted overflow-hidden">
                    <Image
                        src={coverUrl || "/placeholder.svg"}
                        alt={`Cover of ${book.book_metadata.title}`}
                        fill
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm sm:text-base line-clamp-1">
                                {book.book_metadata.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">
                                {book.book_metadata.author}
                            </p>

                            <div className="flex mt-1 sm:mt-2">
                                <Badge
                                    variant="outline"
                                    className="text-[10px] sm:text-xs flex items-center gap-1 px-1 sm:px-2 py-0 sm:py-0.5"
                                >
                                    <BookOpenCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                    <span>{book.book_metadata.format}</span>
                                </Badge>
                            </div>
                        </div>
                        <div className="shrink-0">
                            <BookActions book={book} />
                        </div>
                    </div>

                    <p className="text-xs sm:text-sm text-muted-foreground my-1 sm:my-2 line-clamp-1 sm:line-clamp-2 hidden xs:block">
                        {book.book_metadata.description ||
                            "No description yet."}
                    </p>

                    <div className="mt-auto flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
                        <span className="hidden sm:inline">
                            Added{" "}
                            {formatRelativeDate(new Date(book.date_added))}
                        </span>
                        <span className="sm:hidden">
                            {new Date(book.date_added).toLocaleDateString()}
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

    return (
        <Link href={`/library/${book.id}`} className="block group">
            {CardContent}
        </Link>
    )
}
