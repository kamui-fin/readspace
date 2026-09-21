import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { JSDOM } from "jsdom"

import { sanitizeArticleHtml } from "./sanitize-article-html"

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
let dom: JSDOM

beforeAll(() => {
    dom = new JSDOM("<!doctype html><html><body></body></html>")
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: dom.window,
    })
})

afterAll(() => {
    dom.window.close()
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow)
    else Reflect.deleteProperty(globalThis, "window")
})

describe("sanitizeArticleHtml", () => {
    it("prevents saved page chrome from taking over the reader", () => {
        const html = `
            <style>body { display: none }</style>
            <link rel="stylesheet" href="https://attacker.test/site.css">
            <section id="header-menu" class="fixed inset-0 z-50" style="position: fixed; inset: 0">
                Overlay text
            </section>
            <script>alert(document.cookie)</script>
            <img src="bad" onerror="alert(document.cookie)">
            <form action="https://attacker.test"><input name="secret"></form>
        `

        const sanitized = sanitizeArticleHtml(html)

        expect(sanitized).toContain("Overlay text")
        expect(sanitized).not.toMatch(/<(?:style|link|script|form|input)\b/i)
        expect(sanitized).not.toMatch(/\s(?:style|class|id|onerror)=/i)
    })

    it("keeps article markup and only the class owned by highlights", () => {
        const sanitized = sanitizeArticleHtml(`
            <h2 class="fixed">Heading</h2>
            <p>Body <a href="https://example.com" target="_blank">link</a></p>
            <mark class="rs-highlight fixed" data-rank="2">important</mark>
            <a href="javascript:alert(1)">unsafe</a>
        `)

        expect(sanitized).toContain("<h2>Heading</h2>")
        expect(sanitized).toContain('href="https://example.com"')
        expect(sanitized).toContain('rel="noopener noreferrer"')
        expect(sanitized).toMatch(
            /<mark(?=[^>]*class="rs-highlight")(?=[^>]*data-rank="2")[^>]*>important<\/mark>/
        )
        expect(sanitized).not.toContain("javascript:")
        expect(sanitized).not.toContain("fixed")
    })
})
