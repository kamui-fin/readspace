"use client"
import { stripMetaBaseLinkTags } from "@/lib/reader/reader-utils"
import { useReaderStore } from "@/stores/reader"
import useReaderSettingsStore from "@/stores/reader-settings"
import clsx from "clsx"
import { LoaderCircle } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useMemo } from "react"

export const Loading = () => (
    <div className="w-full mt-auto h-[60vh] flex items-center justify-center">
        <LoaderCircle className="animate-spin text-muted-foreground" />
    </div>
)

export default function ReaderContent() {
    const { theme } = useTheme()
    const fonts = {
        serif: "var(--font-garamond-serif)",
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
    }

    // Type guard to check if a string is a key of fonts object
    const isStandardFont = (font: string): font is keyof typeof fonts => {
        return font === "serif" || font === "sans" || font === "mono"
    }

    const setLocation = useReaderStore((state) => state.setLocation)
    const chapterHTML = useReaderStore((state) => state.chapterHTML)

    const ref = useReaderStore((state) => state.epubDocRef)
    const setEpubDocRef = useReaderStore((state) => state.setEpubDocRef)

    const readerSettings = useReaderSettingsStore()

    const addLinkHandler = (e: Event) => {
        e.preventDefault()
        const anchor = e.currentTarget as HTMLAnchorElement
        const href = anchor.pathname.replace(/^\//, "")
        if (href) {
            setLocation(href)
        }
    }

    const memoizedHtml = useMemo(() => {
        return chapterHTML ? (
            <div
                id="epub-container"
                data-tour-id="reader-content"
                className={clsx(
                    `w-full mx-auto py-4 sm:py-6 md:py-8 lg:py-10 h-full text-foreground prose-neutral lg:prose-xl xl:max-w-7xl px-4`,
                    {
                        "text-black": theme === "theme",
                        "text-[#f2f0e3]": theme === "dark",
                    }
                )}
                style={{
                    fontFamily: isStandardFont(readerSettings.fontFamily)
                        ? fonts[readerSettings.fontFamily]
                        : readerSettings.fontFamily,
                    fontSize: `${readerSettings.fontSize}px`,
                    lineHeight: readerSettings.lineHeight,
                }}
                ref={(el) => {
                    if (el) setEpubDocRef(el)
                }}
                dangerouslySetInnerHTML={{
                    __html: stripMetaBaseLinkTags(chapterHTML),
                }}
            />
        ) : (
            <Loading />
        )
    }, [chapterHTML, readerSettings, theme])

    useEffect(() => {
        if (!ref) return
        const anchors = ref.querySelectorAll("a")
        anchors.forEach((a) => {
            a.addEventListener("click", addLinkHandler)
        })
        return () => {
            anchors.forEach((a) => {
                a.removeEventListener("click", addLinkHandler)
            })
        }
    }, [chapterHTML, addLinkHandler])

    return memoizedHtml
}
