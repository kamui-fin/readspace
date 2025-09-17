/**
 * Download content as a file using browser APIs
 */
export function downloadFile(content: string, filename: string, mimeType: string = "text/plain"): void {
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