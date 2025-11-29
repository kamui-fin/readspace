import { Search } from "lucide-react"
import { useEffect, useState } from "react"
import { useSearchBox } from "react-instantsearch"

import { Input } from "@/components/ui/input"

import { SearchSettingsPopover } from "./SearchSettingsPopover"

interface CustomSearchBoxProps {
    placeholder: string
    language: string
    onLanguageChange: (lang: string) => void
    aiEnabled: boolean
    onAiToggle: (enabled: boolean) => void
}

/**
 * Custom SearchBox component that integrates with Meilisearch
 */
export function CustomSearchBox({
    placeholder,
    language,
    onLanguageChange,
    aiEnabled,
    onAiToggle,
}: CustomSearchBoxProps) {
    const { query, refine } = useSearchBox()
    const [inputValue, setInputValue] = useState(query)

    // Sync with external query changes
    useEffect(() => {
        setInputValue(query)
    }, [query])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        refine(inputValue)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setInputValue(value)
        // Auto-refine as user types (instant search)
        refine(value)
    }

    return (
        <form onSubmit={handleSubmit} className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#91998C] dark:text-muted-foreground" />
            <Input
                type="text"
                placeholder={inputValue ? "" : placeholder}
                value={inputValue}
                onChange={handleInputChange}
                className={`pl-12 pr-14 md:pr-16 border-0 h-12 md:h-14 text-base md:text-lg w-full ${
                    inputValue
                        ? "bg-[#F3F9EF] dark:bg-input placeholder:text-[#91998C] dark:placeholder:text-muted-foreground"
                        : "bg-[#F3F9EF] dark:bg-input placeholder:text-[#D8E5D0] dark:placeholder:text-muted-foreground/60"
                }`}
                style={{
                    color: inputValue ? "#91998C" : "#D8E5D0",
                }}
            />
            <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                <SearchSettingsPopover
                    language={language}
                    onLanguageChange={onLanguageChange}
                    aiEnabled={aiEnabled}
                    onAiToggle={onAiToggle}
                />
            </div>
        </form>
    )
}
