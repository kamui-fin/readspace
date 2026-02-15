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
    textSize = "text-base",
}: LogoProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-2 font-medium font-logo text-foreground",
                className
            )}
        >
            <Image
                src="/readspace.svg"
                width={iconSize}
                height={iconSize}
                alt="readspace logo"
            />
            {showText && <span className={textSize}>readspace</span>}
        </div>
    )
}
