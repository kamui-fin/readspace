import { NavItem } from "epubjs"

export function getTopVisibleElement(): Element | null {
    const container = document.querySelector("#epub-container")
    if (!container) return null

    // Select all potential text-containing elements
    const textElements = container.querySelectorAll(
        "p, h1, h2, h3, h4, h5, h6, div, span, li, a, figcaption, blockquote, cite"
    )

    // Convert to array and filter elements with actual text content
    const elements = Array.from(textElements).filter((element) => {
        return element.textContent && element.textContent.trim().length > 0
    })

    // Filter out elements that have any descendants in the list
    const filteredElements = elements.filter((element) => {
        return !elements.some(
            (other) => element !== other && element.contains(other)
        )
    })

    let topmostElement: Element | null = null
    let topmostPosition = Infinity

    filteredElements.forEach((element) => {
        const rect = element.getBoundingClientRect()

        if (
            rect.bottom > 0 &&
            rect.bottom <= window.innerHeight &&
            rect.top < topmostPosition
        ) {
            topmostElement = element
            topmostPosition = rect.top
        }
    })

    return topmostElement
}

export const stripMetaBaseLinkTags = (htmlString: string): string => {
    const parser = new DOMParser()

    const doc = parser.parseFromString(htmlString, "text/html")

    doc.querySelectorAll(
        "meta, base, link, title, script, style, noscript, template"
    ).forEach((tag) => tag.remove())

    const serializer = new XMLSerializer()
    return serializer.serializeToString(doc)
}

export const normalizeWhitespace = (text: string): string => {
    return text.replace(/\s+/g, " ").trim()
}

export function insertCharCountAttributes(
    htmlString: string,
    totalNumChars: number,
    prevChapterCharCount: number
): { html: string; pageMap: Record<number, string> } {
    // Convert the string to a Document using DOMParser
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlString, "text/html")
    const body = doc.body

    // Global counter tracking the cumulative number of characters encountered so far
    let charCount = 0
    let lastElement: Element | null = null

    // Page mapping based on character count (page = char / 2300)
    const PAGE_SIZE = 2300
    const pageMap: Record<number, string> = {}
    let currentPageNum = Math.floor(prevChapterCharCount / PAGE_SIZE) + 1
    let currentPageText = ""

    // Recursive function that traverses nodes in document order.
    // For element nodes, set the "data-char-count" to the current cumulative count before
    // processing its children. For text nodes, update the counter.
    const traverse = (node: Node): void => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            // Record the cumulative count up to (but not including) this element's content.
            const element = node as Element
            element.setAttribute("data-char-count", String(charCount))
            lastElement = element

            // Count <br> tags as newline characters
            if (element.tagName.toLowerCase() === "br") {
                charCount += 1
                currentPageText += "\n"

                // Check if we've crossed a page boundary
                const newPageNum =
                    Math.floor((charCount + prevChapterCharCount) / PAGE_SIZE) +
                    1
                if (newPageNum > currentPageNum) {
                    pageMap[currentPageNum] = currentPageText
                    currentPageText = ""
                    currentPageNum = newPageNum
                }
            }

            // Then process all children in order.
            node.childNodes.forEach((child) => traverse(child))
        } else if (node.nodeType === Node.TEXT_NODE) {
            // Update the count with the length of the text (if any)
            if (node.textContent) {
                const normalizedText = normalizeWhitespace(node.textContent)
                charCount += normalizedText.length
                currentPageText += normalizedText

                // Check if we've crossed a page boundary
                const newPageNum =
                    Math.floor((charCount + prevChapterCharCount) / PAGE_SIZE) +
                    1
                if (newPageNum > currentPageNum) {
                    pageMap[currentPageNum] = currentPageText
                    currentPageText = ""
                    currentPageNum = newPageNum
                }
            }
        }
        // Other node types (comments, etc.) are ignored
    }

    // Process all child nodes of body. (If using a fragment wrapped in body)
    body.childNodes.forEach((child) => traverse(child))

    // Set the last node's data attribute to totalNumChars
    if (lastElement != null) {
        ;(lastElement as Element).setAttribute(
            "data-char-count",
            String(totalNumChars)
        )
    }

    // Save the last page
    if (currentPageText) {
        pageMap[currentPageNum] = currentPageText
    }

    // Return the resulting HTML string and the page map.
    return {
        html: body.innerHTML,
        pageMap,
    }
}

