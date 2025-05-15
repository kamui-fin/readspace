import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Markdown } from "@/components/ui/markdown"
import { useTextStream } from "@/components/ui/response-stream"
import { X } from "lucide-react"
import { useEffect } from "react"

const StreamingContent = ({ content }: { content: string }) => {
    const { displayedText, startStreaming } = useTextStream({
        textStream: content,
        mode: "typewriter",
        speed: 70,
    })

    useEffect(() => {
        if (content) {
            startStreaming()
        }
    }, [content, startStreaming])

    return (
        <Markdown className="prose max-w-full dark:prose-invert prose-base prose-headings:!mt-4 prose-headings:!mb-2 prose-p:!my-4 prose-li:!my-0 prose-pre:!bg-muted prose-pre:!p-2 prose-pre:!rounded text-black">
            {displayedText}
        </Markdown>
    )
}

const PdfAIResponse = () => {
    const formatActionType = (type: string) => {
        if (!type) return ""
        return type
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase())
            .replace(/([a-z])([A-Z])/g, "$1 $2")
    }

    return (
        <Card className="w-[900px] max-w-[95vw] p-5 shadow-lg bg-background flex flex-col pointer-events-auto rounded-[20px]">
            BRUHHHHHHHHHHHHHHHHHHHHH
        </Card>
    )
}

export default PdfAIResponse
