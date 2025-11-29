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
