import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface CircularProgressProps {
    value: number
    size?: number
    strokeWidth?: number
    className?: string
}

export function CircularProgress({
    value,
    size = 24,
    strokeWidth = 2,
    className,
}: CircularProgressProps) {
    // Adjust the actual SVG size to account for the stroke
    const svgSize = size + strokeWidth
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (value / 100) * circumference
    const center = svgSize / 2

    return (
        <div className={cn(className)} style={{ width: size, height: size }}>
            <svg
                className="w-full h-full"
                viewBox={`0 0 ${svgSize} ${svgSize}`}
                style={{ margin: `-${strokeWidth / 2}px` }}
            >
                {/* Background circle */}
                <circle
                    className="stroke-muted-foreground/20"
                    fill="none"
                    strokeWidth={strokeWidth}
                    style={{
                        strokeDasharray: circumference,
                        transform: "rotate(-90deg)",
                        transformOrigin: "center",
                    }}
                    r={radius}
                    cx={center}
                    cy={center}
                />
                {/* Progress circle */}
                <motion.circle
                    className="stroke-current"
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{
                        transform: "rotate(-90deg)",
                        transformOrigin: "center",
                    }}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    r={radius}
                    cx={center}
                    cy={center}
                />
            </svg>
        </div>
    )
}
