import {
    generateOPMLContent,
    opmlExportFilename,
    type FeedForOPML,
    type Folder,
} from "@readspace/shared"

export { generateOPMLContent, type FeedForOPML }

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
    const finalFilename = filename || opmlExportFilename()
    downloadFile(opmlContent, finalFilename, "application/xml")
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
