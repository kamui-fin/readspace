import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/utils/cn';
import { Monicon } from '@monicon/native';
import type { Feed } from '@readspace/shared';
import { forwardRef, useEffect } from 'react';
import { Image, Pressable, Text, View, type PressableProps } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, useSharedValue } from 'react-native-reanimated';
import { COLORS } from '@/constants/Colors';
import { useColorScheme } from 'nativewind';

export interface FeedItemProps extends Omit<PressableProps, 'children'> {
    feed: Feed;
    isEditMode?: boolean;
    isSelected?: boolean;
    isNested?: boolean;
    isCurrentlyViewing?: boolean;
    onPress?: () => void;
    className?: string;
}

export const FeedItem = forwardRef<React.ElementRef<typeof Pressable>, FeedItemProps>(
    (
        {
            feed,
            isEditMode = false,
            isSelected = false,
            isNested = false,
            isCurrentlyViewing = false,
            onPress,
            className,
            ...props
        },
        ref
    ) => {
        const { colorScheme } = useColorScheme();
        const colors = COLORS[colorScheme ?? 'light'];

        // Reset animation when feed id changes (view recycling)
        const animKey = useSharedValue(feed.id);

        useEffect(() => {
            animKey.value = feed.id;
        }, [feed.id, animKey]);

        return (
            <Animated.View
                entering={FadeInDown.duration(250).springify()}
                exiting={FadeOutUp.duration(200)}>
                <Pressable
                    ref={ref}
                    onPress={onPress}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className={cn(
                        'flex-row items-center gap-3 py-3 transition-opacity active:opacity-70',
                        isNested && 'pl-6',
                        className
                    )}
                    {...props}>
                    {/* Icon, Checkbox, or Checkmark */}
                    {isEditMode ? (
                        <View pointerEvents="none">
                            <Checkbox checked={isSelected} />
                        </View>
                    ) : isCurrentlyViewing ? (
                        <View className="h-8 w-8 items-center justify-center">
                            <Monicon name="lucide:check" size={24} color={colors.secondary} />
                        </View>
                    ) : (
                        <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-mid-grey dark:bg-mid-grey-dark">
                            {feed.image_url ? (
                                <Image
                                    source={{ uri: feed.image_url }}
                                    className="h-full w-full"
                                    resizeMode="cover"
                                />
                            ) : (
                                <Text className="font-geist-bold text-sm text-grey dark:text-grey-dark">
                                    {feed.title.charAt(0).toUpperCase()}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Feed Name */}
                    <Text
                        className="flex-1 font-geist-medium text-base text-black dark:text-black-dark"
                        numberOfLines={1}>
                        {feed.title}
                    </Text>

                    {/* Unread Badge */}
                    {feed.unread_count > 0 && <Badge label={feed.unread_count.toString()} />}
                </Pressable>
            </Animated.View>
        );
    }
);

FeedItem.displayName = 'FeedItem';
