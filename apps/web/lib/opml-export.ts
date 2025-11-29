import { generateOpml, type Opml } from "@readspace/shared"
import type { Folder } from "@readspace/shared"

/**
 * Download content as a file using browser APIs
 */
export function downloadFile(
    content: string,
    filename: string,
    mimeType: string = "text/plain"
): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

/**
 * Download OPML content as a file
 */
export function downloadOPML(opmlContent: string, filename?: string): void {
    const timestamp = new Date().toISOString().split("T")[0]
    const finalFilename = filename || `readspace-feeds-${timestamp}.opml`
    downloadFile(opmlContent, finalFilename, "application/xml")
}

export interface FeedForOPML {
    url: string
    title?: string | null
    link?: string | null
    folder_id?: string | null
}

/**
 * Generate OPML content from feeds and folders
 */
export function generateOPMLContent(
    feedsToExport: FeedForOPML[],
    folders: Folder[]
): string {
    // Group feeds by folder
    const foldersMap = new Map<string, FeedForOPML[]>()

    feedsToExport.forEach((feed) => {
        const folderName =
            folders.find((f) => f.id === feed.folder_id)?.name ||
            "Uncategorized"
        if (!foldersMap.has(folderName)) {
            foldersMap.set(folderName, [])
        }
        foldersMap.get(folderName)!.push(feed)
    })

    const outlines: Opml.Outline<Date>[] = []

    // Add feeds grouped by folders
    for (const [folderName, folderFeeds] of foldersMap) {
        if (foldersMap.size > 1 || folderName !== "Uncategorized") {
            const folderOutline: Opml.Outline<Date> = {
                text: folderName,
                title: folderName,
                outlines: folderFeeds.map((feed) => ({
                    text: feed.title || feed.url,
                    title: feed.title || feed.url,
                    type: "rss",
                    xmlUrl: feed.url,
                    htmlUrl: feed.link || undefined,
                })),
            }
            outlines.push(folderOutline)
        } else {
            // Put feeds directly in body if only uncategorized
            folderFeeds.forEach((feed) => {
                outlines.push({
                    text: feed.title || feed.url,
                    title: feed.title || feed.url,
                    type: "rss",
                    xmlUrl: feed.url,
                    htmlUrl: feed.link || undefined,
                })
            })
        }
    }

    return generateOpml({
        head: {
            title: "Readspace Feeds Export",
            dateCreated: new Date(),
        },
        body: {
            outlines,
        },
    })
}

/**
 * Export feeds to OPML format and download
 */
export function exportFeedsToOPML(
    feeds: FeedForOPML[],
    folders: Folder[],
    filename?: string
): void {
    // Convert Feed to FeedForOPML format
    const feedsForOPML: FeedForOPML[] = feeds.map((feed) => ({
        url: feed.url,
        title: feed.title,
        link: feed.link,
        folder_id: feed.folder_id,
    }))
    const opmlContent = generateOPMLContent(feedsForOPML, folders)

    downloadOPML(opmlContent, filename)
}
