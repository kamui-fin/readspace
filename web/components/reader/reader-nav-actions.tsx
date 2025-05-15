"use client"

import { updateBookLanguage } from "@/app/(protected)/library/[id]/actions"
import { cn } from "@/lib/utils"
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    ArrowUpDown,
    ChartNoAxesColumnIncreasing,
    ChevronDown,
    Globe,
    LetterText,
    Minus,
    Plus,
    Space,
    TextQuote,
    X,
} from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
    DescriptionDetail,
    DescriptionGroup,
    DescriptionList,
    DescriptionTerm,
} from "@/components/ui/description-list"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { SidebarRightTrigger } from "@/components/ui/sidebar"
import useChapterNavigation from "@/hooks/reader/use-chapter-navigation"
import { useReaderStore } from "@/stores/reader"
import useReaderSettingsStore, {
    ReaderFontFamily,
} from "@/stores/reader-settings"
import { Label } from "../ui/label"
import ReaderSlider from "../ui/reader-slider"
import { Separator } from "../ui/separator"

// Constants for slider configurations
const SLIDER_CONFIG = {
    fontSize: {
        max: 36,
        interval: 2,
        ticks: [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36],
    },
    lineHeight: {
        max: 4,
        interval: 1,
        ticks: [1, 2, 3, 4],
    },
    marginSize: {
        max: 250,
        interval: 50,
        ticks: [] as number[],
    },
}

// Font options for the select dropdown
const FONT_OPTIONS = [
    { value: "serif", label: "Serif" },
    { value: "sans", label: "Sans-serif" },
    { value: "mono", label: "Monospace" },
    { value: "custom", label: "Enter Custom..." },
]

// Language options from reader-nav-actions.tsx
const LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "Arabic (ar)", label: "Arabic (ar)" },
    { value: "Bengali (bn)", label: "Bengali (bn)" },
    { value: "Bulgarian (bg)", label: "Bulgarian (bg)" },
    { value: "Chinese (zh)", label: "Chinese (zh)" },
    { value: "Croatian (hr)", label: "Croatian (hr)" },
    { value: "Czech (cs)", label: "Czech (cs)" },
    { value: "Danish (da)", label: "Danish (da)" },
    { value: "Dutch (nl)", label: "Dutch (nl)" },
    { value: "English (en)", label: "English (en)" },
    { value: "Estonian (et)", label: "Estonian (et)" },
    { value: "Finnish (fi)", label: "Finnish (fi)" },
    { value: "French (fr)", label: "French (fr)" },
    { value: "German (de)", label: "German (de)" },
    { value: "Greek (el)", label: "Greek (el)" },
    { value: "Hebrew (iw)", label: "Hebrew (iw)" },
    { value: "Hindi (hi)", label: "Hindi (hi)" },
    { value: "Hungarian (hu)", label: "Hungarian (hu)" },
    { value: "Indonesian (id)", label: "Indonesian (id)" },
    { value: "Italian (it)", label: "Italian (it)" },
    { value: "Japanese (ja)", label: "Japanese (ja)" },
    { value: "Korean (ko)", label: "Korean (ko)" },
    { value: "Latvian (lv)", label: "Latvian (lv)" },
    { value: "Lithuanian (lt)", label: "Lithuanian (lt)" },
    { value: "Norwegian (no)", label: "Norwegian (no)" },
    { value: "Polish (pl)", label: "Polish (pl)" },
    { value: "Portuguese (pt)", label: "Portuguese (pt)" },
    { value: "Romanian (ro)", label: "Romanian (ro)" },
    { value: "Russian (ru)", label: "Russian (ru)" },
    { value: "Serbian (sr)", label: "Serbian (sr)" },
    { value: "Slovak (sk)", label: "Slovak (sk)" },
    { value: "Slovenian (sl)", label: "Slovenian (sl)" },
    { value: "Spanish (es)", label: "Spanish (es)" },
    { value: "Swahili (sw)", label: "Swahili (sw)" },
    { value: "Swedish (sv)", label: "Swedish (sv)" },
    { value: "Thai (th)", label: "Thai (th)" },
    { value: "Turkish (tr)", label: "Turkish (tr)" },
    { value: "Ukrainian (uk)", label: "Ukrainian (uk)" },
    { value: "Vietnamese (vi)", label: "Vietnamese (vi)" },
]

const CustomFontInput: React.FC<{
    value: ReaderFontFamily
    onChange: (value: ReaderFontFamily) => void
    onClose: () => void
    onSubmit: () => void
}> = ({ value, onChange, onClose, onSubmit }) => (
    <form
        className="flex w-full"
        onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
        }}
    >
        <input
            type="text"
            className="grow border-input bg-transparent border-y border-l rounded-l-md px-3 py-1 text-sm focus:ring-0 focus:outline-none"
            placeholder="Font family name"
            value={value}
            onChange={(e) => onChange(e.target.value as ReaderFontFamily)}
        />
        <button
            type="button"
            onClick={onClose}
            className="border-input bg-background-z-10 inline-flex items-center border-t border-r border-b rounded-r-md px-3 text-sm"
        >
            <X size={15} />
        </button>
    </form>
)

