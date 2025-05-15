import { cn } from "@/lib/utils"
import {
    convertCharToPage,
    navigateToLocation,
    parseCitation,
} from "@/utils/navigation"
import "katex/dist/katex.min.css" // `rehype-katex` does not import the CSS for you
import { uniqueId } from "lodash"
import { BookOpen } from "lucide-react"
import { marked } from "marked"
import mermaid from "mermaid"
import { memo, useEffect, useId, useMemo, useRef, useState } from "react"
import ReactMarkdown, { Components } from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import { CodeBlock, CodeBlockCode } from "./code-block"

mermaid.initialize({
    theme: "forest",
    startOnLoad: false,
    securityLevel: "loose",
    fontFamily: "monospace, system-ui, -apple-system, sans-serif",
    fontSize: 16,
    themeVariables: {
        primaryColor: "#c1e1c1",
        primaryTextColor: "#000",
        primaryBorderColor: "#7cb37c",
        lineColor: "#333",
        textColor: "#333",
        fontSize: "16px",
    },
})

const MermaidComponent = ({ source }: { source: string }) => {
    const mermaidRef = useRef<HTMLDivElement>(null)
    const [renderError, setRenderError] = useState<string | null>(null)
    const [isRendering, setIsRendering] = useState(true)
    const id = useRef(uniqueId()).current

    useEffect(() => {
        // Don't attempt to render if source is empty
        if (!source || source.trim() === "") {
            setIsRendering(false)
            return
        }

        const renderDiagram = async () => {
            try {
                setIsRendering(true)

                if (!mermaidRef.current) return

                // Clear any previous content
                mermaidRef.current.innerHTML = ""

                // Generate a unique ID to avoid conflicts
                const diagramId = `mermaid-diagram-${id}`

                // Render the diagram
                const { svg } = await mermaid.render(diagramId, source)

                // Only update if the component is still mounted and ref exists
                if (mermaidRef.current) {
                    mermaidRef.current.innerHTML = svg
                }

                setRenderError(null)
            } catch (error) {
                console.error("Mermaid rendering failed:", error)

                // Handle missing diagram type error
                if (
                    String(error).includes("UnknownDiagramError") ||
                    String(error).includes("No diagram type detected")
                ) {
                    try {
                        // Try adding a flowchart declaration if none exists
                        const fixedSource = `flowchart TD\n${source}`
                        const { svg } = await mermaid.render(
                            `${id}-fixed`,
                            fixedSource
                        )

                        if (mermaidRef.current) {
                            mermaidRef.current.innerHTML = svg
                            setRenderError(null)
                        }
                    } catch (fixError) {
                        setRenderError(String(fixError))
                    }
                } else {
                    setRenderError(String(error))
                }
            } finally {
                setIsRendering(false)
            }
        }

        // Small delay to ensure component is fully mounted
        const timer = setTimeout(renderDiagram, 10)
        return () => clearTimeout(timer)
    }, [source, id])

    return (
        <div className="mermaid-container w-full my-4 mx-auto not-prose">
            {renderError && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3 text-sm">
                    <div className="text-yellow-700 font-medium mb-2">
                        Diagram rendering failed:
                    </div>
                    <pre className="bg-yellow-100 p-2 rounded overflow-auto text-xs text-black">
                        <code>{renderError}</code>
                    </pre>
                </div>
            )}

            {isRendering && (
                <div className="flex justify-center py-4">
                    <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
                </div>
            )}

            <div
                ref={mermaidRef}
                className="flex justify-center overflow-auto not-prose"
                style={{
                    minHeight: isRendering ? "0" : "auto",
                    opacity: isRendering ? 0 : 1,
                    transition: "opacity 0.2s ease-in-out",
                }}
            ></div>
        </div>
    )
}

export type MarkdownProps = {
    children: string
    id?: string
    className?: string
    components?: Partial<Components>
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
    const tokens = marked.lexer(markdown)
    return tokens.map((token) => token.raw)
}

function extractLanguage(className?: string): string {
    if (!className) return "plaintext"
    const match = className.match(/language-(\w+)/)
    return match ? match[1] : "plaintext"
}

