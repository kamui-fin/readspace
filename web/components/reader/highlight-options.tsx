import { Button } from "../ui/button"
import { CustomTooltip } from "./highlight-popover"

const HighlightColorOptions = ({
    handleHighlight,
}: {
    handleHighlight: (color: "yellow" | "blue" | "green") => void
}) => {
    return (
        <div className="flex items-center gap-2 p-2 bg-background dark:bg-gray-900 rounded-md border shadow-sm w-fit">
            <CustomTooltip content="Yellow highlight">
                <Button
                    className="rounded-full bg-yellow-300 h-8 w-8"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleHighlight("yellow")}
                />
            </CustomTooltip>

            <CustomTooltip content="Blue highlight">
                <Button
                    className="rounded-full bg-blue-300 h-8 w-8"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleHighlight("blue")}
                />
            </CustomTooltip>

            <CustomTooltip content="Green highlight">
                <Button
                    className="rounded-full bg-green-300 h-8 w-8"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleHighlight("green")}
                />
            </CustomTooltip>
        </div>
    )
}

export default HighlightColorOptions
