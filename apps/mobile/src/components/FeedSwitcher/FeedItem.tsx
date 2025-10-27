import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/utils/cn';
import type { Feed } from '@/utils/mockFeeds';
import { forwardRef } from 'react';
import { Image, Pressable, Text, View, type PressableProps } from 'react-native';

export interface FeedItemProps extends Omit<PressableProps, 'children'> {
    feed: Feed;
    isEditMode?: boolean;
    isSelected?: boolean;
    onPress?: () => void;
    className?: string;
}

export const FeedItem = forwardRef<React.ElementRef<typeof Pressable>, FeedItemProps>(
    ({ feed, isEditMode = false, isSelected = false, onPress, className, ...props }, ref) => {
        return (
            <Pressable
                ref={ref}
                onPress={onPress}
                className={cn(
                    'flex-row items-center gap-3 py-3 transition-opacity active:opacity-70',
                    className
                )}
                {...props}>
                {/* Icon or Checkbox */}
                {isEditMode ? (
                    <Checkbox checked={isSelected} />
                ) : (
                    <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-mid-grey">
                        {feed.iconUrl ? (
                            <Image source={{ uri: feed.iconUrl }} className="h-full w-full" resizeMode="cover" />
                        ) : (
                            <Text className="font-geist-bold text-sm text-grey">
                                {feed.name.charAt(0).toUpperCase()}
                            </Text>
                        )}
                    </View>
                )}

                {/* Feed Name */}
                <Text className="flex-1 font-geist-medium text-base text-black" numberOfLines={1}>
                    {feed.name}
                </Text>

                {/* Unread Badge */}
                {feed.unreadCount > 0 && <Badge label={feed.unreadCount.toString()} />}
            </Pressable>
        );
    }
);

FeedItem.displayName = 'FeedItem';

