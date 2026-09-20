import { Languages } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    DISCOVER_LANGUAGES,
    type DiscoverLanguage,
} from "@/components/features/discover/hooks/use-discover-controller"
import { cn } from "@/lib/utils"

interface LanguageMenuProps {
    language: DiscoverLanguage
    onLanguageChange: (lang: DiscoverLanguage) => void
}

/**
 * Search language selector.
 *
 * The translate icon opens a plain dropdown of languages; the active one gets
 * a selected-state background (like the feeds sidebar). Defaults to English.
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
                    className="h-8 w-8 md:h-9 md:w-9 rounded-lg flex-shrink-0 text-[#91998C] hover:text-[#6A994E] hover:bg-[#E8F5E1] dark:text-muted-foreground dark:hover:text-primary dark:hover:bg-accent cursor-pointer"
                >
                    <Languages className="h-4 w-4 md:h-4.5 md:w-4.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[9rem]">
                {DISCOVER_LANGUAGES.map((lang) => (
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
