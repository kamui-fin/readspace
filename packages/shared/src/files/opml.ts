import type { Feed, Folder } from "../api/types/rss.js"

interface FeedForOPML {
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
    const now = new Date()
    const dateString = now.toUTCString()

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

    let opmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Readspace Feeds Export</title>
        <dateCreated>${dateString}</dateCreated>
    </head>
    <body>
`

    // Add feeds grouped by folders
    for (const [folderName, folderFeeds] of foldersMap) {
        if (foldersMap.size > 1 || folderName !== "Uncategorized") {
            opmlContent += `        <outline text="${folderName}" title="${folderName}">
`
            folderFeeds.forEach((feed) => {
                const title = feed.title || feed.url
                const htmlUrl = feed.link || feed.url
                opmlContent += `            <outline text="${title}" title="${title}" type="rss" xmlUrl="${feed.url}" htmlUrl="${htmlUrl}"/>
`
            })
            opmlContent += `        </outline>
`
        } else {
            // Put feeds directly in body if only uncategorized
            folderFeeds.forEach((feed) => {
                const title = feed.title || feed.url
                const htmlUrl = feed.link || feed.url
                opmlContent += `        <outline text="${title}" title="${title}" type="rss" xmlUrl="${feed.url}" htmlUrl="${htmlUrl}"/>
`
            })
        }
    }

    opmlContent += `    </body>
</opml>`

    return opmlContent
}

/**
 * Export feeds to OPML format and download
 */
export function exportFeedsToOPML(
    feeds: Feed[],
    folders: Folder[],
    filename?: string
): void {
    // Convert Feed to FeedForOPML format
    const feedsForOPML: FeedForOPML[] = feeds.map(feed => ({
        url: feed.url,
        title: feed.title,
        link: feed.link,
        folder_id: feed.folder_id,
    }))
    const opmlContent = generateOPMLContent(feedsForOPML, folders)

    // Import dynamically to avoid issues in non-browser environments
    import('./download').then(({ downloadOPML }) => {
        downloadOPML(opmlContent, filename)
    })
}