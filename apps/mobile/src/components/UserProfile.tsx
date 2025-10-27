import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';
import { Text, View } from 'react-native';

export interface UserProfileProps {
    name: string;
    email: string;
    avatarUrl?: string;
    className?: string;
}

export const UserProfile = ({ name, email, avatarUrl, className }: UserProfileProps) => {
    return (
        <View className={cn('flex-row items-center gap-4', className)}>
            <Avatar name={name} imageUrl={avatarUrl} size={64} />

            {/* User Info */}
            <View className="flex-1">
                <Text className="font-geist-semibold text-xl text-black">{name}</Text>
                <Text className="font-geist text-base text-grey">{email}</Text>
            </View>
        </View>
    );
};
