import createDOMPurify, { type DOMPurify } from "dompurify"

let browserPurifier: DOMPurify | undefined

function getPurifier(): DOMPurify | null {
    if (typeof window === "undefined") return null
    if (typeof createDOMPurify.sanitize === "function") return createDOMPurify
    browserPurifier ||= createDOMPurify(window)
    return browserPurifier
}

const FORBIDDEN_TAGS = [
    "script",
    "style",
    "link",
    "meta",
    "base",
    "iframe",
    "frame",
    "frameset",
    "object",
    "embed",
    "applet",
    "form",
    "input",
    "button",
    "select",
    "option",
    "textarea",
]

/**
 * Treat saved article HTML as untrusted input.
 *
 * Classes and IDs are removed as well as inline styles: either can activate
 * application CSS (including Tailwind utilities such as `fixed` and `z-50`)
 * and let an article escape the reader surface. The one class Readspace owns
 * is retained for generated highlights.
 */
export function sanitizeArticleHtml(html: string): string {
    if (!html) return ""
    const purifier = getPurifier()
    if (!purifier) return ""

    purifier.addHook("afterSanitizeAttributes", (node) => {
        if (node.nodeType === 1) {
            const element = node as Element
            const isHighlight =
                element.tagName === "MARK" &&
                element.classList.contains("rs-highlight")

            element.removeAttribute("id")
            element.removeAttribute("style")
            element.removeAttribute("class")

            if (isHighlight) {
                element.className = "rs-highlight"
            } else {
                element.removeAttribute("data-rank")
            }

            if (element.getAttribute("target") === "_blank") {
                element.setAttribute("rel", "noopener noreferrer")
            }
        }
    })

    try {
        return purifier.sanitize(html, {
            FORBID_TAGS: FORBIDDEN_TAGS,
            FORBID_ATTR: ["style", "srcdoc"],
            ADD_ATTR: ["target", "data-rank"],
            ALLOW_DATA_ATTR: false,
        })
    } finally {
        purifier.removeHook("afterSanitizeAttributes")
    }
}
