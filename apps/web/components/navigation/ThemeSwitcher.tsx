"use client"

import { Switch } from "@/components/ui/switch"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useId, useState } from "react"

export default function ThemeSwitcher() {
    const { setTheme, theme } = useTheme()

    const id = useId()
    const [isLight, setIsLight] = useState(theme === "light")

    const toggleSwitch = () => {
        setTheme(!isLight ? "light" : "dark")

        setIsLight((prev) => !prev)
    }

    return (
        <div
            className="group inline-flex items-center gap-2"
            data-state={isLight ? "checked" : "unchecked"}
        >
            <span
                id={`${id}-off`}
                className="group-data-[state=checked]:text-muted-foreground/70 flex-1 cursor-pointer text-right text-sm font-medium"
                aria-controls={id}
                onClick={() => setIsLight(false)}
            >
                <MoonIcon size={16} aria-hidden="true" />
            </span>
            <Switch
                id={id}
                checked={isLight}
                onCheckedChange={toggleSwitch}
                aria-labelledby={`${id}-off ${id}-on`}
                aria-label="Toggle between dark and light mode"
            />
            <span
                id={`${id}-on`}
                className="group-data-[state=unchecked]:text-muted-foreground/70 flex-1 cursor-pointer text-left text-sm font-medium"
                aria-controls={id}
                onClick={() => setIsLight(true)}
            >
                <SunIcon size={16} aria-hidden="true" />
            </span>
        </div>
    )
}