export const generateElementSelector = (
    el: Element,
    noVerify: boolean = true
): string | false => {
    // Store the original element if verification is enabled
    const origElem = el

    if (!el) {
        console.error("No element provided")
        return false
    }

    const stack: string[] = []
    let nearestElemWithId: string | null = null

    let sibParent: ParentNode | null
    let sibSiblings: Element[]

    do {
        let sibCount = 0
        let sibIndex = 0
        sibParent = el.parentNode
        sibSiblings = sibParent ? Array.from(sibParent.children) : []

        // Filter siblings with the same node name
        sibSiblings = sibSiblings.filter(
            (sibElem) => el.nodeName === sibElem.nodeName
        )

        // Iterate over the siblings to get the index
        if (sibSiblings.length > 0) {
            for (let i = 0; i < sibSiblings.length; i++) {
                const sib = sibSiblings[i]
                sibCount++

                if (sib === el) {
                    sibIndex = sibCount
                    break
                }
            }
        }

        // If the element has an ID, use it in the path
        if (el.hasAttribute("id") && el.id !== "") {
            nearestElemWithId = el.id

            // Handle IDs that start with a number
            if (/^[0-9]/.test(el.id)) {
                stack.unshift(`[id="${el.id}"]`)
            } else {
                stack.unshift(`#${el.id}`)
            }
        }

        // If there are multiple siblings, use nth-of-type
        else if (sibCount > 1) {
            stack.unshift(
                `${el.nodeName.toLowerCase()}:nth-of-type(${sibIndex})`
            )
        }

        // Otherwise, just use the node name
        else {
            stack.unshift(el.nodeName.toLowerCase())
        }

        // Move up to the parent element
        el = sibParent as Element
        if (el === null) break
    } while (
        sibParent?.nodeType === Node.ELEMENT_NODE &&
        nearestElemWithId === null
    )

    // Remove the 'html' element from the stack if it exists
    if (stack[0] === "html") {
        stack.shift()
    }

    const result = stack.join(" > ")

    // Skip verification if noVerify is true
    if (noVerify) {
        return result
    }

    // Verify the result by querying the DOM
    let selectionFromResult: Element | null

    try {
        selectionFromResult = document.querySelector(result)
    } catch (err) {
        console.error(
            `Encountered an exception when trying to verify querySelector(${result})\n\tError:`,
            err
        )
        return false
    }

    // If no element is found, return false
    if (!selectionFromResult) {
        console.error(
            `Failed to find any element using querySelector(${result})`
        )
        return false
    }

    // If the found element is not the same as the original, return false
    if (!origElem.isSameNode(selectionFromResult)) {
        console.error(
            `Element returned from querySelector(${result}) is not the same as the element provided`
        )
        return false
    }

    // If everything checks out, return the path
    return result
}

// buildTocByHref builds a map of href to NavItem for the given TOC.
export function buildTocByHref(toc: NavItem[]): Record<string, NavItem> {
    const tocByHref: Record<string, NavItem> = {}

    const dfs = (items: NavItem[]) => {
        items.forEach((item) => {
            tocByHref[item.href] = item
            if (item.subitems) {
                dfs(item.subitems)
            }
        })
    }

    dfs(toc)

    return tocByHref
}

/**
 * Given a Section from epubBook.spine.get and the epubBook instance, this function
 * returns the matching TOC item by using epubBook.navigation.tocByHref to get an index
 * into epubBook.navigation.toc.
 *
 * If no matching TOC entry is found for the current section.href, it decrements the
 * section index and tries again until a matching title is found or index becomes negative.
 *
 * @param sectionHref - The section from epubBook.spine.get with properties href and index.
 * @param epubBook - The instance of the epub book.
 * @returns The matching NavItem from the TOC or undefined if not found.
 */
