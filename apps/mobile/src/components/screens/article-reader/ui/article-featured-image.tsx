import { Galeria } from '@nandorojo/galeria';
import { Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Shared with the reader skeleton so the placeholder and the real image are the same box. */
export const FEATURED_IMAGE_HEIGHT = 240;
/** Clears the floating reader action bar, which overlaps the top of the scroll content. */
export const FEATURED_IMAGE_TOP_OFFSET = 64;

interface ArticleFeaturedImageProps {
  imageUrl: string;
}

export function ArticleFeaturedImage({ imageUrl }: ArticleFeaturedImageProps) {
  const insets = useSafeAreaInsets();

  if (!imageUrl) return null;

  return (
    <Galeria urls={[imageUrl]}>
      <Galeria.Image
        index={0}
        style={{
          width: '100%',
          height: FEATURED_IMAGE_HEIGHT,
          marginTop: insets.top + FEATURED_IMAGE_TOP_OFFSET,
        }}>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </Galeria.Image>
    </Galeria>
  );
}
