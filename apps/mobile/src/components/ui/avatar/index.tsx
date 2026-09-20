import clsx from 'clsx';
import { Image, View } from 'react-native';
import BoringAvatar from 'react-native-boring-avatars';

/**
 * A monochromatic ramp of the brand greens, ordered dark -> light.
 *
 * The previous palette mixed in an off-white (#F3F3F3) and a desaturated grey,
 * so generated avatars came out washed out and clashed with whatever surface
 * they sat on. Keeping every stop on the same hue with clear steps in value
 * means any combination the hash picks still reads as Readspace.
 */
const AVATAR_COLORS = ['#2F4A32', '#386641', '#6A994E', '#A7BF9B', '#D1DBCD'];

export interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: number;
  className?: string;
  /**
   * What the generated avatar is derived from. Defaults to `name`, but callers
   * should pass something unique and stable (the user id) so two people with
   * the same display name — or the same fallback name — don't collide.
   */
  seed?: string;
}

export function Avatar({ name, imageUrl, size = 64, className, seed }: AvatarProps) {
  return (
    <View
      className={clsx('items-center justify-center overflow-hidden rounded-full', className)}
      style={{ width: size, height: size }}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
      ) : (
        // `bauhaus` over `beam`: beam draws a face (eyes + mouth) that reads as a
        // cartoon sticker at tab-bar size. Bauhaus is flat geometry — legible at
        // 20px, calm at 64px, and never accidentally goofy.
        <BoringAvatar name={seed ?? name} variant="bauhaus" colors={AVATAR_COLORS} size={size} />
      )}
    </View>
  );
}
