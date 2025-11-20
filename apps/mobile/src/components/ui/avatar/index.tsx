import clsx from 'clsx';
import { Image, View } from 'react-native';
import BoringAvatar from 'react-native-boring-avatars';

export interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: number;
  className?: string;
}

export function Avatar({ name, imageUrl, size = 64, className }: AvatarProps) {
  // Color palette matching the app's design system
  const colors = ['#386641', '#6A994E', '#90988B', '#D1DBCD', '#F3F3F3'];

  return (
    <View
      className={clsx('items-center justify-center overflow-hidden rounded-full', className)}
      style={{ width: size, height: size }}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
      ) : (
        <BoringAvatar name={name} variant="beam" colors={colors} size={size} />
      )}
    </View>
  );
}
