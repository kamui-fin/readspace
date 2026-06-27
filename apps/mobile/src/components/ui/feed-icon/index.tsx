import { resolveSupabaseImageUrl } from '@lib/utils/network';
import { Image as ExpoImage } from 'expo-image';
import { useEffect, useState } from 'react';
import type { ImageStyle, StyleProp } from 'react-native';
import { View } from 'react-native';

export interface FeedIconProps {
  url?: string | null;
  fallbackComponent?:
    | React.ComponentType<{ size: number; className?: string }>
    | React.FC<{ size?: number; className?: string }>
    | null;
  feedName?: string;
  size?: number;
  borderRadius?: number;
  className?: string;
  style?: StyleProp<ImageStyle>;
}

export function FeedIcon({
  url,
  fallbackComponent: FallbackComponent,
  size = 16,
  borderRadius = 4,
  className,
  style,
}: FeedIconProps) {
  const [error, setError] = useState(false);

  // Reset error state if url changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Must reset error state when URL changes
  useEffect(() => {
    setError(false);
  }, [url]);

  const resolvedUrl = url ? resolveSupabaseImageUrl(url) : undefined;

  if (resolvedUrl && !error) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: borderRadius,
            overflow: 'hidden', // Ensures perfect rounded corners clipping, preventing white corners leaking
          },
          style,
        ]}
        className={className}>
        {/* White background backing, slightly inset to prevent corner bleeding/halo on dark/opaque icons */}
        <View
          style={{
            position: 'absolute',
            top: 1,
            left: 1,
            right: 1,
            bottom: 1,
            borderRadius: Math.max(0, borderRadius - 1),
            backgroundColor: '#FFFFFF',
          }}
        />
        <ExpoImage
          source={{ uri: resolvedUrl }}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: borderRadius,
          }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          onError={() => setError(true)}
        />
      </View>
    );
  }

  if (FallbackComponent) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: borderRadius,
            overflow: 'hidden',
          },
          style,
        ]}
        className={className}>
        <FallbackComponent size={size} className="h-full w-full" />
      </View>
    );
  }

  // Fallback placeholder if nothing else is available
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: borderRadius,
          backgroundColor: '#E5E7EB', // Neutral grey fallback
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      className={className}
    />
  );
}
