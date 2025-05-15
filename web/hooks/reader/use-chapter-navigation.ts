import { useReaderStore } from "@/stores/reader"
import { useShallow } from "zustand/react/shallow"
import { saveEpubProgress } from "../../app/(protected)/library/[id]/actions"

export default function useChapterNavigation() {
    const {
        getCurrentChapterIdx,
        setProgressPercentage,
        charsReadInChapter,
        setCharsReadInChapter,
        getTotalCharsInBook,
        setLocation,
        epubBook,
        bookMeta,
    } = useReaderStore(
        useShallow((state) => ({
            getCurrentChapterIdx: state.getCurrentChapterIdx,
            charsReadInChapter: state.charsReadInChapter,
            setCharsReadInChapter: state.setCharsReadInChapter,
            getTotalCharsInBook: state.getTotalCharsInBook,
            setLocation: state.setLocation,
            epubBook: state.book,
            bookMeta: state.bookMeta,
            setProgressPercentage: state.setProgressPercentage,
        }))
    )

    const changeChapter = async (index: number) => {
        if (epubBook && bookMeta) {
            const spine = (epubBook as ePub.Book).spine.get(index)
            if (spine) {
                setLocation(spine.href)
                saveEpubProgress(
                    {
                        loc: spine.href,
                        scrollElement: undefined,
                        globalProgress: {
                            current: charsReadInChapter,
                            total: getTotalCharsInBook(),
                        },
                    },
                    bookMeta.id
                )
                setProgressPercentage(0)
                setCharsReadInChapter(0)
            }
        }
    }

    const nextChapter = () => {
        const currIndex = getCurrentChapterIdx()
        if (currIndex !== undefined) changeChapter(currIndex + 1)
    }

    const prevChapter = () => {
        const currIndex = getCurrentChapterIdx()
        if (currIndex !== undefined) changeChapter(currIndex - 1)
    }

    return { nextChapter, prevChapter, changeChapter }
}
