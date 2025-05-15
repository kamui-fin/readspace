export function highlightRange(
    range: Range,
    tagName: string = "mark",
    attributes: Record<string, string> = {},
    onClick?: (markElm: HTMLElement) => void
): () => void {
    if (range.collapsed) return () => {}

    const nodes = textNodesInRange(range)
    const highlightElements: HTMLElement[] = []

    for (const node of nodes) {
        const highlightElement = wrapNodeInHighlight(
            node,
            tagName,
            attributes,
            onClick
        )
        highlightElements.push(highlightElement)
    }

    return function removeHighlights() {
        for (const highlightElement of highlightElements) {
            removeHighlight(highlightElement)
        }
    }
}

export function textNodesInRange(range: Range): Text[] {
    if (
        range.startContainer.nodeType === Node.TEXT_NODE &&
        range.startOffset > 0
    ) {
        const endOffset = range.endOffset
        const createdNode = (range.startContainer as Text).splitText(
            range.startOffset
        )
        if (range.endContainer === range.startContainer) {
            range.setEnd(createdNode, endOffset - range.startOffset)
        }
        range.setStart(createdNode, 0)
    }
    if (
        range.endContainer.nodeType === Node.TEXT_NODE &&
        range.endOffset < (range.endContainer as Text).length
    ) {
        ;(range.endContainer as Text).splitText(range.endOffset)
    }

    const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) =>
                range.intersectsNode(node)
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT,
        }
    )
    walker.currentNode = range.startContainer

    const nodes: Text[] = []
    if (walker.currentNode.nodeType === Node.TEXT_NODE)
        nodes.push(walker.currentNode as Text)
    while (
        walker.nextNode() &&
        range.comparePoint(walker.currentNode, 0) !== 1
    ) {
        nodes.push(walker.currentNode as Text)
    }
    return nodes
}

function wrapNodeInHighlight(
    node: Text,
    tagName: string,
    attributes: Record<string, string>,
    onClick?: (markElm: HTMLElement) => void
): HTMLElement {
    const highlightElement = document.createElement(tagName)
    Object.entries(attributes).forEach(([key, value]) => {
        highlightElement.setAttribute(key, value)
    })
    if (onClick) {
        highlightElement.addEventListener("click", () =>
            onClick(highlightElement)
        )
    }

    const tempRange = document.createRange()
    tempRange.selectNode(node)
    tempRange.surroundContents(highlightElement)

    return highlightElement
}

function removeHighlight(highlightElement: HTMLElement): void {
    if (highlightElement.childNodes.length === 1) {
        highlightElement.replaceWith(highlightElement.firstChild!)
    } else {
        while (highlightElement.firstChild) {
            highlightElement.parentNode?.insertBefore(
                highlightElement.firstChild,
                highlightElement
            )
        }
        highlightElement.remove()
    }
}
