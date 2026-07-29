import { FeedFallbackIcon } from '@components/ui/feed-fallback-icon';
import { resolveSupabaseImageUrl } from '@lib/utils/network';
import { useMemo } from 'react';

interface useFaviconProps {
  url?: string;
  feedTitle?: string;
  feedImage?: string;
  isClipped?: boolean;
}

interface useFaviconResult {
  iconUrl: string | undefined;
  fallbackComponent: React.FC<{ size?: number; className?: string }>;
  backgroundColor: string;
}

/**
 * Get Google Favicon URL
 */
const getFaviconUrl = (url: string): string => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
};

export function useFavicon({
  url,
  feedTitle = '',
  feedImage,
  isClipped = false,
}: useFaviconProps): useFaviconResult {
  const iconUrl = useMemo(() => {
    // If clipped, try to get favicon from article link
    if (isClipped && url) {
      return getFaviconUrl(url);
    }

    // If RSS feed, prioritize feed image
    if (feedImage) {
      return resolveSupabaseImageUrl(feedImage) || undefined;
    }

    // Fallback for RSS feed: try to get favicon from article link (usually points to source domain)
    if (url) {
      return getFaviconUrl(url);
    }

    return undefined;
  }, [isClipped, url, feedImage]);

  // Static placeholder for backgroundColor — kept for API compatibility
  const backgroundColor = 'transparent';

  const FallbackComponent = useMemo(() => {
    const Fallback = ({ size = 16, className }: { size?: number; className?: string }) => (
      <FeedFallbackIcon feedName={feedTitle} size={size} borderRadius={4} className={className} />
    );
    Fallback.displayName = 'FeedFallback';
    return Fallback;
  }, [feedTitle]);

  return {
    iconUrl,
    fallbackComponent: FallbackComponent,
    backgroundColor,
  };
}
