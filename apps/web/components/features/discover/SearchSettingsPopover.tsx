import { SlidersHorizontal, Sparkles } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import { Switch } from "@/components/ui/switch"

interface SearchSettingsPopoverProps {
    language: string
    onLanguageChange: (lang: string) => void
    aiEnabled: boolean
    onAiToggle: (enabled: boolean) => void
}

/**
 * Search Settings Popover Component
 */
export function SearchSettingsPopover({
    language,
    onLanguageChange,
    aiEnabled,
    onAiToggle,
}: SearchSettingsPopoverProps) {
    const [open, setOpen] = useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0 text-[#91998C] hover:text-[#6A994E] hover:bg-[#E8F5E1] dark:text-muted-foreground dark:hover:text-primary dark:hover:bg-accent"
                >
                    <SlidersHorizontal className="h-5 w-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                    {/* AI Search Toggle */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-[#6A994E] dark:text-primary" />
                                <Label htmlFor="ai-search" className="text-sm">
                                    AI Search
                                </Label>
                            </div>
                            <Switch
                                id="ai-search"
                                checked={aiEnabled}
                                onCheckedChange={onAiToggle}
                            />
                        </div>
                        {aiEnabled && (
                            <p className="text-xs text-muted-foreground pl-6">
                                Uses semantic understanding to find relevant
                                feeds
                            </p>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
