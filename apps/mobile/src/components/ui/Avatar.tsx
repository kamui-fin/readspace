import { cn } from '@/utils/cn';
import { Image, Text, View } from 'react-native';

export interface AvatarProps {
    name: string;
    imageUrl?: string;
    size?: number;
    className?: string;
}

export const Avatar = ({ name, imageUrl, size = 64, className }: AvatarProps) => {
    return (
        <View
            className={cn('items-center justify-center overflow-hidden rounded-full', className)}
            style={{ width: size, height: size }}>
            {imageUrl ? (
                <Image
                    source={{ uri: imageUrl }}
                    className="h-full w-full"
                    resizeMode="cover"
                />
            ) : (
                <View className="h-full w-full items-center justify-center bg-gradient-to-br from-primary to-secondary">
                    <Text className="font-geist-bold text-white" style={{ fontSize: size * 0.4 }}>
                        {name.charAt(0).toUpperCase()}
                    </Text>
                </View>
            )}
        </View>
    );
};

