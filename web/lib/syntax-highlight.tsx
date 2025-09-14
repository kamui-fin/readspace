import React from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import {
    oneDark,
    oneLight,
} from "react-syntax-highlighter/dist/cjs/styles/prism"

// Enhanced language detection function
function detectLanguage(code: string, className: string = ""): string {
    // First try to get language from class name
    const langMatch = className.match(/(?:language-|lang-)(\w+)/)
    if (langMatch) {
        const lang = langMatch[1].toLowerCase()
        // Map common aliases
        const langMap: Record<string, string> = {
            js: "javascript",
            ts: "typescript",
            py: "python",
            sh: "bash",
            shell: "bash",
            yml: "yaml",
            htm: "html",
            md: "markdown",
            c: "c",
            cpp: "cpp",
            "c++": "cpp",
            cs: "csharp",
            rb: "ruby",
            php: "php",
            go: "go",
            rs: "rust",
            kt: "kotlin",
            scala: "scala",
            swift: "swift",
            r: "r",
            sql: "sql",
            xml: "xml",
            json: "json",
        }
        return langMap[lang] || lang
    }

    // Fallback: try to detect language from code patterns
    const trimmedCode = code.trim().toLowerCase()

    // JavaScript/TypeScript patterns
    if (trimmedCode.includes('function') && trimmedCode.includes('{')) return 'javascript'
    if (trimmedCode.includes('const ') || trimmedCode.includes('let ') || trimmedCode.includes('var ')) return 'javascript'
    if (trimmedCode.includes('interface ') || trimmedCode.includes(': string') || trimmedCode.includes(': number')) return 'typescript'

    // Python patterns
    if (trimmedCode.includes('def ') || trimmedCode.includes('import ') || trimmedCode.includes('from ')) return 'python'
    if (trimmedCode.includes('print(') || trimmedCode.match(/^\s*#.*python/)) return 'python'

    // HTML patterns
    if (trimmedCode.includes('<html') || trimmedCode.includes('<!doctype')) return 'html'
    if (trimmedCode.match(/<[a-z]+[^>]*>/)) return 'html'

    // CSS patterns
    if (trimmedCode.includes('{') && trimmedCode.includes(':') && trimmedCode.includes(';')) return 'css'

    // JSON patterns
    if ((trimmedCode.startsWith('{') && trimmedCode.endsWith('}')) ||
        (trimmedCode.startsWith('[') && trimmedCode.endsWith(']'))) {
        try {
            JSON.parse(code)
            return 'json'
        } catch {}
    }

    // Shell/Bash patterns
    if (trimmedCode.startsWith('$') || trimmedCode.includes('#!/bin/bash') || trimmedCode.includes('#!/bin/sh')) return 'bash'
    if (trimmedCode.includes('sudo ') || trimmedCode.includes('chmod ') || trimmedCode.includes('mkdir ')) return 'bash'

    // SQL patterns
    if (trimmedCode.match(/\b(select|insert|update|delete|create|alter|drop)\b/i)) return 'sql'

    return "text"
}

export function processCodeBlocks(
    html: string,
    isDark: boolean = false
): React.ReactElement {
    if (typeof window === "undefined") {
        return <div dangerouslySetInnerHTML={{ __html: html }} />
    }

    try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, "text/html")

        return <ProcessedContent doc={doc} isDark={isDark} />
    } catch (error) {
        console.error("Error processing code blocks:", error)
        return <div dangerouslySetInnerHTML={{ __html: html }} />
    }
}

interface ProcessedContentProps {
    doc: Document
    isDark: boolean
}

function ProcessedContent({ doc, isDark }: ProcessedContentProps) {
    const processNode = (node: Node, index: number = 0): React.ReactNode => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element

            // Handle code blocks (pre > code)
            if (
                element.tagName === "PRE" &&
                element.firstElementChild?.tagName === "CODE"
            ) {
                const codeElement = element.firstElementChild
                const code = codeElement.textContent || ""

                if (code.trim()) {
                    const language = detectLanguage(code, codeElement.className)

                    return (
                        <SyntaxHighlighter
                            key={`code-block-${index}`}
                            language={language}
                            style={isDark ? oneDark : oneLight}
                            customStyle={{
                                margin: "1rem 0",
                                borderRadius: "6px",
                                fontSize: "0.875rem",
                                lineHeight: "1.5",
                            }}
                            wrapLongLines={true}
                            showLineNumbers={code.split('\n').length > 3}
                        >
                            {code}
                        </SyntaxHighlighter>
                    )
                }
            }

            // Handle standalone pre elements without code children
            if (element.tagName === "PRE" && !element.querySelector("code")) {
                const code = element.textContent || ""
                if (code.trim()) {
                    const language = detectLanguage(code, element.className)

                    return (
                        <SyntaxHighlighter
                            key={`pre-block-${index}`}
                            language={language}
                            style={isDark ? oneDark : oneLight}
                            customStyle={{
                                margin: "1rem 0",
                                borderRadius: "6px",
                                fontSize: "0.875rem",
                                lineHeight: "1.5",
                            }}
                            wrapLongLines={true}
                            showLineNumbers={code.split('\n').length > 3}
                        >
                            {code}
                        </SyntaxHighlighter>
                    )
                }
            }

            // Handle inline code
            if (element.tagName === "CODE" && element.parentElement?.tagName !== "PRE") {
                return (
                    <code
                        key={`inline-code-${index}`}
                        className="bg-muted px-1 py-0.5 rounded text-xs sm:text-sm break-words font-mono"
                    >
                        {element.textContent}
                    </code>
                )
            }

            // Process other elements recursively
            const children = Array.from(element.childNodes).map((child, childIndex) =>
                processNode(child, childIndex)
            ).filter(child => child !== null)

            if (children.length === 0 && !element.textContent?.trim()) {
                return null
            }

            const props: any = { key: `element-${index}` }

            // Copy important attributes
            for (let i = 0; i < element.attributes.length; i++) {
                const attr = element.attributes[i]
                if (attr.name === "class") {
                    props.className = attr.value
                } else if (attr.name.startsWith("data-") || attr.name === "id" || attr.name === "style") {
                    props[attr.name === "class" ? "className" : attr.name] = attr.value
                }
            }

            return React.createElement(
                element.tagName.toLowerCase(),
                props,
                ...children
            )
        }

        return null
    }

    const processedChildren = Array.from(doc.body.childNodes)
        .map((child, index) => processNode(child, index))
        .filter(child => child !== null)

    return <>{processedChildren}</>
}