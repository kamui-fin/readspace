import clsx from 'clsx';
import { Text, View } from 'react-native';
import { Avatar } from '@components/ui/avatar';

export interface UserProfileProps {
  name: string;
  email: string;
  avatarUrl?: string;
  className?: string;
}

export function UserProfile({ name, email, avatarUrl, className }: UserProfileProps) {
  return (
    <View className={clsx('flex-row items-center gap-4', className)}>
      <Avatar name={name} imageUrl={avatarUrl} size={64} />

      {/* User Info */}
      <View className="flex-1">
        <Text className="font-geist-semibold text-xl text-black dark:text-black-dark">{name}</Text>
        <Text className="font-geist text-base text-grey dark:text-grey">{email}</Text>
      </View>
    </View>
  );
}
