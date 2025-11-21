// ---------------------------------------------
// Types
// ---------------------------------------------

export interface OutlineNode {
    text?: string
    [key: string]: any
    subs?: OutlineNode[]
}

export interface OpmlStructure {
    opml: {
        head: Record<string, string>
        body: OutlineNode
    }
}

// ---------------------------------------------
// Helpers
// ---------------------------------------------

function filledString(ch: string, ct: number): string {
    return ch.repeat(ct)
}

function encodeXml(s: any): string {
    if (s === undefined || s === null) return ""

    const charMap: Record<string, string> = {
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
    }

    return s
        .toString()
        .replace(/\u00A0/g, " ")
        .replace(/[<>&"]/g, (ch: string) => charMap[ch] ?? ch)
}

function xmlParse(xml: string): Document {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, "application/xml")
    const error = doc.querySelector("parsererror")
    if (error) throw new Error("Invalid XML: " + error.textContent)
    return doc
}

function getAttributes(el: Element): Record<string, string> {
    const out: Record<string, string> = {}
    for (const att of Array.from(el.attributes)) {
        out[att.name] = att.value
    }
    return out
}

function outlineToJson(el: Element): OutlineNode {
    const node: OutlineNode = { ...getAttributes(el) }

    const children = Array.from(el.children).filter(
        (c) => c.tagName.toLowerCase() === "outline"
    )

    if (children.length) {
        node.subs = children.map((child) => outlineToJson(child))
    }

    return node
}

// ---------------------------------------------
// OPML → JSON
// ---------------------------------------------

export function opmlParse(opml: string): OpmlStructure {
    const doc = xmlParse(opml)

    const head = doc.querySelector("head")
    const body = doc.querySelector("body")

    if (!head || !body) throw new Error("Invalid OPML structure.")

    const headValues: Record<string, string> = {}
    Array.from(head.children).forEach((el) => {
        headValues[el.tagName] = el.textContent || ""
    })

    return {
        opml: {
            head: headValues,
            body: outlineToJson(body),
        },
    }
}

// ---------------------------------------------
// JSON → OPML
// ---------------------------------------------

export function opmlStringify(struct: OpmlStructure): string {
    let xml = ""
    let indent = 0

    const add = (s: string) => {
        xml += filledString("\t", indent) + s + "\n"
    }

    const addSubs = (subs?: OutlineNode[]) => {
        if (!subs) return

        for (const sub of subs) {
            let atts = ""
            for (const [k, v] of Object.entries(sub)) {
                if (k !== "subs") {
                    atts += ` ${k}="${encodeXml(v)}"`
                }
            }
            if (!sub.subs) {
                add(`<outline${atts} />`)
            } else {
                add(`<outline${atts}>`)
                indent++
                addSubs(sub.subs)
                indent--
                add(`</outline>`)
            }
        }
    }

    add(`<?xml version="1.0"?>`)
    add(`<opml version="2.0">`)
    indent++

    add(`<head>`)
    indent++
    for (const [k, v] of Object.entries(struct.opml.head)) {
        add(`<${k}>${encodeXml(v)}</${k}>`)
    }
    indent--
    add(`</head>`)

    add(`<body>`)
    indent++
    addSubs(struct.opml.body.subs)
    indent--
    add(`</body>`)

    indent--
    add(`</opml>`)

    return xml
}

// ---------------------------------------------
// Outline → HTML
// ---------------------------------------------

export function getOutlineHtml(struct: OpmlStructure): string {
    let html = ""
    let indent = 0

    const add = (s: string) => {
        html += filledString("\t", indent) + s + "\n"
    }

    const addSubs = (node: OutlineNode) => {
        add("<ul>")
        indent++

        node.subs?.forEach((sub) => {
            add(`<li>${encodeXml(sub.text ?? "")}</li>`)
            if (sub.subs) addSubs(sub)
        })

        indent--
        add("</ul>")
    }

    addSubs(struct.opml.body)
    return html
}

// ---------------------------------------------
// visitAll
// ---------------------------------------------

export function visitAll(
    struct: OpmlStructure,
    cb: (node: OutlineNode) => boolean
): void {
    const walk = (node: OutlineNode): boolean => {
        if (!node.subs) return true
        for (const sub of node.subs) {
            if (!cb(sub)) return false
            if (!walk(sub)) return false
        }
        return true
    }
    walk(struct.opml.body)
}

// ---------------------------------------------
// Export object (same API)
// ---------------------------------------------

export const opml = {
    parse: opmlParse,
    stringify: opmlStringify,
    htmlify: getOutlineHtml,
    visitAll,
}
