import { cn } from '@/utils/cn';
import { stripHtml } from '@/utils/html';
import { Monicon } from '@monicon/native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { forwardRef, useCallback } from 'react';
import {
    Image,
    Pressable,
    Text,
    View,
    type PressableProps,
    useColorScheme,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

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
    disableGestures?: boolean;
}

// Swipe thresholds
const SWIPE_ACTIVATION_THRESHOLD = 80; // Distance to trigger action
const MAX_SWIPE_DISTANCE = 120; // Maximum swipe distance for visual feedback
const VERTICAL_THRESHOLD = 15; // Vertical movement tolerance before canceling horizontal swipe

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
            disableGestures = false,
            ...props
        },
        ref
    ) => {
        const router = useRouter();
        const colorScheme = useColorScheme();

        // Shared values for gesture animations
        const translateX = useSharedValue(0);
        const leftActionScale = useSharedValue(0);
        const rightActionScale = useSharedValue(0);

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
        const displaySource =
            articleType === 'clipped' && articleUrl ? extractDomain(articleUrl) : source;

        // Prioritize note over description for clipped articles
        const displayDescription = articleType === 'clipped' && note ? note : description;

        /**
         * Trigger bookmark action with haptic feedback
         */
        const triggerBookmark = useCallback(() => {
            'worklet';
            if (onBookmark) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onBookmark();
            }
        }, [onBookmark]);

        /**
         * Trigger mark as read/unread action
         */
        const triggerToggleRead = useCallback(() => {
            'worklet';
            if (onToggleRead) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggleRead();
            }
        }, [onToggleRead]);

        /**
         * Pan gesture for swipe actions
         */
        const panGesture = Gesture.Pan()
            .activeOffsetX([-10, 10]) // Require 10px horizontal movement to activate
            .failOffsetY([-VERTICAL_THRESHOLD, VERTICAL_THRESHOLD]) // Cancel if vertical movement > threshold
            .onUpdate((event) => {
                // Clamp translation to MAX_SWIPE_DISTANCE
                const clampedTranslation = Math.max(
                    -MAX_SWIPE_DISTANCE,
                    Math.min(MAX_SWIPE_DISTANCE, event.translationX)
                );
                translateX.value = clampedTranslation;

                // Update action scales based on swipe distance
                if (event.translationX > 0) {
                    // Swiping right (bookmark action)
                    leftActionScale.value = Math.min(1, event.translationX / SWIPE_ACTIVATION_THRESHOLD);
                    rightActionScale.value = 0;
                } else {
                    // Swiping left (mark as read action)
                    rightActionScale.value = Math.min(
                        1,
                        Math.abs(event.translationX) / SWIPE_ACTIVATION_THRESHOLD
                    );
                    leftActionScale.value = 0;
                }
            })
            .onEnd((event) => {
                const absTranslation = Math.abs(event.translationX);

                // Check if threshold was reached
                if (absTranslation >= SWIPE_ACTIVATION_THRESHOLD) {
                    if (event.translationX > 0) {
                        // Swipe right - bookmark
                        triggerBookmark();
                    } else {
                        // Swipe left - mark as read
                        triggerToggleRead();
                    }
                }

                // Animate back to center with smoother, less bouncy spring
                translateX.value = withSpring(0, {
                    damping: 30,
                    stiffness: 400,
                    mass: 0.5,
                });
                leftActionScale.value = withTiming(0, { duration: 150 });
                rightActionScale.value = withTiming(0, { duration: 150 });
            });

        // Animated styles for the content
        const contentAnimatedStyle = useAnimatedStyle(() => ({
            transform: [{ translateX: translateX.value }],
        }));

        // Animated styles for left action (bookmark) - also controls background visibility
        const leftActionAnimatedStyle = useAnimatedStyle(() => ({
            opacity: leftActionScale.value,
        }));

        // Animated styles for left icon
        const leftIconAnimatedStyle = useAnimatedStyle(() => ({
            transform: [{ scale: leftActionScale.value }],
        }));

        // Animated styles for right action (mark as read) - also controls background visibility
        const rightActionAnimatedStyle = useAnimatedStyle(() => ({
            opacity: rightActionScale.value,
        }));

        // Animated styles for right icon
        const rightIconAnimatedStyle = useAnimatedStyle(() => ({
            transform: [{ scale: rightActionScale.value }],
        }));

        // Card variant - no swipeable
        if (variant === 'card') {
            return (
                <Pressable
                    ref={ref}
                    className={cn(
                        'overflow-hidden rounded-2xl border border-light-grey bg-white active:opacity-80 dark:border-light-grey-dark dark:bg-white-dark',
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
                                    <Text
                                        className="font-geist text-xs text-grey dark:text-grey-dark"
                                        numberOfLines={1}
                                        ellipsizeMode="tail">
                                        {timestamp}
                                    </Text>
                                </View>
                                <Text
                                    className="font-geist-semibold text-base leading-6 text-black dark:text-black-dark"
                                    numberOfLines={3}
                                    ellipsizeMode="tail">
                                    {stripHtml(title)}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <View className="p-4" style={width ? { width } : undefined}>
                            <View className="mb-3 flex-row items-center gap-2">
                                <View className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <Text
                                    className="font-geist text-xs text-grey dark:text-grey-dark"
                                    numberOfLines={1}
                                    ellipsizeMode="tail">
                                    {timestamp}
                                </Text>
                            </View>
                            <Text
                                className="mb-3 font-geist-semibold text-lg leading-6 text-black dark:text-black-dark"
                                numberOfLines={3}
                                ellipsizeMode="tail">
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

        // Horizontal variant content
        const horizontalContent = (
            <Pressable
                ref={ref}
                className={cn(
                    'flex-row gap-3 py-4',
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
                                    isRead
                                        ? 'text-grey dark:text-grey-dark'
                                        : 'text-grey dark:text-grey-dark'
                                )}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                style={{ flexShrink: 1 }}>
                                {displaySource}
                            </Text>

                            <Monicon name="solar:clock-circle-linear" size={14} color="#90988B" />

                            <Text className="font-geist text-xs text-grey dark:text-grey-dark">
                                {timestamp}
                            </Text>
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
                                    isRead
                                        ? 'text-grey dark:text-grey-dark'
                                        : 'text-grey dark:text-grey-dark'
                                )}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                style={{ flexShrink: 1 }}>
                                {displaySource}
                            </Text>

                            <Monicon name="solar:clock-circle-linear" size={14} color="#90988B" />

                            <Text className="font-geist text-xs text-grey dark:text-grey-dark">
                                {timestamp}
                            </Text>
                        </View>
                    )}

                    {/* Title */}
                    <Text
                        className={cn(
                            'mb-2 font-geist-semibold text-base leading-5 tracking-tight',
                            isRead
                                ? 'text-grey dark:text-grey-dark'
                                : 'text-black dark:text-black-dark'
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
        );

        // Horizontal variant - with or without swipeable based on disableGestures
        if (disableGestures) {
            return horizontalContent;
        }

        return (
            <View className="relative overflow-hidden">
                {/* Left action background (bookmark) */}
                <Animated.View
                    style={[leftActionAnimatedStyle]}
                    className="absolute left-0 top-0 h-full w-full flex-row items-center bg-[#FBBC04] pl-4">
                    <Animated.View style={[leftIconAnimatedStyle]}>
                        <Monicon name="solar:bookmark-bold" size={24} color="#FFFFFF" />
                    </Animated.View>
                </Animated.View>

                {/* Right action background (mark as read) */}
                <Animated.View
                    style={[rightActionAnimatedStyle]}
                    className="absolute right-0 top-0 h-full w-full flex-row items-center justify-end bg-[#6A994E] pr-4">
                    <Animated.View style={[rightIconAnimatedStyle]}>
                        <Monicon name="solar:check-read-bold" size={24} color="#FFFFFF" />
                    </Animated.View>
                </Animated.View>

                {/* Main content with gesture */}
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[contentAnimatedStyle]} className="bg-white dark:bg-white-dark">
                        {horizontalContent}
                    </Animated.View>
                </GestureDetector>
            </View>
        );
    }
);

ArticleListItem.displayName = 'ArticleListItem';
