import { Avatar } from '@components/ui/avatar';
import { Text } from '@components/ui/text';
import clsx from 'clsx';
import { View } from 'react-native';

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
        <Text size="xl" fontFamily="geist-semibold" className="text-black">
          {name}
        </Text>
        <Text size="lg" fontFamily="geist" className="text-grey dark:text-grey">
          {email}
        </Text>
      </View>
    </View>
  );
}
