import { cn } from '@/utils/cn';
import { stripHtml } from '@/utils/html';
import { Monicon } from '@monicon/native';
import * as Haptics from 'expo-haptics';
import { forwardRef, useCallback, useRef } from 'react';
import { Animated, Image, Pressable, Text, View, type PressableProps } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

export interface ArticleListItemProps extends PressableProps {
    source: string;
    timestamp: string;
    title: string;
    description?: string;
    imageUrl?: string;
    faviconUrl?: string;
    isRead?: boolean;
    isSaved?: boolean;
    className?: string;
    onBookmark?: () => void;
    onToggleRead?: () => void;
    variant?: 'horizontal' | 'card';
    width?: number;
}

const SWIPE_THRESHOLD = 0.8; // 40% of item width

export const ArticleListItem = forwardRef<React.ElementRef<typeof Pressable>, ArticleListItemProps>(
    (
        {
            source,
            timestamp,
            title,
            description,
            imageUrl,
            faviconUrl,
            isRead = false,
            isSaved = false,
            className,
            onBookmark,
            onToggleRead,
            variant = 'horizontal',
            width,
            ...props
        },
        ref
    ) => {
        const swipeableRef = useRef<Swipeable>(null);
        const hasTriggeredHaptic = useRef(false);

        // Render left action (bookmark)
        const renderLeftActions = useCallback(
            (progress: Animated.AnimatedInterpolation<number>) => {
                const scale = progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                    extrapolate: 'clamp',
                });

                return (
                    <View className="flex-row items-center justify-start pl-4">
                        <Animated.View
                            style={{
                                transform: [{ scale }],
                                backgroundColor: '#FBBC04',
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                            <Monicon name="solar:bookmark-bold" size={24} color="#FFFFFF" />
                        </Animated.View>
                    </View>
                );
            },
            []
        );

        // Render right action (mark as read/unread)
        const renderRightActions = useCallback(
            (progress: Animated.AnimatedInterpolation<number>) => {
                const scale = progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                    extrapolate: 'clamp',
                });

                return (
                    <View className="flex-row items-center justify-end pr-4">
                        <Animated.View
                            style={{
                                transform: [{ scale }],
                                backgroundColor: '#6A994E',
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                            <Monicon name="solar:check-read-bold" size={24} color="#FFFFFF" />
                        </Animated.View>
                    </View>
                );
            },
            []
        );

        // Handle swipe completion
        const handleSwipeableOpen = useCallback(
            (direction: 'left' | 'right') => {
                // Use setTimeout to avoid state update during render
                setTimeout(() => {
                    if (direction === 'left' && onBookmark) {
                        // Swipe right reveals left action (bookmark)
                        if (!hasTriggeredHaptic.current) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            hasTriggeredHaptic.current = true;
                        }
                        onBookmark();
                    } else if (direction === 'right' && onToggleRead) {
                        // Swipe left reveals right action (mark as read)
                        onToggleRead();
                    }

                    // Close swipeable after action
                    setTimeout(() => {
                        swipeableRef.current?.close();
                        hasTriggeredHaptic.current = false;
                    }, 300);
                }, 0);
            },
            [onBookmark, onToggleRead]
        );

        // Card variant - no swipeable
        if (variant === 'card') {
            return (
                <Pressable
                    ref={ref}
                    className={cn(
                        'overflow-hidden rounded-2xl border border-light-grey bg-white active:opacity-80',
                        className
                    )}
                    style={width ? { width } : undefined}
                    {...props}>
                    {imageUrl ? (
                        <>
                            <Image
                                source={{ uri: imageUrl }}
                                style={width ? { width } : undefined}
                                className="h-48"
                                resizeMode="cover"
                            />
                            <View className="p-4" style={width ? { width } : undefined}>
                                <View className="mb-2 flex-row items-center gap-2">
                                    <View className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    <Text className="font-geist text-xs text-grey" numberOfLines={1} ellipsizeMode="tail">
                                        {timestamp}
                                    </Text>
                                </View>
                                <Text className="font-geist-semibold text-base leading-6 text-black" numberOfLines={3} ellipsizeMode="tail">
                                    {stripHtml(title)}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <View className="p-4" style={width ? { width } : undefined}>
                            <View className="mb-3 flex-row items-center gap-2">
                                <View className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <Text className="font-geist text-xs text-grey" numberOfLines={1} ellipsizeMode="tail">
                                    {timestamp}
                                </Text>
                            </View>
                            <Text className="mb-3 font-geist-semibold text-lg leading-6 text-black" numberOfLines={3} ellipsizeMode="tail">
                                {stripHtml(title)}
                            </Text>
                            {description && (
                                <Text
                                    className="font-geist text-sm leading-5 text-grey"
                                    numberOfLines={3}
                                    ellipsizeMode="tail">
                                    {stripHtml(description)}
                                </Text>
                            )}
                        </View>
                    )}
                </Pressable>
            );
        }

        // Horizontal variant - with swipeable
        return (
            <Swipeable
                ref={swipeableRef}
                renderLeftActions={renderLeftActions}
                renderRightActions={renderRightActions}
                onSwipeableOpen={handleSwipeableOpen}
                overshootLeft={false}
                overshootRight={false}
                leftThreshold={SWIPE_THRESHOLD * 100}
                rightThreshold={SWIPE_THRESHOLD * 100}>
                <Pressable
                    ref={ref}
                    className={cn(
                        'flex-row gap-3 bg-white dark:bg-white-dark py-4',
                        isRead && 'opacity-60',
                        className
                    )}
                    {...props}>
                    {/* Content */}
                    <View className="flex-1">
                        {/* Header */}
                        <View className="mb-2 flex-row items-center gap-2">
                            {/* Favicon */}
                            {faviconUrl ? (
                                <Image
                                    source={{ uri: faviconUrl }}
                                    className="h-4 w-4 rounded-sm"
                                />
                            ) : (
                                <View className="h-4 w-4 rounded-sm bg-mid-grey dark:bg-mid-grey-dark" />
                            )}

                            <Text
                                className={cn(
                                    'font-geist text-xs',
                                    isRead ? 'text-grey dark:text-grey-dark' : 'text-grey dark:text-grey-dark'
                                )}>
                                {source}
                            </Text>

                            {isSaved && (
                                <Monicon name="solar:bookmark-bold" size={16} color="#FBBC04" />
                            )}

                            <Monicon name="solar:clock-circle-linear" size={14} color="#90988B" />

                            <Text className="font-geist text-xs text-grey dark:text-grey-dark">{timestamp}</Text>
                        </View>

                        {/* Title */}
                        <Text
                            className={cn(
                                'mb-2 font-geist-semibold text-base leading-5',
                                isRead ? 'text-grey dark:text-grey-dark' : 'text-black dark:text-black-dark'
                            )}
                            numberOfLines={3}>
                            {stripHtml(title)}
                        </Text>

                        {/* Description */}
                        {description && (
                            <Text
                                className="font-geist text-sm leading-5 text-grey dark:text-grey-dark"
                                numberOfLines={2}>
                                {stripHtml(description)}
                            </Text>
                        )}
                    </View>

                    {/* Thumbnail - positioned to the right */}
                    {imageUrl && (
                        <View className="h-24 w-24 overflow-hidden rounded-xl bg-mid-grey dark:bg-mid-grey-dark">
                            <Image
                                source={{ uri: imageUrl }}
                                className="h-full w-full"
                                resizeMode="cover"
                            />
                        </View>
                    )}
                </Pressable>
            </Swipeable>
        );
    }
);

ArticleListItem.displayName = 'ArticleListItem';