export function getTocItemForSection(
    section: { href: string; index: number },
    epubBook: ePub.Book
): NavItem | undefined {
    const tocByHref = buildTocByHref(epubBook.navigation.toc)

    let currentSection = section
    let currentIdx = currentSection.index

    while (currentIdx >= 0) {
        const tocItem = tocByHref[currentSection.href]

        if (tocItem !== undefined) {
            return tocItem
        }

        currentIdx--
        const possibleSection = epubBook.spine.get(currentIdx)
        if (!possibleSection) break
        currentSection = possibleSection
    }

    return undefined
}

/**
 * Finds the DOM element closest to the given character location in the current chapter
 * by searching for elements with data-char-count attributes.
 *
 * @param charLocation - The target character location to find
 * @param containerSelector - Optional selector for the container (defaults to "#epub-container")
 * @returns The DOM element with the closest data-char-count, or null if not found
 */
export function findElementByCharLocation(
    charLocation: number,
    containerSelector: string = "#epub-container"
): Element | null {
    const container = document.querySelector(containerSelector)
    if (!container) return null

    // Get all elements with data-char-count attribute
    const elements = Array.from(container.querySelectorAll("[data-char-count]"))

    if (elements.length === 0) return null

    // Convert attribute values to numbers and find closest match
    let closestElement: Element | null = null
    let minDifference = Infinity

    elements.forEach((element) => {
        const charCount = parseInt(
            element.getAttribute("data-char-count") || "0",
            10
        )
        const difference = Math.abs(charCount - charLocation)

        if (difference < minDifference) {
            minDifference = difference
            closestElement = element
        }
    })

    return closestElement
}

/**
 * Scrolls to an element that most closely matches the given character location
 * in the current chapter.
 *
 * @param charLocation - The target character location to navigate to
 * @param container - Optional container selector (defaults to "#epub-container")
 * @param behavior - Optional scroll behavior (defaults to "smooth")
 * @returns True if successful, false otherwise
 */
export function scrollToCharLocation(
    charLocation: number,
    container: string = "#epub-container",
    behavior: ScrollBehavior = "smooth"
): boolean {
    const element = findElementByCharLocation(charLocation, container)

    if (!element) return false

    // Scroll the element into view
    element.scrollIntoView({ behavior, block: "center" })

    // Optionally highlight the element temporarily
    const htmlElement = element as HTMLElement
    const originalBackground = htmlElement.style.backgroundColor
    htmlElement.style.backgroundColor = "rgba(255, 255, 0, 0.3)"

    // Remove highlight after a short delay
    setTimeout(() => {
        htmlElement.style.backgroundColor = originalBackground
    }, 2000)

    return true
}

/**
 * Determines which chapter contains a given global character location
 * by analyzing the chapter character counts.
 *
 * @param globalCharLocation - The global character location in the book
 * @param chapterCharCounts - Array of character counts for each chapter
 * @returns The index of the chapter containing the character location, or -1 if not found
 */
export function findChapterByCharLocation(
    globalCharLocation: number,
    chapterCharCounts: number[]
): number {
    if (!chapterCharCounts || chapterCharCounts.length === 0) return -1

    let cumulativeCount = 0

    for (let i = 0; i < chapterCharCounts.length; i++) {
        const nextCumulativeCount = cumulativeCount + chapterCharCounts[i]

        // If the location is within this chapter's range
        if (
            globalCharLocation >= cumulativeCount &&
            globalCharLocation < nextCumulativeCount
        ) {
            return i
        }

        cumulativeCount = nextCumulativeCount
    }

    // If we've gone through all chapters and still haven't found it,
    // return the last chapter if the location is beyond the end
    if (globalCharLocation >= cumulativeCount) {
        return chapterCharCounts.length - 1
    }

    return -1
}
