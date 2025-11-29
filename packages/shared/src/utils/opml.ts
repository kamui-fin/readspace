import { generateOpml, parseOpml } from "feedsmith"
import type { Opml } from "feedsmith/types"

export { generateOpml, parseOpml }
export type { Opml }

/**
 * Helper to visit all nodes in an OPML structure
 */
export function visitAll(
    outlines: Opml.Outline<string>[],
    cb: (node: Opml.Outline<string>) => boolean
): void {
    const walk = (nodes: Opml.Outline<string>[]): boolean => {
        for (const node of nodes) {
            if (!cb(node)) return false
            if (node.outlines && node.outlines.length > 0) {
                if (!walk(node.outlines)) return false
            }
        }
        return true
    }
    walk(outlines)
}

export interface OpmlValidationResult {
    isValid: boolean
    feedCount: number
    hasNestedCategories: boolean
    error?: string
}

export async function validateOpml(file: File): Promise<OpmlValidationResult> {
    try {
        const content = await file.text()

        // Check if this is an RSS/Atom feed instead of OPML
        const contentLower = content.toLowerCase().trim()
        if (
            contentLower.includes("<rss") ||
            contentLower.includes("<feed") ||
            (contentLower.includes("<channel>") &&
                !contentLower.includes("<opml"))
        ) {
            return {
                isValid: false,
                feedCount: 0,
                hasNestedCategories: false,
                error: "This appears to be an RSS/Atom feed file, not an OPML file. OPML files contain lists of feeds, while RSS/Atom files contain actual feed content. Please export your feed list as OPML from your RSS reader.",
            }
        }

        const parsedOpml = parseOpml(content)

        if (!parsedOpml || !parsedOpml.body) {
            return {
                isValid: false,
                feedCount: 0,
                hasNestedCategories: false,
                error: "Invalid OPML format: This doesn't appear to be a valid OPML file. Please check that you've exported the correct file from your RSS reader.",
            }
        }

        let feedCount = 0
        let hasNestedCategories = false
        const existingUrls = new Set<string>()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const countFeeds = (
            outlines: Array<{ xmlUrl?: string; outlines?: any[] }>,
            level = 0
        ) => {
            if (level > 1) {
                hasNestedCategories = true
            }

            for (const outline of outlines || []) {
                if (outline.xmlUrl) {
                    if (!existingUrls.has(outline.xmlUrl)) {
                        feedCount++
                        existingUrls.add(outline.xmlUrl)
                    }
                } else if (outline.outlines) {
                    countFeeds(outline.outlines, level + 1)
                }
            }
        }

        countFeeds(parsedOpml.body.outlines ?? [])

        return {
            isValid: feedCount > 0,
            feedCount,
            hasNestedCategories,
            error:
                feedCount === 0
                    ? "No valid RSS feeds found in OPML file"
                    : undefined,
        }
    } catch (error) {
        return {
            isValid: false,
            feedCount: 0,
            hasNestedCategories: false,
            error: `Failed to parse OPML file: ${error instanceof Error ? error.message : "Unknown error"}`,
        }
    }
}
