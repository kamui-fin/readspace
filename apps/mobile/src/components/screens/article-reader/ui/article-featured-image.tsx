import { Galeria } from '@nandorojo/galeria';
import { Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ArticleFeaturedImageProps {
  imageUrl: string;
}

export function ArticleFeaturedImage({ imageUrl }: ArticleFeaturedImageProps) {
  const insets = useSafeAreaInsets();

  if (!imageUrl) return null;

  return (
    <Galeria urls={[imageUrl]}>
      <Galeria.Image index={0} style={{ width: '100%', height: 240, marginTop: insets.top + 64 }}>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </Galeria.Image>
    </Galeria>
  );
}
