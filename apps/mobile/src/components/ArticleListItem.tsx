import { cn } from '@/utils/cn';
import { stripHtml } from '@/utils/html';
import { Monicon } from '@monicon/native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { forwardRef, useCallback, useRef } from 'react';
import { Animated, Image, Pressable, Text, View, type PressableProps, useColorScheme } from 'react-native';
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
    articleType?: 'feed' | 'clipped';
    priority?: string;
    note?: string;
    articleUrl?: string;
    feedId?: string;
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
            articleType = 'feed',
            priority,
            note,
            articleUrl,
            feedId,
            ...props
        },
        ref
    ) => {
        const router = useRouter();
        const swipeableRef = useRef<Swipeable>(null);
        const hasTriggeredHaptic = useRef(false);
        const colorScheme = useColorScheme();

        /**
         * Extract domain from URL for display
         */
        const extractDomain = (url: string): string => {
            try {
                return new URL(url).hostname;
            } catch {
                return url;
            }
        };

        /**
         * Get priority color based on priority level and color scheme
         */
        const getPriorityColor = (priorityLevel: string): string => {
            const isDark = colorScheme === 'dark';
            switch (priorityLevel) {
                case 'high':
                    return isDark ? '#FCA5A5' : '#EF4444'; // red-300 : red-500
                case 'medium':
                    return isDark ? '#FDBA74' : '#F97316'; // orange-300 : orange-500
                case 'low':
                    return isDark ? '#6EE7B7' : '#10B981'; // green-300 : green-500
                default:
                    return isDark ? '#93C5FD' : '#3B82F6'; // blue-300 : blue-500
            }
        };

        /**
         * Get priority background color based on priority level and color scheme
         */
        const getPriorityBgColor = (priorityLevel: string): string => {
            const isDark = colorScheme === 'dark';
            switch (priorityLevel) {
                case 'high':
                    return isDark ? '#7F1D1D' : '#FEE2E2'; // red-900 : red-100
                case 'medium':
                    return isDark ? '#7C2D12' : '#FFEDD5'; // orange-900 : orange-100
                case 'low':
                    return isDark ? '#064E3B' : '#D1FAE5'; // green-900 : green-100
                default:
                    return isDark ? '#1E3A8A' : '#DBEAFE'; // blue-900 : blue-100
            }
        };

        // Determine display values for clipped articles
        const displaySource = articleType === 'clipped' && articleUrl
            ? extractDomain(articleUrl)
            : source;

        // Prioritize note over description for clipped articles
        const displayDescription = articleType === 'clipped' && note
            ? note
            : description;

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
                        'overflow-hidden rounded-2xl border border-light-grey dark:border-light-grey-dark bg-white dark:bg-white-dark active:opacity-80',
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
                                    <Text className="font-geist text-xs text-grey dark:text-grey-dark" numberOfLines={1} ellipsizeMode="tail">
                                        {timestamp}
                                    </Text>
                                </View>
                                <Text className="font-geist-semibold text-base leading-6 text-black dark:text-black-dark" numberOfLines={3} ellipsizeMode="tail">
                                    {stripHtml(title)}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <View className="p-4" style={width ? { width } : undefined}>
                            <View className="mb-3 flex-row items-center gap-2">
                                <View className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <Text className="font-geist text-xs text-grey dark:text-grey-dark" numberOfLines={1} ellipsizeMode="tail">
                                    {timestamp}
                                </Text>
                            </View>
                            <Text className="mb-3 font-geist-semibold text-lg leading-6 text-black dark:text-black-dark" numberOfLines={3} ellipsizeMode="tail">
                                {stripHtml(title)}
                            </Text>
                            {description && (
                                <Text
                                    className="font-geist text-sm leading-5 text-grey dark:text-grey-dark"
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
                        {articleType === 'feed' && feedId ? (
                            <Pressable
                                onPress={() => {
                                    console.log('Navigating to feed from list:', feedId);
                                    router.push(`/discover/feed/${feedId}`);
                                }}
                                style={{
                                    marginBottom: 8,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                {/* Favicon */}
                                {faviconUrl ? (
                                    <Image
                                        source={{ uri: faviconUrl }}
                                        className="h-4 w-4 rounded-sm"
                                    />
                                ) : (
                                    <View className="h-4 w-4 rounded-sm bg-mid-grey dark:bg-mid-grey-dark" />
                                )}

                                {/* Feed name with truncation */}
                                <Text
                                    className={cn(
                                        'font-geist text-xs',
                                        isRead ? 'text-grey dark:text-grey-dark' : 'text-grey dark:text-grey-dark'
                                    )}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                    style={{ flexShrink: 1 }}>
                                    {displaySource}
                                </Text>

                                {isSaved && articleType === 'feed' && (
                                    <Monicon name="solar:bookmark-bold" size={16} color="#FBBC04" />
                                )}

                                <Monicon name="solar:clock-circle-linear" size={14} color="#90988B" />

                                <Text className="font-geist text-xs text-grey dark:text-grey-dark">{timestamp}</Text>
                            </Pressable>
                        ) : (
                            <View className="mb-2 flex-row items-center gap-2">
                                {/* Priority badge for clipped articles */}
                                {articleType === 'clipped' && priority && (
                                    <View
                                        style={{
                                            backgroundColor: getPriorityBgColor(priority),
                                            borderRadius: 12,
                                            paddingHorizontal: 6,
                                            paddingVertical: 2,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 3,
                                        }}>
                                        <Monicon
                                            name="solar:paperclip-bold"
                                            size={10}
                                            color={getPriorityColor(priority)}
                                        />
                                        <Text
                                            style={{
                                                fontSize: 9,
                                                fontWeight: '600',
                                                color: getPriorityColor(priority),
                                                textTransform: 'capitalize',
                                            }}>
                                            {priority}
                                        </Text>
                                    </View>
                                )}

                                {/* Favicon */}
                                {faviconUrl ? (
                                    <Image
                                        source={{ uri: faviconUrl }}
                                        className="h-4 w-4 rounded-sm"
                                    />
                                ) : (
                                    <View className="h-4 w-4 rounded-sm bg-mid-grey dark:bg-mid-grey-dark" />
                                )}

                                {/* Feed name with truncation */}
                                <Text
                                    className={cn(
                                        'font-geist text-xs',
                                        isRead ? 'text-grey dark:text-grey-dark' : 'text-grey dark:text-grey-dark'
                                    )}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                    style={{ flexShrink: 1 }}>
                                    {displaySource}
                                </Text>

                                {isSaved && articleType === 'feed' && (
                                    <Monicon name="solar:bookmark-bold" size={16} color="#FBBC04" />
                                )}

                                <Monicon name="solar:clock-circle-linear" size={14} color="#90988B" />

                                <Text className="font-geist text-xs text-grey dark:text-grey-dark">{timestamp}</Text>
                            </View>
                        )}

                        {/* Title */}
                        <Text
                            className={cn(
                                'mb-2 font-geist-semibold tracking-tight text-base leading-5',
                                isRead ? 'text-grey dark:text-grey-dark' : 'text-black dark:text-black-dark'
                            )}
                            numberOfLines={3}>
                            {stripHtml(title)}
                        </Text>

                        {/* Description or Note */}
                        {displayDescription && (
                            <Text
                                className="font-geist text-sm leading-5 text-grey dark:text-grey-dark"
                                numberOfLines={2}>
                                {stripHtml(displayDescription)}
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
