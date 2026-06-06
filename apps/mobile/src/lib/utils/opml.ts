import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { XMLParser } from 'fast-xml-parser';

export interface OPMLValidationResult {
  isValid: boolean;
  feedCount: number;
  hasNestedCategories: boolean;
  error?: string;
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
        error:
          'This appears to be an RSS/Atom feed file, not an OPML file. Please export your feed list as OPML.',
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
        error: "Invalid OPML format: This doesn't appear to be a valid OPML file.",
      };
    }

    let feedCount = 0;
    let hasNestedCategories = false;
    const existingUrls = new Set<string>();

    const countFeeds = (outlines: any, level = 0) => {
      if (level > 1) {
        hasNestedCategories = true;
      }

      const outlinesArray = Array.isArray(outlines) ? outlines : [outlines];

      for (const outline of outlinesArray || []) {
        if (!outline) continue;

        const xmlUrl = outline['@_xmlUrl'] || outline.xmlUrl;
        if (xmlUrl) {
          if (!existingUrls.has(xmlUrl)) {
            feedCount++;
            existingUrls.add(xmlUrl);
          }
        }

        if (outline.outline) {
          countFeeds(outline.outline, level + 1);
        }
      }
    };

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
 */
export function generateOPMLContent(feeds: Feed[], folders: Folder[]): string {
  const now = new Date();
  const dateString = now.toUTCString();

  const foldersMap = new Map<string, Feed[]>();

  feeds.forEach((feed) => {
    const folderName = folders.find((f) => f.id === feed.folder_id)?.name || 'Uncategorized';
    if (!foldersMap.has(folderName)) {
      foldersMap.set(folderName, []);
    }
    foldersMap.get(folderName)!.push(feed);
  });

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
 */
export async function exportFeedsToOPML(
  feeds: Feed[],
  folders: Folder[],
  filename?: string
): Promise<void> {
  try {
    const opmlContent = generateOPMLContent(feeds, folders);

    const date = new Date().toISOString().split('T')[0];
    const finalFilename = filename || `readspace-export-${date}.opml`;

    const fileUri = `${FileSystem.cacheDirectory}${finalFilename}`;

    await FileSystem.writeAsStringAsync(fileUri, opmlContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
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
