import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { forwardRef, useState, useCallback, useEffect, useRef } from 'react';
import { Image, Pressable, type PressableProps, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Monicon } from '@monicon/native';
import { Divider } from '@components/ui/divider';
import { RssIcon } from '@components/icons/rss';
import { stripHtml } from '@lib/utils/html';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { Article } from '@readspace/shared';
import { useArticleActionsStore } from '@stores/article-actions';

export interface SwipeAction {
  id: string;
  icon: string;
  color: string;
  onPress: () => void;
}

const cardVariants = cva('bg-white dark:bg-white-dark', {
  variants: {
    variant: {
      feed: 'flex-row items-center gap-4 py-4 px-4',
      'image-top': 'overflow-hidden rounded-2xl border border-grey4 dark:border-grey4-dark',
      article: 'flex-row gap-3 py-4', // Edge-to-edge article card with image on right
      'text-only': 'rounded-2xl border border-grey4 dark:border-grey4-dark p-4',
      swipeable: 'flex-row gap-3 py-4', // Swipeable article variant (same as article but with swipe actions)
    },
  },
  defaultVariants: {
    variant: 'text-only',
  },
});

export interface CardProps
  extends Omit<PressableProps, 'children'>,
    VariantProps<typeof cardVariants> {
  children?: ReactNode;
  className?: string;
  // Feed variant props
  iconUrl?: string;
  title?: string;
  description?: string;
  actionButton?: ReactNode;
  // Image-top and Article variant props
  imageUrl?: string;
  timestamp?: string;
  faviconUrl?: string;
  feedName?: string;
  showTopDivider?: boolean;
  showBottomDivider?: boolean;
  // Text-only variant props
  content?: ReactNode;
  // Swipeable variant props
  article?: Article;
  leftActions?: SwipeAction[]; // Actions revealed when swiping right
  rightActions?: SwipeAction[]; // Actions revealed when swiping left
  // Legacy props for backward compatibility
  onMarkAsRead?: (article: Article) => void;
  onMarkAsUnread?: (article: Article) => void;
  onSaveArticle?: (article: Article) => void;
}

