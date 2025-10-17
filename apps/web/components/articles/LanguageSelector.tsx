"use client"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Check } from "lucide-react"
import ReactCountryFlag from "react-country-flag"

interface LanguageSelectorProps {
    onSelect: (languageCode: string) => void
    selectedLanguage?: string
}

const LANGUAGES = [
    { code: "en", name: "English", countryCode: "GB" },
    { code: "es", name: "Spanish", countryCode: "ES" },
    { code: "fr", name: "French", countryCode: "FR" },
    { code: "de", name: "German", countryCode: "DE" },
    { code: "it", name: "Italian", countryCode: "IT" },
    { code: "pt", name: "Portuguese", countryCode: "BR" },
    { code: "ru", name: "Russian", countryCode: "RU" },
    { code: "ja", name: "Japanese", countryCode: "JP" },
    { code: "ko", name: "Korean", countryCode: "KR" },
    { code: "zh", name: "Chinese (Simplified)", countryCode: "CN" },
    { code: "ar", name: "Arabic", countryCode: "SA" },
    { code: "hi", name: "Hindi", countryCode: "IN" },
    { code: "nl", name: "Dutch", countryCode: "NL" },
    { code: "sv", name: "Swedish", countryCode: "SE" },
    { code: "no", name: "Norwegian", countryCode: "NO" },
    { code: "da", name: "Danish", countryCode: "DK" },
    { code: "fi", name: "Finnish", countryCode: "FI" },
    { code: "pl", name: "Polish", countryCode: "PL" },
    { code: "tr", name: "Turkish", countryCode: "TR" },
    { code: "th", name: "Thai", countryCode: "TH" },
    { code: "vi", name: "Vietnamese", countryCode: "VN" },
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
            <div className="max-h-60 overflow-y-auto">
                {LANGUAGES.map((language) => (
                    <DropdownMenuItem
                        key={language.code}
                        onClick={() => onSelect(language.code)}
                        className="flex items-center justify-between gap-2 cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <ReactCountryFlag
                                countryCode={language.countryCode}
                                svg
                                style={{
                                    width: '1.2em',
                                    height: '1.2em',
                                }}
                                title={language.name}
                            />
                            <span>{language.name}</span>
                        </div>
                        {selectedLanguage === language.code && (
                            <Check className="h-4 w-4 text-primary" />
                        )}
                    </DropdownMenuItem>
                ))}
            </div>
        </>
    )
}
