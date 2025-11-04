import { XMLParser } from 'fast-xml-parser';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

export interface OPMLValidationResult {
    isValid: boolean;
    feedCount: number;
    hasNestedCategories: boolean;
    error?: string;
}

interface OpmlOutline {
    xmlUrl?: string;
    subs?: OpmlOutline[];
    [key: string]: unknown;
}

interface Feed {
    url: string;
    title?: string | null;
    link?: string | null;
    folder_id?: string | null;
}

interface Folder {
    id: string;
    name: string;
}

/**
 * Validates an OPML file by parsing it and checking for common issues
 * @param fileContent - The OPML file content as a string
 * @returns Validation result with feed count and any errors
 */
export async function validateOPMLFile(fileContent: string): Promise<OPMLValidationResult> {
    try {
        // Check if this is an RSS/Atom feed instead of OPML
        const contentLower = fileContent.toLowerCase().trim();
        if (
            contentLower.includes('<rss') ||
            contentLower.includes('<feed') ||
            (contentLower.includes('<channel>') && !contentLower.includes('<opml'))
        ) {
            return {
                isValid: false,
                feedCount: 0,
                hasNestedCategories: false,
                error: 'This appears to be an RSS/Atom feed file, not an OPML file. OPML files contain lists of feeds, while RSS/Atom files contain actual feed content. Please export your feed list as OPML from your RSS reader.',
            };
        }

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            isArray: (name) => name === 'outline',
        });
        const parsedOpml = parser.parse(fileContent);

        if (!parsedOpml || !parsedOpml.opml || !parsedOpml.opml.body) {
            return {
                isValid: false,
                feedCount: 0,
                hasNestedCategories: false,
                error: "Invalid OPML format: This doesn't appear to be a valid OPML file. Please check that you've exported the correct file from your RSS reader.",
            };
        }

        let feedCount = 0;
        let hasNestedCategories = false;
        const existingUrls = new Set<string>();

        const countFeeds = (outlines: any, level = 0) => {
            if (level > 1) {
                hasNestedCategories = true;
            }

            // Handle both array and single outline cases
            const outlinesArray = Array.isArray(outlines) ? outlines : [outlines];

            for (const outline of outlinesArray || []) {
                if (!outline) continue;

                // Check for xmlUrl attribute (feed entry)
                const xmlUrl = outline['@_xmlUrl'] || outline.xmlUrl;
                if (xmlUrl) {
                    if (!existingUrls.has(xmlUrl)) {
                        feedCount++;
                        existingUrls.add(xmlUrl);
                    }
                }

                // Recursively check nested outlines
                if (outline.outline) {
                    countFeeds(outline.outline, level + 1);
                }
            }
        };

        // Handle body.outline which could be array or single object
        const bodyOutlines = parsedOpml.opml.body.outline;
        if (bodyOutlines) {
            countFeeds(bodyOutlines);
        }

        return {
            isValid: feedCount > 0,
            feedCount,
            hasNestedCategories,
            error: feedCount === 0 ? 'No valid RSS feeds found in OPML file' : undefined,
        };
    } catch (error) {
        return {
            isValid: false,
            feedCount: 0,
            hasNestedCategories: false,
            error: `Failed to parse OPML file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Reads a file URI and returns its content as a string
 * @param uri - The file URI from DocumentPicker
 * @returns The file content as a string
 */
export async function readFileContent(uri: string): Promise<string> {
    try {
        const response = await fetch(uri);
        const content = await response.text();
        return content;
    } catch (error) {
        throw new Error(
            `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

/**
 * Generate OPML content from feeds and folders
 * @param feeds - Array of feeds to export
 * @param folders - Array of folders to organize feeds
 * @returns OPML XML content as a string
 */
export function generateOPMLContent(feeds: Feed[], folders: Folder[]): string {
    const now = new Date();
    const dateString = now.toUTCString();

    // Group feeds by folder
    const foldersMap = new Map<string, Feed[]>();

    feeds.forEach((feed) => {
        const folderName = folders.find((f) => f.id === feed.folder_id)?.name || 'Uncategorized';
        if (!foldersMap.has(folderName)) {
            foldersMap.set(folderName, []);
        }
        foldersMap.get(folderName)!.push(feed);
    });

    // Helper function to escape XML special characters
    const escapeXml = (str: string): string => {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    let opmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Readspace Feeds Export</title>
        <dateCreated>${dateString}</dateCreated>
    </head>
    <body>
`;

    // Add feeds grouped by folders
    for (const [folderName, folderFeeds] of foldersMap) {
        if (foldersMap.size > 1 || folderName !== 'Uncategorized') {
            opmlContent += `        <outline text="${escapeXml(folderName)}" title="${escapeXml(folderName)}">
`;
            folderFeeds.forEach((feed) => {
                const title = escapeXml(feed.title || feed.url);
                const htmlUrl = escapeXml(feed.link || feed.url);
                const xmlUrl = escapeXml(feed.url);
                opmlContent += `            <outline text="${title}" title="${title}" type="rss" xmlUrl="${xmlUrl}" htmlUrl="${htmlUrl}"/>
`;
            });
            opmlContent += `        </outline>
`;
        } else {
            // Put feeds directly in body if only uncategorized
            folderFeeds.forEach((feed) => {
                const title = escapeXml(feed.title || feed.url);
                const htmlUrl = escapeXml(feed.link || feed.url);
                const xmlUrl = escapeXml(feed.url);
                opmlContent += `        <outline text="${title}" title="${title}" type="rss" xmlUrl="${xmlUrl}" htmlUrl="${htmlUrl}"/>
`;
            });
        }
    }

    opmlContent += `    </body>
</opml>`;

    return opmlContent;
}

/**
 * Export feeds to OPML format and share the file
 * @param feeds - Array of feeds to export
 * @param folders - Array of folders to organize feeds
 * @param filename - Optional custom filename (defaults to readspace-export-YYYY-MM-DD.opml)
 */
export async function exportFeedsToOPML(
    feeds: Feed[],
    folders: Folder[],
    filename?: string
): Promise<void> {
    try {
        // Generate OPML content
        const opmlContent = generateOPMLContent(feeds, folders);

        // Create filename with date if not provided
        const date = new Date().toISOString().split('T')[0];
        const finalFilename = filename || `readspace-export-${date}.opml`;

        // Write to cache directory using new File API
        const file = new File(Paths.cache, finalFilename);

        // Delete the file if it already exists, then create it
        if (file.exists) {
            file.delete();
        }
        file.create();
        file.write(opmlContent);

        // Share the file
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(file.uri, {
                mimeType: 'text/xml',
                dialogTitle: 'Export OPML',
                UTI: 'public.xml',
            });
        } else {
            throw new Error('Sharing is not available on this device');
        }
    } catch (error) {
        throw new Error(
            `Failed to export OPML: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}