export const Card = forwardRef<React.ElementRef<typeof Pressable>, CardProps>(
  (
    {
      variant = 'text-only',
      className,
      iconUrl,
      title,
      description,
      actionButton,
      imageUrl,
      timestamp,
      faviconUrl,
      feedName,
      showTopDivider = false,
      showBottomDivider = true,
      content,
      children,
      article,
      leftActions: leftActionsProp,
      rightActions: rightActionsProp,
      onMarkAsRead,
      onMarkAsUnread,
      onSaveArticle,
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(false);
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];

    // Swipeable hooks - always call hooks, conditionally use them
    const ACTION_WIDTH = 80;
    const SWIPE_THRESHOLD = ACTION_WIDTH * 0.6;
    const translateX = useSharedValue(0);
    const VERTICAL_THRESHOLD = 10; // Fail gesture if vertical movement exceeds this
    const isSwipeGesture = useSharedValue(false); // Track if this is a swipe vs press

    // Shared values for icon scaling (like mobile implementation)
    const leftActionScale = useSharedValue(0);
    const rightActionScale = useSharedValue(0);

    // Store counts in shared values for worklet access
    const leftActionsCountShared = useSharedValue(0);
    const rightActionsCountShared = useSharedValue(0);
    const rightAction0IdShared = useSharedValue('');
    const rightAction1IdShared = useSharedValue('');

    // Build actions from props or legacy callbacks
    const buildLeftActions = useCallback((): SwipeAction[] => {
      if (leftActionsProp) return leftActionsProp;
      // Legacy: build from callbacks
      const actions: SwipeAction[] = [];
      if (onMarkAsUnread && article) {
        actions.push({
          id: 'unread',
          icon: 'solar:letter-unread-bold',
          color: colors.secondary,
          onPress: () => onMarkAsUnread(article),
        });
      }
      return actions;
    }, [leftActionsProp, onMarkAsUnread, article, colors.secondary]);

    const buildRightActions = useCallback((): SwipeAction[] => {
      if (rightActionsProp) return rightActionsProp;
      // Legacy: build from callbacks
      const actions: SwipeAction[] = [];
      if (onSaveArticle && article) {
        actions.push({
          id: 'save',
          icon: 'solar:bookmark-bold',
          color: '#fb923c', // orange-400
          onPress: () => onSaveArticle(article),
        });
      }
      if (onMarkAsRead && article) {
        actions.push({
          id: 'read',
          icon: 'solar:letter-opened-bold',
          color: colors.primary,
          onPress: () => onMarkAsRead(article),
        });
      }
      return actions;
    }, [rightActionsProp, onSaveArticle, onMarkAsRead, article, colors.primary]);

    // Compute actions outside worklets (before gestures are defined)
    const leftActionsList = buildLeftActions();
    const rightActionsList = buildRightActions();

    // Update shared values when props change (only counts and action IDs, not article ID)
    useEffect(() => {
      rightAction0IdShared.value = rightActionsList[0]?.id ?? '';
      rightAction1IdShared.value = rightActionsList[1]?.id ?? '';
      leftActionsCountShared.value = leftActionsList.length;
      rightActionsCountShared.value = rightActionsList.length;
    }, [
      rightActionsList,
      leftActionsList,
      rightAction0IdShared,
      rightAction1IdShared,
      leftActionsCountShared,
      rightActionsCountShared,
    ]);

    // Get store execute functions and store them in refs for stable access
    const executeMarkAsUnreadRef = useRef<(articleId: string) => void>(() => {});
    const executeMarkAsReadRef = useRef<(articleId: string) => void>(() => {});
    const executeSaveArticleRef = useRef<(articleId: string) => void>(() => {});

    // Update refs with store functions
    useEffect(() => {
      const store = useArticleActionsStore.getState();
      executeMarkAsUnreadRef.current = store.executeMarkAsUnread;
      executeMarkAsReadRef.current = store.executeMarkAsRead;
      executeSaveArticleRef.current = store.executeSaveArticle;
    }, []);

    // Store article ID in a ref so it can be accessed from stable callbacks
    const articleIdRef = useRef<string>('');

    // Update article ID ref when article changes
    useEffect(() => {
      articleIdRef.current = article?.id ?? '';
    }, [article?.id]);

    // Create stable wrapper functions that can be safely called from worklets
    // These read article ID from ref and call store functions from refs - completely stable
    const handleMarkAsUnread = useCallback(() => {
      const id = articleIdRef.current;
      if (id) {
        executeMarkAsUnreadRef.current(id);
      }
    }, []);
    const handleMarkAsRead = useCallback(() => {
      const id = articleIdRef.current;
      if (id) {
        executeMarkAsReadRef.current(id);
      }
    }, []);
    const handleSaveArticle = useCallback(() => {
      const id = articleIdRef.current;
      if (id) {
        executeSaveArticleRef.current(id);
      }
    }, []);

    // Get store actions for registering callbacks
    const registerCallbacks = useArticleActionsStore((state) => state.registerCallbacks);
    const unregisterCallbacks = useArticleActionsStore((state) => state.unregisterCallbacks);

    // Register callbacks in store when article changes
    useEffect(() => {
      if (!article?.id) return;

      const articleId = article.id;
      const articleRef = article; // Capture article reference

      registerCallbacks(articleId, {
        onMarkAsRead: onMarkAsRead
          ? () => {
              onMarkAsRead(articleRef);
            }
          : undefined,
        onMarkAsUnread: onMarkAsUnread
          ? () => {
              onMarkAsUnread(articleRef);
            }
          : undefined,
        onSaveArticle: onSaveArticle
          ? () => {
              onSaveArticle(articleRef);
            }
          : undefined,
      });

      return () => {
        unregisterCallbacks(articleId);
      };
    }, [
      article,
      onMarkAsRead,
      onMarkAsUnread,
      onSaveArticle,
      registerCallbacks,
      unregisterCallbacks,
    ]);

    // Combined pan gesture that handles both directions
    // Similar to mobile implementation - simpler and more reliable
    const panGesture = Gesture.Pan()
      .activeOffsetX([-10, 10]) // Require 10px horizontal movement to activate
      .failOffsetY([-VERTICAL_THRESHOLD, VERTICAL_THRESHOLD]) // Cancel if vertical movement > threshold
      .onUpdate((e) => {
        'worklet';
        // Mark as swipe gesture if moved horizontally
        if (Math.abs(e.translationX) > 5) {
          isSwipeGesture.value = true;
        }

        const leftCount = leftActionsCountShared.value;
        const rightCount = rightActionsCountShared.value;

        if (e.translationX > 0) {
          // Swiping right (reveal left actions)
          const maxWidth = ACTION_WIDTH * leftCount;
          const clampedX = Math.min(e.translationX, maxWidth);
          translateX.value = clampedX;
          // Update left action scale (like mobile implementation)
          leftActionScale.value = Math.min(1, e.translationX / SWIPE_THRESHOLD);
          rightActionScale.value = 0;
        } else {
          // Swiping left (reveal right actions)
          const maxWidth = ACTION_WIDTH * rightCount;
          const clampedX = Math.max(e.translationX, -maxWidth);
          translateX.value = clampedX;
          // Update right action scale (like mobile implementation)
          rightActionScale.value = Math.min(1, Math.abs(e.translationX) / SWIPE_THRESHOLD);
          leftActionScale.value = 0;
        }
      })
      .onEnd((e) => {
        'worklet';
        const absTranslation = Math.abs(e.translationX);
        const shouldTrigger = absTranslation > SWIPE_THRESHOLD;

        const leftCount = leftActionsCountShared.value;
        const rightCount = rightActionsCountShared.value;

        if (e.translationX > 0 && shouldTrigger && leftCount > 0) {
          // Swiped right - trigger left action (unread)
          const actionIndex = Math.min(Math.floor(e.translationX / ACTION_WIDTH), leftCount - 1);
          // Call stable wrapper function using runOnJS
          // Left action is always "unread" at index 0
          if (actionIndex === 0) {
            runOnJS(handleMarkAsUnread)();
          }
          // Stay open at action position
          translateX.value = withSpring(ACTION_WIDTH * (actionIndex + 1), {
            damping: 25,
            stiffness: 400,
            overshootClamping: true,
          });
        } else if (e.translationX < 0 && shouldTrigger && rightCount > 0) {
          // Swiped left - trigger right action
          const actionIndex = Math.min(Math.floor(absTranslation / ACTION_WIDTH), rightCount - 1);
          // Call stable wrapper functions using runOnJS
          // Use shared values to determine which action to trigger
          const action0Id = rightAction0IdShared.value;
          const action1Id = rightAction1IdShared.value;
          if (actionIndex === 0 && action0Id === 'save') {
            runOnJS(handleSaveArticle)();
          } else if (actionIndex === 1 && action1Id === 'read') {
            runOnJS(handleMarkAsRead)();
          } else if (actionIndex === 0 && action0Id === 'read') {
            // If only one action (read), trigger it
            runOnJS(handleMarkAsRead)();
          }
          // Stay open showing all actions
          translateX.value = withSpring(-ACTION_WIDTH * rightCount, {
            damping: 25,
            stiffness: 400,
            overshootClamping: true,
          });
        } else {
          // Spring back if threshold not met
          translateX.value = withSpring(0, {
            damping: 25,
            stiffness: 400,
            overshootClamping: true,
          });
        }
        // Reset scales
        leftActionScale.value = withTiming(0, { duration: 150 });
        rightActionScale.value = withTiming(0, { duration: 150 });
        // Reset after a short delay to allow press events
        runOnJS(() => {
          setTimeout(() => {
            isSwipeGesture.value = false;
          }, 100);
        })();
      });

    // Animated styles
    const cardAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    const leftActionsStyle = useAnimatedStyle(() => {
      // Show actions when swiping right (positive translateX)
      const opacity = interpolate(
        translateX.value,
        [0, ACTION_WIDTH * 0.3],
        [0, 1],
        Extrapolation.CLAMP
      );
      return { opacity };
    });

    const rightActionStyle = useAnimatedStyle(() => {
      const maxWidth = ACTION_WIDTH * rightActionsCountShared.value;
      // Show actions when swiping left (negative translateX)
      const opacity = interpolate(
        translateX.value,
        [-maxWidth, -ACTION_WIDTH * 0.5, 0],
        [1, 1, 0],
        Extrapolation.CLAMP
      );
      return { opacity };
    });

    // Animated styles for left icon scaling (like mobile implementation)
    const leftIconAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: leftActionScale.value }],
    }));

    // Animated styles for right icon scaling (like mobile implementation)
    const rightIconAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: rightActionScale.value }],
    }));

    // Generate UI Avatars fallback URL for feed icons
    const fallbackAvatarUrl = title
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&size=128&background=random&length=2&bold=true&format=png`
      : undefined;

    // Feed variant - horizontal layout with icon, text, and action button
    if (variant === 'feed') {
      return (
        <Pressable ref={ref} className={clsx(cardVariants({ variant }), className)} {...props}>
          {/* Icon */}
          <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-grey5 dark:bg-grey5-dark">
            {iconUrl && !imageError ? (
              <Image
                source={{ uri: iconUrl }}
                className="h-full w-full"
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            ) : fallbackAvatarUrl ? (
              <Image
                source={{ uri: fallbackAvatarUrl }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : null}
          </View>

          {/* Content */}
          <View className="flex-1">
            {title && (
              <Text
                className="mb-1 font-geist-semibold text-base text-primary-foreground dark:text-primary-foreground-dark"
                numberOfLines={1}>
                {stripHtml(title)}
              </Text>
            )}
            {description && (
              <Text
                className="font-geist-regular text-sm text-grey2 dark:text-grey2"
                numberOfLines={2}>
                {stripHtml(description)}
              </Text>
            )}
          </View>

          {/* Action Button */}
          {actionButton}
        </Pressable>
      );
    }

    // Swipeable variant - article card with swipe actions
    if (variant === 'swipeable') {
      // Use actions computed earlier (before gestures were defined)
      // This ensures consistency between gesture handlers and rendering

      // Render article content (same as article variant)
      const renderArticleContent = () => {
        // Create a wrapped onPress that checks if this was a swipe gesture
        const handlePress = () => {
          if (!isSwipeGesture.value && props.onPress) {
            // Call onPress with a synthetic event
            props.onPress({} as Parameters<NonNullable<PressableProps['onPress']>>[0]);
          }
        };

        return (
          <Pressable
            ref={ref}
            className={clsx(cardVariants({ variant: 'article' }), className)}
            {...props}
            onPress={handlePress}>
            {/* Content on left */}
            <View className="flex-1">
              {/* Feed name and timestamp header */}
              {(feedName || timestamp) && (
                <View className="mb-2 flex-row items-center gap-2">
                  {/* Favicon */}
                  {faviconUrl ? (
                    <View className="h-4 w-4 overflow-hidden rounded-sm">
                      <ExpoImage
                        source={{ uri: faviconUrl }}
                        style={{ width: 16, height: 16 }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={200}
                      />
                    </View>
                  ) : (
                    <View className="h-4 w-4 items-center justify-center rounded-sm bg-orange-100 dark:bg-orange-950">
                      <RssIcon size={12} color={isDark ? '#9a3412' : '#ea580c'} />
                    </View>
                  )}

                  {/* Feed name */}
                  {feedName && (
                    <Text
                      className="font-geist-regular text-xs text-grey dark:text-grey"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{ flexShrink: 1 }}>
                      {feedName}
                    </Text>
                  )}

                  {/* Clock icon */}
                  {timestamp && (
                    <>
                      <Monicon name="solar:clock-circle-linear" size={14} color="#90988B" />
                      <Text
                        className="font-geist-regular text-xs text-grey dark:text-grey"
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {timestamp}
                      </Text>
                    </>
                  )}
                </View>
              )}
              {title && (
                <Text
                  className="mb-2 font-geist-semibold text-base leading-5 tracking-tight text-primary-foreground dark:text-primary-foreground-dark"
                  numberOfLines={3}>
                  {stripHtml(title)}
                </Text>
              )}
              {description && (
                <Text
                  className="font-geist-regular text-sm leading-5 text-grey2 dark:text-grey2"
                  numberOfLines={2}>
                  {stripHtml(description)}
                </Text>
              )}
            </View>

            {/* Thumbnail on right - only show if imageUrl exists */}
            {imageUrl && (
              <View className="h-24 w-24 overflow-hidden rounded-xl bg-grey5 dark:bg-grey5-dark">
                <ExpoImage
                  source={{ uri: imageUrl }}
                  className="h-full w-full"
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                  onError={() => setImageError(true)}
                />
              </View>
            )}
          </Pressable>
        );
      };

      return (
        <View className={clsx('relative overflow-hidden')}>
          {/* Top divider */}
          {showTopDivider && <Divider />}

          {/* Left actions (revealed when swiping right) */}
          {leftActionsList.length > 0 && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  flexDirection: 'row',
                  width: ACTION_WIDTH * leftActionsList.length,
                },
                leftActionsStyle,
              ]}>
              {leftActionsList.map((action) => {
                return (
                  <Pressable
                    key={action.id}
                    onPress={action.onPress}
                    className="items-center justify-center"
                    style={{
                      width: ACTION_WIDTH,
                      backgroundColor: action.color,
                    }}>
                    <Animated.View style={leftIconAnimatedStyle}>
                      <Monicon name={action.icon} size={24} color={colors.white} />
                    </Animated.View>
                  </Pressable>
                );
              })}
            </Animated.View>
          )}

          {/* Right actions (revealed when swiping left) */}
          {rightActionsList.length > 0 && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  flexDirection: 'row',
                  width: ACTION_WIDTH * rightActionsList.length,
                },
                rightActionStyle,
              ]}>
              {rightActionsList.map((action) => {
                return (
                  <Pressable
                    key={action.id}
                    onPress={action.onPress}
                    className="items-center justify-center"
                    style={{
                      width: ACTION_WIDTH,
                      backgroundColor: action.color,
                    }}>
                    <Animated.View style={rightIconAnimatedStyle}>
                      <Monicon name={action.icon} size={24} color={colors.white} />
                    </Animated.View>
                  </Pressable>
                );
              })}
            </Animated.View>
          )}

          {/* Main card */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={cardAnimatedStyle}>{renderArticleContent()}</Animated.View>
          </GestureDetector>

          {/* Bottom divider */}
          {showBottomDivider && <Divider />}
        </View>
      );
    }

    // Article variant - edge-to-edge, image on right, text on left
    if (variant === 'article') {
      return (
        <View>
          {/* Top divider - edge-to-edge, no horizontal margin */}
          {showTopDivider && <Divider />}
          <Pressable ref={ref} className={clsx(cardVariants({ variant }), className)} {...props}>
            {/* Content on left */}
            <View className="flex-1">
              {/* Feed name and timestamp header */}
              {(feedName || timestamp) && (
                <View className="mb-2 flex-row items-center gap-2">
                  {/* Favicon */}
                  {faviconUrl ? (
                    <View className="h-4 w-4 overflow-hidden rounded-sm">
                      <ExpoImage
                        source={{ uri: faviconUrl }}
                        style={{ width: 16, height: 16 }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={200}
                      />
                    </View>
                  ) : (
                    <View className="h-4 w-4 items-center justify-center rounded-sm bg-orange-100 dark:bg-orange-950">
                      <RssIcon size={12} color={isDark ? '#9a3412' : '#ea580c'} />
                    </View>
                  )}

                  {/* Feed name */}
                  {feedName && (
                    <Text
                      className="font-geist-regular text-xs text-grey dark:text-grey"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{ flexShrink: 1 }}>
                      {feedName}
                    </Text>
                  )}

                  {/* Clock icon */}
                  {timestamp && (
                    <>
                      <Monicon name="solar:clock-circle-linear" size={14} color="#90988B" />
                      <Text
                        className="font-geist-regular text-xs text-grey dark:text-grey"
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {timestamp}
                      </Text>
                    </>
                  )}
                </View>
              )}
              {title && (
                <Text
                  className="mb-2 font-geist-semibold text-base leading-5 tracking-tight text-primary-foreground dark:text-primary-foreground-dark"
                  numberOfLines={3}>
                  {stripHtml(title)}
                </Text>
              )}
              {description && (
                <Text
                  className="font-geist-regular text-sm leading-5 text-grey2 dark:text-grey2"
                  numberOfLines={2}>
                  {stripHtml(description)}
                </Text>
              )}
            </View>

            {/* Thumbnail on right - only show if imageUrl exists */}
            {imageUrl && (
              <View className="h-24 w-24 overflow-hidden rounded-xl bg-grey5 dark:bg-grey5-dark">
                <ExpoImage
                  source={{ uri: imageUrl }}
                  className="h-full w-full"
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                  onError={() => setImageError(true)}
                />
              </View>
            )}
          </Pressable>
          {/* Bottom divider - edge-to-edge, no horizontal margin */}
          {showBottomDivider && <Divider />}
        </View>
      );
    }

    // Image-top variant - image fills top, text below
    if (variant === 'image-top') {
      return (
        <Pressable ref={ref} className={clsx(cardVariants({ variant }), className)} {...props}>
          {imageUrl && (
            <Image source={{ uri: imageUrl }} className="h-48 w-full" resizeMode="cover" />
          )}
          <View className="p-4">
            {timestamp && (
              <View className="mb-2 flex-row items-center gap-2">
                <View className="h-1.5 w-1.5 rounded-full bg-primary" />
                <Text
                  className="font-geist-regular text-xs text-grey dark:text-grey"
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {timestamp}
                </Text>
              </View>
            )}
            {title && (
              <Text
                className="font-geist-semibold text-base leading-6 text-primary-foreground dark:text-primary-foreground-dark"
                numberOfLines={3}
                ellipsizeMode="tail">
                {stripHtml(title)}
              </Text>
            )}
            {description && (
              <Text
                className="mt-2 font-geist-regular text-sm leading-5 text-grey2 dark:text-grey2"
                numberOfLines={3}
                ellipsizeMode="tail">
                {stripHtml(description)}
              </Text>
            )}
          </View>
        </Pressable>
      );
    }

    // Text-only variant - just text content
    return (
      <Pressable ref={ref} className={clsx(cardVariants({ variant }), className)} {...props}>
        {content || children}
      </Pressable>
    );
  }
);

Card.displayName = 'Card';
