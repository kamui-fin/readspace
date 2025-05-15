import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import React from "react"

type ReaderSliderProps = {
    ticks: number[]
    defaultNum: number
    maxNum: number
    interval: number
    onSlideChange: (font: number) => void
    min?: number
}

const ReaderSlider: React.FC<ReaderSliderProps> = ({
    ticks,
    defaultNum,
    maxNum,
    interval,
    onSlideChange,
    min = 1,
}) => {
    return (
        <div className="not-first:*:mt-4">
            <div>
                <Slider
                    defaultValue={[defaultNum]}
                    min={min}
                    max={maxNum}
                    aria-label="Slider with ticks"
                    onValueChange={(value) => onSlideChange(value[0])}
                />
                <span
                    className="text-muted-foreground mt-3 flex w-full items-center justify-between gap-1 px-2.5 text-xs font-medium"
                    aria-hidden="true"
                >
                    {ticks.map((i) => (
                        <span
                            key={i}
                            className="flex w-0 flex-col items-center justify-center gap-2"
                        >
                            <span
                                className={cn(
                                    "bg-muted-foreground/70 h-1 w-px",
                                    i % interval !== 0 && "h-0.5"
                                )}
                            />
                            <span
                                className={cn(
                                    i % interval !== 0 && "opacity-0"
                                )}
                            >
                                {i}
                            </span>
                        </span>
                    ))}
                </span>
            </div>
        </div>
    )
}

export default ReaderSlider
