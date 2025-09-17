import { useEffect } from "react"
import useChapterNavigation from "./use-chapter-navigation"

export default function useKeyboardNavigation() {
    const { nextChapter, prevChapter } = useChapterNavigation()

    useEffect(() => {
        const handleKeyDown = (e: Event) => {
            const keyboardEvent = e as KeyboardEvent
            console.log("keyboardEvent", keyboardEvent)
            if (keyboardEvent.key === "ArrowRight") {
                nextChapter()
            } else if (keyboardEvent.key === "ArrowLeft") {
                prevChapter()
            }
        }
        const epubContainer = document.querySelector("#reader-content")
        if (epubContainer) {
            epubContainer.addEventListener("keydown", handleKeyDown)
            return () =>
                epubContainer.removeEventListener("keydown", handleKeyDown)
        }
    }, [nextChapter, prevChapter])
}
