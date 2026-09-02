import { Languages } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const LANGUAGES = [
    { value: "en", label: "English" },
    { value: "all", label: "All Languages" },
    { value: "zh", label: "中文" },
    { value: "ja", label: "日本語" },
]

interface LanguageMenuProps {
    language: string
    onLanguageChange: (lang: string) => void
}

/**
 * Search language selector.
 *
 * The translate icon opens a plain dropdown of languages; the active one gets a
 * selected-state background (like the feeds sidebar). Defaults to English.
 */
export function LanguageMenu({
    language,
    onLanguageChange,
}: LanguageMenuProps) {
    const active = language || "en"

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Search language"
                    className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0 text-[#91998C] hover:text-[#6A994E] hover:bg-[#E8F5E1] dark:text-muted-foreground dark:hover:text-primary dark:hover:bg-accent"
                >
                    <Languages className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[9rem]">
                {LANGUAGES.map((lang) => (
                    <DropdownMenuItem
                        key={lang.value}
                        onSelect={() => onLanguageChange(lang.value)}
                        className={cn(
                            "cursor-pointer",
                            active === lang.value &&
                                "bg-accent text-accent-foreground focus:bg-accent"
                        )}
                    >
                        {lang.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
