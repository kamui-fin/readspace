import { Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useSearchBox } from "react-instantsearch"

interface CustomSearchBoxProps {
    placeholder: string
    aiSearchEnabled?: boolean
    onInstantTyping?: () => void
    children?: React.ReactNode
}

/**
 * Custom SearchBox component that integrates with Meilisearch.
 *
 * When AI search is disabled: Provides fuzzy instant search on every keystroke.
 * When AI search is enabled: Disables instant search to save embedding requests,
 * refining only on submit (Enter / form submit).
 */
export function CustomSearchBox({
    placeholder,
    aiSearchEnabled = false,
    onInstantTyping,
    children,
}: CustomSearchBoxProps) {
    const { query, refine } = useSearchBox()
    const [inputValue, setInputValue] = useState(query)

    // Sync with external query changes (e.g. cleared via "Clear" button,
    // restored from a URL param, or a recent-search selection).
    useEffect(() => {
        setInputValue(query)
    }, [query])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        refine(inputValue)
    }

    const handleClear = () => {
        setInputValue("")
        refine("")
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setInputValue(val)

        // Fuzzy instant search as you type when AI search is disabled.
        // When AI search is enabled, wait for Enter/submit.
        if (!aiSearchEnabled) {
            onInstantTyping?.()
            refine(val)
        }
    }

    // If AI search is switched off with unrefined text in the input, run instant search immediately
    const prevAiSearchEnabledRef = useRef(aiSearchEnabled)
    useEffect(() => {
        if (
            prevAiSearchEnabledRef.current &&
            !aiSearchEnabled &&
            inputValue &&
            inputValue !== query
        ) {
            refine(inputValue)
        }
        prevAiSearchEnabledRef.current = aiSearchEnabled
    }, [aiSearchEnabled, inputValue, query, refine])

    return (
        <form
            onSubmit={handleSubmit}
            className="relative flex items-center w-full rounded-2xl bg-[#F3F9EF] dark:bg-input transition-all duration-200 focus-within:ring-2 focus-within:ring-[#6A994E]/30 dark:focus-within:ring-primary/30 h-12 md:h-14 px-3.5 md:px-4 gap-2.5 shadow-2xs"
        >
            <Search className="w-5 h-5 text-[#91998C] dark:text-muted-foreground shrink-0" />
            <input
                type="text"
                placeholder={inputValue ? "" : placeholder}
                value={inputValue}
                onChange={handleInputChange}
                className="flex-1 min-w-0 bg-transparent border-0 outline-none text-base md:text-lg text-foreground placeholder:text-[#D8E5D0] dark:placeholder:text-muted-foreground/60 h-full"
                style={{
                    color: inputValue ? "#475143" : undefined,
                }}
            />
            {inputValue && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="p-1 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                    aria-label="Clear search input"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
            {children && (
                <div className="flex items-center gap-1.5 md:gap-2 shrink-0 pl-1">
                    {children}
                </div>
            )}
        </form>
    )
}
