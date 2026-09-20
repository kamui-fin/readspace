import { Avatar } from '@components/ui/avatar';
import { Text } from '@components/ui/text';
import clsx from 'clsx';
import { View } from 'react-native';

export interface UserProfileProps {
  name: string;
  email: string;
  avatarUrl?: string;
  /** Stable per-account seed for the generated avatar — see `getUserAvatarSeed`. */
  avatarSeed?: string;
  className?: string;
}

export function UserProfile({ name, email, avatarUrl, avatarSeed, className }: UserProfileProps) {
  return (
    <View className={clsx('flex-row items-center gap-4', className)}>
      <Avatar name={name} seed={avatarSeed} imageUrl={avatarUrl} size={56} />

      {/* `min-w-0` lets the flex child actually shrink, which is what makes
          numberOfLines truncate instead of pushing the Pro badge off-screen. */}
      <View className="min-w-0 flex-1">
        <Text
          size="lg"
          fontFamily="geist-semibold"
          numberOfLines={1}
          ellipsizeMode="tail"
          className="text-black">
          {name}
        </Text>
        <Text
          size="sm"
          fontFamily="geist"
          numberOfLines={1}
          ellipsizeMode="middle"
          className="text-grey dark:text-grey mt-0.5">
          {email}
        </Text>
      </View>
    </View>
  );
}