const INITIAL_COMPONENTS: Partial<Components> = {
    code: function CodeComponent({ className, children, ...props }) {
        const isInline =
            !props.node?.position?.start.line ||
            props.node?.position?.start.line === props.node?.position?.end.line

        if (isInline) {
            return (
                <span
                    className={cn(
                        "bg-primary-foreground rounded-sm px-1 font-mono text-sm",
                        className
                    )}
                    {...props}
                >
                    {children}
                </span>
            )
        }

        const language = extractLanguage(className)

        // **Mermaid block**
        if (language === "mermaid") {
            const code = String(children).trim()
            // Wrap in a div to isolate from prose styles
            return (
                <div className="not-prose">
                    <MermaidComponent source={code} />
                </div>
            )
        }

        return (
            <CodeBlock className={className}>
                <CodeBlockCode code={children as string} language={language} />
            </CodeBlock>
        )
    },
    a: function AComponent({ children, href, ...props }) {
        const text = children?.toString() || ""

        // Parse the citation text with our utility function
        const citation = parseCitation(text)

        // If this is a citation link
        if (citation) {
            // For display, convert char location to page number if needed
            let displayPageNum = citation.position
            if (citation.isCharLocation) {
                displayPageNum = convertCharToPage(citation.position)
            }

            const displayText = `p.${displayPageNum}`

            const handleCitationClick = (e: React.MouseEvent) => {
                e.preventDefault()

                // Use our navigation utility
                navigateToLocation(citation)
            }

            return (
                <a
                    {...props}
                    onClick={handleCitationClick}
                    className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 text-sm rounded no-underline",
                        "bg-primary/10 text-primary border border-primary/20",
                        "hover:bg-primary/20 hover:border-primary/30 transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50",
                        "cursor-pointer"
                    )}
                >
                    <BookOpen size={12} className="text-primary" />
                    <span className="font-medium">{displayText}</span>
                </a>
            )
        }

        return (
            <a href={href} {...props}>
                {children}
            </a>
        )
    },
    pre: function PreComponent({ children }) {
        return <>{children}</>
    },
}

export function processKatexInMarkdown(markdown: string) {
    const markdownWithKatexSyntax = markdown
        .replace(/\\\\\[/g, "$$$$") // Replace '\\[' with '$$'
        .replace(/\\\\\]/g, "$$$$") // Replace '\\]' with '$$'
        .replace(/\\\\\(/g, "$$$$") // Replace '\\(' with '$$'
        .replace(/\\\\\)/g, "$$$$") // Replace '\\)' with '$$'
        .replace(/\\\[/g, "$$$$") // Replace '\[' with '$$'
        .replace(/\\\]/g, "$$$$") // Replace '\]' with '$$'
        .replace(/\\\(/g, "$$$$") // Replace '\(' with '$$'
        .replace(/\\\)/g, "$$$$") // Replace '\)' with '$$';
    return markdownWithKatexSyntax
}

const MemoizedMarkdownBlock = memo(
    function MarkdownBlock({
        content,
        components = INITIAL_COMPONENTS,
    }: {
        content: string
        components?: Partial<Components>
    }) {
        const markdownWithKatexSyntax = processKatexInMarkdown(content)

        return (
            <ReactMarkdown
                remarkPlugins={[
                    remarkGfm,
                    [remarkMath, { singleDollarTextMath: true }],
                ]}
                rehypePlugins={[
                    () => {
                        return rehypeKatex({ output: "htmlAndMathml" })
                    },
                ]}
                components={components}
            >
                {markdownWithKatexSyntax}
            </ReactMarkdown>
        )
    },
    function propsAreEqual(prevProps, nextProps) {
        return prevProps.content === nextProps.content
    }
)

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock"

function MarkdownComponent({
    children,
    id,
    className,
    components = INITIAL_COMPONENTS,
}: MarkdownProps) {
    const generatedId = useId()
    const blockId = id ?? generatedId
    const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children])

    return (
        <div className={className}>
            {blocks.map((block, index) => (
                <MemoizedMarkdownBlock
                    key={`${blockId}-block-${index}`}
                    content={block}
                    components={components}
                />
            ))}
        </div>
    )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
