import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
    className?: string
    showText?: boolean
    iconSize?: number
    textSize?: string
}

export function Logo({
    className,
    showText = true,
    iconSize = 24,
    textSize = "text-base"
}: LogoProps) {
    return (
        <div className={cn("flex items-center gap-2 font-medium font-logo text-foreground", className)}>
            <div className="flex items-center justify-center rounded-md bg-primary text-primary-foreground p-1">
                <Image
                    src="/readspace.svg"
                    width={iconSize}
                    height={iconSize}
                    alt="Readspace Logo"
                    className="brightness-0 invert"
                />
            </div>
            {showText && <span className={textSize}>Readspace</span>}
        </div>
    )
}
