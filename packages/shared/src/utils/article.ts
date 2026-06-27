/**
 * Trims article request data to ensure it fits within API limits.
 * Removes or truncates large content to prevent payload size issues.
 */

// Maximum content length to send to API (in characters)
const MAX_CONTENT_LENGTH = 500000; // 500KB of text content
const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 2000;

export interface ArticleSaveData {
  url: string;
  title?: string;
  content?: string;
  metadata?: {
    description?: string;
    author?: string;
    published_at?: string;
    image_url?: string;
    favicon?: string;
  };
}

/**
 * Trims a save article request to ensure data fits within reasonable limits
 */
export function trimSaveArticleRequest(data: ArticleSaveData): ArticleSaveData {
  const trimmed: ArticleSaveData = {
    url: data.url,
  };

  // Trim title if present
  if (data.title) {
    trimmed.title =
      data.title.length > MAX_TITLE_LENGTH ? data.title.substring(0, MAX_TITLE_LENGTH) : data.title;
  }

  // Trim content if present
  if (data.content) {
    trimmed.content =
      data.content.length > MAX_CONTENT_LENGTH
        ? data.content.substring(0, MAX_CONTENT_LENGTH)
        : data.content;
  }

  // Trim metadata if present
  if (data.metadata) {
    trimmed.metadata = {
      ...data.metadata,
    };

    // Trim description if present
    if (data.metadata.description) {
      trimmed.metadata.description =
        data.metadata.description.length > MAX_DESCRIPTION_LENGTH
          ? data.metadata.description.substring(0, MAX_DESCRIPTION_LENGTH)
          : data.metadata.description;
    }
  }

  return trimmed;
}
