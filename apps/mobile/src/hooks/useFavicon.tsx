import LocalRssIcon from '@components/icons/local/rss';
import { COLORS } from '@lib/constants/colors';
import { resolveSupabaseImageUrl } from '@lib/utils/network';
import { useMemo } from 'react';
import { View } from 'react-native';

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
 * Generate a consistent color from a string
 */
const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use HSL for better looking colors
  // Hue: 0-360 based on hash
  const h = Math.abs(hash % 360);
  // Saturation: 60-80% for vibrancy but not too neon
  const s = 70;
  // Lightness: 85-95% for light mode backgrounds (pastel)
  const l = 90;

  return `hsl(${h}, ${s}%, ${l}%)`;
};

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

  const backgroundColor = useMemo(() => {
    if (feedTitle) {
      return stringToColor(feedTitle);
    }
    return COLORS.light.grey6; // Default grey background
  }, [feedTitle]);

  const FallbackComponent = useMemo(() => {
    return ({ size = 16, className }: { size?: number; className?: string }) => (
      <View
        className={`items-center justify-center rounded-sm ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor,
        }}>
        <LocalRssIcon
          width={size * 0.6}
          height={size * 0.6}
          color={COLORS.light.grey}
          fill={COLORS.light.grey}
        />
      </View>
    );
  }, [backgroundColor]);

  return {
    iconUrl,
    fallbackComponent: FallbackComponent,
    backgroundColor,
  };
}