export function ReaderNavActions() {
    const settings = useReaderSettingsStore()
    const isStandardFont = ["serif", "sans", "mono"].includes(
        settings.fontFamily
    )

    const [isOpen, setIsOpen] = React.useState(false)
    const [showCustomFont, setShowCustomFont] = React.useState(!isStandardFont)
    const [customFontFamily, setCustomFontFamily] =
        React.useState<ReaderFontFamily>(
            isStandardFont ? "serif" : settings.fontFamily
        )

    const { nextChapter, prevChapter } = useChapterNavigation()

    const bookMeta = useReaderStore((state) => state.bookMeta)
    const bookLanguage = bookMeta?.language || "English (en)"
    const [language, setLanguage] = React.useState(bookLanguage)

    const getTotalCharsInBook = useReaderStore(
        (state) => state.getTotalCharsInBook
    )
    const getCumulativeCharsRead = useReaderStore(
        (state) => state.getCumulativeCharsRead
    )
    const getPageProgress = useReaderStore((state) => state.getPageProgress)

    // Update showCustomFont whenever fontFamily changes
    React.useEffect(() => {
        const isStandard = ["serif", "sans", "mono"].includes(
            settings.fontFamily
        )
        setShowCustomFont(!isStandard)
        if (!isStandard) {
            setCustomFontFamily(settings.fontFamily)
        }
    }, [settings.fontFamily])

    // Handle language change
    const handleLanguageChange = async (value: string) => {
        setLanguage(value)
        if (bookMeta?.id) {
            await updateBookLanguage(bookMeta.id, value)
        }
    }

    const handleFontFamilyChange = (value: string) => {
        if (value === "custom") {
            setShowCustomFont(true)
            return
        }
        setShowCustomFont(false)
        settings.updateFontFamily(value as ReaderFontFamily)
    }

    const handleCustomFontSubmit = () => {
        settings.updateFontFamily(customFontFamily)
        setShowCustomFont(false)
    }

    return (
        <nav>
            <div className="flex items-center gap-2 text-sm">
                {/* Hide ProgressPopover on small screens */}
                <div className="md:flex">
                    <ProgressPopover
                        cumulativeChars={getCumulativeCharsRead()}
                        totalChars={getTotalCharsInBook()}
                        currentPages={getPageProgress().current}
                        totalPages={getPageProgress().total}
                    />
                </div>

                {/* Language selection popover */}
                <div className="md:flex">
                    <LanguagePopover
                        language={language}
                        onLanguageChange={handleLanguageChange}
                    />
                </div>

                {/* Hide DisplaySettingsPopover on small screens */}
                <div className="md:flex">
                    <DisplaySettingsPopover
                        isOpen={isOpen}
                        onOpenChange={setIsOpen}
                        showCustomFont={showCustomFont}
                        customFontFamily={customFontFamily}
                        onCustomFontChange={setCustomFontFamily}
                        onCustomFontSubmit={handleCustomFontSubmit}
                        onFontFamilyChange={handleFontFamilyChange}
                        onCustomFontClose={() => setShowCustomFont(false)}
                    />
                </div>

                <SidebarRightTrigger className="-ml-1" />
            </div>
        </nav>
    )
}

const ProgressPopover: React.FC<{
    cumulativeChars: number
    totalChars: number
    currentPages: number
    totalPages: number
}> = ({ cumulativeChars, totalChars, currentPages, totalPages }) => (
    <Popover>
        <PopoverTrigger asChild>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 data-[state=open]:bg-accent"
            >
                <ChartNoAxesColumnIncreasing />
            </Button>
        </PopoverTrigger>
        <PopoverContent
            className="w-60 overflow-hidden rounded-lg p-4"
            align="end"
        >
            <DescriptionList>
                <DescriptionGroup>
                    <DescriptionTerm>Characters</DescriptionTerm>
                    <DescriptionDetail>
                        {cumulativeChars.toLocaleString()} /{" "}
                        {totalChars.toLocaleString()}
                    </DescriptionDetail>
                </DescriptionGroup>
                <DescriptionGroup>
                    <DescriptionTerm>Page (est.)</DescriptionTerm>
                    <DescriptionDetail>
                        {currentPages} / {totalPages}
                    </DescriptionDetail>
                </DescriptionGroup>
            </DescriptionList>
        </PopoverContent>
    </Popover>
)

