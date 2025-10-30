import { cn } from '@/utils/cn';
import BoringAvatar from 'react-native-boring-avatars';
import { Image, View } from 'react-native';

export interface AvatarProps {
    name: string;
    imageUrl?: string;
    size?: number;
    className?: string;
}

export const Avatar = ({ name, imageUrl, size = 64, className }: AvatarProps) => {
    // Color palette matching the app's design system
    const colors = ['#386641', '#6A994E', '#90988B', '#D1DBCD', '#F3F3F3'];
    
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
                <BoringAvatar
                    name={name}
                    variant="beam"
                    colors={colors}
                    size={size}
                />
            )}
        </View>
    );
};
