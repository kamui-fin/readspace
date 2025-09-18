"use client"

import { DropdownMenuItem } from "@/components/ui/DropdownMenu"
import { Check } from "lucide-react"

interface LanguageSelectorProps {
    onSelect: (languageCode: string) => void
    selectedLanguage?: string
}

const LANGUAGES = [
    { code: "en", name: "English", flag: "🇺🇸" },
    { code: "es", name: "Spanish", flag: "🇪🇸" },
    { code: "fr", name: "French", flag: "🇫🇷" },
    { code: "de", name: "German", flag: "🇩🇪" },
    { code: "it", name: "Italian", flag: "🇮🇹" },
    { code: "pt", name: "Portuguese", flag: "🇵🇹" },
    { code: "ru", name: "Russian", flag: "🇷🇺" },
    { code: "ja", name: "Japanese", flag: "🇯🇵" },
    { code: "ko", name: "Korean", flag: "🇰🇷" },
    { code: "zh", name: "Chinese", flag: "🇨🇳" },
    { code: "ar", name: "Arabic", flag: "🇸🇦" },
    { code: "hi", name: "Hindi", flag: "🇮🇳" },
    { code: "nl", name: "Dutch", flag: "🇳🇱" },
    { code: "sv", name: "Swedish", flag: "🇸🇪" },
    { code: "no", name: "Norwegian", flag: "🇳🇴" },
    { code: "da", name: "Danish", flag: "🇩🇰" },
    { code: "fi", name: "Finnish", flag: "🇫🇮" },
    { code: "pl", name: "Polish", flag: "🇵🇱" },
    { code: "tr", name: "Turkish", flag: "🇹🇷" },
    { code: "th", name: "Thai", flag: "🇹🇭" },
    { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
]

export function LanguageSelector({
    onSelect,
    selectedLanguage,
}: LanguageSelectorProps) {
    return (
        <>
            <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
                Select Language
            </div>
            {LANGUAGES.map((language) => (
                <DropdownMenuItem
                    key={language.code}
                    onClick={() => onSelect(language.code)}
                    className="flex items-center justify-between gap-2 cursor-pointer"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-base">{language.flag}</span>
                        <span>{language.name}</span>
                    </div>
                    {selectedLanguage === language.code && (
                        <Check className="h-4 w-4 text-primary" />
                    )}
                </DropdownMenuItem>
            ))}
        </>
    )
}