const LanguagePopover: React.FC<{
    language: string
    onLanguageChange: (value: string) => void
}> = ({ language, onLanguageChange }) => (
    <Popover>
        <PopoverTrigger asChild>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 data-[state=open]:bg-accent"
            >
                <Globe className="h-4 w-4" />
            </Button>
        </PopoverTrigger>
        <PopoverContent
            className="w-60 overflow-hidden rounded-lg p-4"
            align="end"
        >
            <div className="space-y-4">
                <h3 className="font-medium">AI Language {language}</h3>
                <Select value={language} onValueChange={onLanguageChange}>
                    <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                        {LANGUAGE_OPTIONS.map(({ value, label }) => (
                            <SelectItem
                                key={value}
                                value={value}
                                className="cursor-pointer"
                            >
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </PopoverContent>
    </Popover>
)

const DisplaySettingsPopover: React.FC<{
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    showCustomFont: boolean
    customFontFamily: ReaderFontFamily
    onCustomFontChange: (value: ReaderFontFamily) => void
    onCustomFontSubmit: () => void
    onFontFamilyChange: (value: string) => void
    onCustomFontClose: () => void
}> = ({
    isOpen,
    onOpenChange,
    showCustomFont,
    customFontFamily,
    onCustomFontChange,
    onCustomFontSubmit,
    onFontFamilyChange,
    onCustomFontClose,
}) => {
    const settings = useReaderSettingsStore()
    const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false)

    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 data-[state=open]:bg-accent hover:bg-accent/50"
                >
                    <LetterText className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[380px] overflow-hidden rounded-lg p-6 shadow-lg"
                align="end"
            >
                <div className="space-y-6">
                    {/* Text Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-semibold">
                                Reader Settings
                            </h2>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <TextQuote className="h-4 w-4" />
                                        <span className="text-sm font-medium">
                                            Text size
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() =>
                                                settings.updateFontSize(
                                                    Math.max(
                                                        12,
                                                        settings.fontSize - 1
                                                    )
                                                )
                                            }
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <span className="min-w-[2.5rem] text-center py-1.5">
                                            {settings.fontSize}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() =>
                                                settings.updateFontSize(
                                                    Math.min(
                                                        36,
                                                        settings.fontSize + 1
                                                    )
                                                )
                                            }
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <LetterText className="h-4 w-4" />
                                    <Label className="text-sm font-medium">
                                        Font
                                    </Label>
                                </div>
                                {showCustomFont ? (
                                    <CustomFontInput
                                        value={customFontFamily}
                                        onChange={onCustomFontChange}
                                        onSubmit={onCustomFontSubmit}
                                        onClose={onCustomFontClose}
                                    />
                                ) : (
                                    <Select
                                        value={settings.fontFamily}
                                        onValueChange={onFontFamilyChange}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Select font" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FONT_OPTIONS.map(
                                                ({ value, label }) => (
                                                    <SelectItem
                                                        key={value}
                                                        value={value}
                                                        className="cursor-pointer"
                                                    >
                                                        {label}
                                                    </SelectItem>
                                                )
                                            )}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Layout Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-semibold">Layout</h2>
                        </div>

                        <div className="space-y-4">
                            {/* <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <PanelLeftClose className="h-4 w-4" />
                                            <Label className="text-sm font-medium">
                                                Margins
                                            </Label>
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                            {settings.marginSize}px
                                        </span>
                                    </div>
                                    <ReaderSlider
                                        min={0}
                                        ticks={SLIDER_CONFIG.marginSize.ticks}
                                        defaultNum={settings.marginSize}
                                        maxNum={SLIDER_CONFIG.marginSize.max}
                                        interval={SLIDER_CONFIG.marginSize.interval}
                                        onSlideChange={settings.updateMarginSize}
                                    />
                                </div> */}

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ArrowUpDown className="h-4 w-4" />
                                        <Label className="text-sm font-medium">
                                            Line spacing
                                        </Label>
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                        {settings.lineHeight}x
                                    </span>
                                </div>
                                <ReaderSlider
                                    ticks={SLIDER_CONFIG.lineHeight.ticks}
                                    defaultNum={settings.lineHeight}
                                    maxNum={SLIDER_CONFIG.lineHeight.max}
                                    interval={SLIDER_CONFIG.lineHeight.interval}
                                    onSlideChange={settings.updateLineHeight}
                                />
                            </div>
                        </div>
                    </div>

                    {/* <Separator /> */}

                    {/* Advanced Section */}
                    <div className="hidden space-y-4">
                        <button
                            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                            className="flex w-full items-center gap-2 text-xl font-semibold"
                        >
                            <span>Advanced</span>
                            <ChevronDown
                                className={cn(
                                    "ml-auto h-5 w-5 transition-transform",
                                    {
                                        "transform rotate-180": isAdvancedOpen,
                                    }
                                )}
                            />
                        </button>

                        {isAdvancedOpen && (
                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <TextQuote className="h-4 w-4" />
                                            <Label className="text-sm font-medium">
                                                Character spacing
                                            </Label>
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                            1.0x
                                        </span>
                                    </div>
                                    <ReaderSlider
                                        ticks={[]}
                                        defaultNum={1}
                                        maxNum={2}
                                        interval={0.1}
                                        onSlideChange={() => {}}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Space className="h-4 w-4" />
                                            <Label className="text-sm font-medium">
                                                Word spacing
                                            </Label>
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                            1.0x
                                        </span>
                                    </div>
                                    <ReaderSlider
                                        ticks={[]}
                                        defaultNum={1}
                                        maxNum={2}
                                        interval={0.1}
                                        onSlideChange={() => {}}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <AlignLeft className="h-4 w-4" />
                                        <Label className="text-sm font-medium">
                                            Text alignment
                                        </Label>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9"
                                        >
                                            <AlignLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9"
                                        >
                                            <AlignCenter className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9"
                                        >
                                            <AlignRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
