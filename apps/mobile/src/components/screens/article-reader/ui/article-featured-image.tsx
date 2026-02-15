import { Galeria } from '@nandorojo/galeria';
import { Image as ExpoImage } from 'expo-image';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ArticleFeaturedImageProps {
  imageUrl: string;
}

export function ArticleFeaturedImage({ imageUrl }: ArticleFeaturedImageProps) {
  const insets = useSafeAreaInsets();

  if (!imageUrl) return null;

  return (
    <Galeria urls={[imageUrl]}>
      <Galeria.Image>
        <View className="w-full bg-black" style={{ height: 240, marginTop: insets.top + 64 }}>
          <ExpoImage
            source={{ uri: imageUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            priority="high"
            cachePolicy="memory-disk"
          />
        </View>
      </Galeria.Image>
    </Galeria>
  );
}
