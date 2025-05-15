import { SerializedRange } from "@/types/library"

export function serializeRange(range: Range, container: Node): SerializedRange {
    const output = {
        startContainerPath: getNodePath(range.startContainer, container),
        startOffset: range.startOffset,
        endContainerPath: getNodePath(range.endContainer, container),
        endOffset: range.endOffset,
    }

    return output
}

function getNodePath(node: Node | null, container: Node): number[] {
    const path: number[] = []
    let currentNode: Node | null = node

    while (currentNode && currentNode !== container) {
        const parent: Node | null = currentNode.parentNode
        if (!parent) break

        const children = Array.from(parent.childNodes)
        const index = children.indexOf(currentNode as ChildNode)
        if (index === -1) break

        path.unshift(index)
        currentNode = parent
    }

    return path
}

export function deserializeRange(
    serialized: SerializedRange,
    container: Node
): Range | null {
    const range = document.createRange()
    const startContainer = resolveNodePath(
        serialized.startContainerPath,
        container
    )
    const endContainer = resolveNodePath(serialized.endContainerPath, container)

    try {
        if (startContainer && endContainer) {
            // Validate offsets before setting the range
            const startOffset = Math.min(
                serialized.startOffset,
                getMaxOffset(startContainer)
            )
            const endOffset = Math.min(
                serialized.endOffset,
                getMaxOffset(endContainer)
            )

            range.setStart(startContainer, startOffset)
            range.setEnd(endContainer, endOffset)
        }

        return range
    } catch (e) {
        console.error("Failed to deserialize range", e)
        return null
    }
}

// Helper function to get the maximum valid offset for a node
function getMaxOffset(node: Node): number {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent?.length || 0
    } else {
        return node.childNodes.length
    }
}

function resolveNodePath(path: number[], container: Node): Node | null {
    let node: Node = container
    for (const index of path) {
        if (index < 0 || index >= node.childNodes.length) return null
        node = node.childNodes[index]
    }
    return node
}

export function scrollToRange(range: Range) {
    // Get the bounding rectangle of the range
    const rect = range.getBoundingClientRect()

    // Calculate the position to scroll to
    const scrollTop = window.scrollY + rect.top - window.innerHeight / 2

    // Scroll to the position
    window.scrollTo({
        top: scrollTop,
        behavior: "smooth",
    })
}
