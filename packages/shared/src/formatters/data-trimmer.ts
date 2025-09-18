// Data trimmer to match server Pydantic model validation requirements
const MAX_TITLE_LENGTH = 1000;
const MAX_CONTENT_LENGTH = 5_000_000; // 5MB
const MAX_DESCRIPTION_LENGTH = 10_000; // Reasonable limit for descriptions
const MAX_AUTHOR_LENGTH = 500; // From server schema max_length=500

/**
 * Trims a string to the specified length, adding "..." if truncated
 */
function trimString(
  value: string | null | undefined,
  maxLength: number,
): string | undefined {
  if (!value) return undefined;
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength - 3) + "...";
}

/**
 * Trims SaveArticleRequest data to match server Pydantic model requirements
 */
export function trimSaveArticleRequest(data: {
  url: string;
  title?: string | null;
  content?: string | null;
  metadata?: {
    description?: string | null;
    author?: string | null;
    published_at?: string | null;
    image_url?: string | null;
    favicon?: string | null;
  } | null;
}): {
  url: string;
  title?: string;
  content?: string;
  metadata?: {
    description: string | undefined;
    author: string | undefined;
    published_at: string | undefined;
    image_url: string | undefined;
    favicon: string | undefined;
  };
} {
  const trimmed = {
    url: data.url, // URL is validated by Pydantic HttpUrl
    title: trimString(data.title, MAX_TITLE_LENGTH),
    content: trimString(data.content, MAX_CONTENT_LENGTH),
    metadata: data.metadata
      ? {
          description: trimString(
            data.metadata.description,
            MAX_DESCRIPTION_LENGTH,
          ),
          author: trimString(data.metadata.author, MAX_AUTHOR_LENGTH),
          published_at: data.metadata.published_at || undefined,
          image_url: data.metadata.image_url || undefined,
          favicon: data.metadata.favicon || undefined,
        }
      : undefined,
  };

  // Clean up metadata - remove undefined values
  if (trimmed.metadata) {
    const cleanMetadata: {
      description: string | undefined;
      author: string | undefined;
      published_at: string | undefined;
      image_url: string | undefined;
      favicon: string | undefined;
    } = {
      description: undefined,
      author: undefined,
      published_at: undefined,
      image_url: undefined,
      favicon: undefined,
    };

    if (trimmed.metadata.description !== undefined)
      cleanMetadata.description = trimmed.metadata.description;
    if (trimmed.metadata.author !== undefined)
      cleanMetadata.author = trimmed.metadata.author;
    if (trimmed.metadata.published_at !== undefined)
      cleanMetadata.published_at = trimmed.metadata.published_at;
    if (trimmed.metadata.image_url !== undefined)
      cleanMetadata.image_url = trimmed.metadata.image_url;
    if (trimmed.metadata.favicon !== undefined)
      cleanMetadata.favicon = trimmed.metadata.favicon;

    trimmed.metadata =
      Object.keys(cleanMetadata).length > 0
        ? cleanMetadata
        : undefined;
  }

  // Remove undefined values to keep the request clean
  return Object.fromEntries(
    Object.entries(trimmed).filter(([, value]) => value !== undefined),
  ) as {
    url: string;
    title?: string;
    content?: string;
    metadata?: {
      description: string | undefined;
      author: string | undefined;
      published_at: string | undefined;
      image_url: string | undefined;
      favicon: string | undefined;
    };
  };
}
