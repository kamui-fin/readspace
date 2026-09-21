import { generateOpml, parseOpml } from 'feedsmith';
import type { Opml } from 'feedsmith/types';
import type { Folder } from '../api/types/folders';

export { generateOpml, parseOpml };
export type { Opml };

/** Virtual newsletter feeds use this URL scheme; they can't be re-imported from OPML. */
export const NEWSLETTER_FEED_URL_SCHEME = 'newsletter://';

export function isNewsletterFeedUrl(url: string): boolean {
  return url.startsWith(NEWSLETTER_FEED_URL_SCHEME);
}

export interface FeedForOPML {
  url: string;
  title?: string | null;
  link?: string | null;
  folder_id?: string | null;
}

function toOutline(feed: FeedForOPML): Opml.Outline<Date> {
  return {
    text: feed.title || feed.url,
    title: feed.title || feed.url,
    type: 'rss',
    xmlUrl: feed.url,
    htmlUrl: feed.link || undefined,
  };
}

/**
 * Build an OPML document for the given feeds, grouped by folder name.
 * Newsletter virtual feeds are skipped: their `newsletter://` URLs aren't importable anywhere.
 */
export function generateOPMLContent(feedsToExport: FeedForOPML[], folders: Folder[]): string {
  const foldersMap = new Map<string, FeedForOPML[]>();

  feedsToExport
    .filter((feed) => !isNewsletterFeedUrl(feed.url))
    .forEach((feed) => {
      const folderName = folders.find((f) => f.id === feed.folder_id)?.name || 'Uncategorized';
      if (!foldersMap.has(folderName)) {
        foldersMap.set(folderName, []);
      }
      foldersMap.get(folderName)!.push(feed);
    });

  const outlines: Opml.Outline<Date>[] = [];
  for (const [folderName, folderFeeds] of foldersMap) {
    if (foldersMap.size > 1 || folderName !== 'Uncategorized') {
      outlines.push({ text: folderName, title: folderName, outlines: folderFeeds.map(toOutline) });
    } else {
      // Put feeds directly in body if only uncategorized
      outlines.push(...folderFeeds.map(toOutline));
    }
  }

  return generateOpml({
    head: { title: 'Readspace Feeds Export', dateCreated: new Date() },
    body: { outlines },
  });
}

/** Default export filename, e.g. `readspace-feeds-2026-09-21.opml`. */
export function opmlExportFilename(date: Date = new Date()): string {
  return `readspace-feeds-${date.toISOString().split('T')[0]}.opml`;
}

/**
 * Helper to visit all nodes in an OPML structure
 */
export function visitAll(
  outlines: Opml.Outline<string>[],
  cb: (node: Opml.Outline<string>) => boolean
): void {
  const walk = (nodes: Opml.Outline<string>[]): boolean => {
    for (const node of nodes) {
      if (!cb(node)) return false;
      if (node.outlines && node.outlines.length > 0) {
        if (!walk(node.outlines)) return false;
      }
    }
    return true;
  };
  walk(outlines);
}

export interface OpmlValidationResult {
  isValid: boolean;
  feedCount: number;
  hasNestedCategories: boolean;
  error?: string;
}

export async function validateOpml(file: File): Promise<OpmlValidationResult> {
  try {
    const content = await file.text();

    // Check if this is an RSS/Atom feed instead of OPML
    const contentLower = content.toLowerCase().trim();
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
          'This appears to be an RSS/Atom feed file, not an OPML file. OPML files contain lists of feeds, while RSS/Atom files contain actual feed content. Please export your feed list as OPML from your RSS reader.',
      };
    }

    const parsedOpml = parseOpml(content);

    if (!parsedOpml || !parsedOpml.body) {
      return {
        isValid: false,
        feedCount: 0,
        hasNestedCategories: false,
        error:
          "Invalid OPML format: This doesn't appear to be a valid OPML file. Please check that you've exported the correct file from your RSS reader.",
      };
    }

    let feedCount = 0;
    let hasNestedCategories = false;
    const existingUrls = new Set<string>();

    const countFeeds = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outlines: Array<{ xmlUrl?: string; outlines?: any[] }>,
      level = 0
    ) => {
      if (level > 1) {
        hasNestedCategories = true;
      }

      for (const outline of outlines || []) {
        if (outline.xmlUrl) {
          if (!existingUrls.has(outline.xmlUrl)) {
            feedCount++;
            existingUrls.add(outline.xmlUrl);
          }
        } else if (outline.outlines) {
          countFeeds(outline.outlines, level + 1);
        }
      }
    };

    countFeeds(parsedOpml.body.outlines ?? []);

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
