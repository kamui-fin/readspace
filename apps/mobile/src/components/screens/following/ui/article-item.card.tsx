import { Divider } from '@components/ui/divider';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import BookmarkBoldIcon from '@components/icons/solar/bookmark-bold';
import LetterOpenedBoldIcon from '@components/icons/solar/letter-opened-bold';
import LetterUnreadBoldIcon from '@components/icons/solar/letter-unread-bold';
import type { Article } from '@readspace/shared';
import { useArticleActionsStore } from '@stores/article-actions';
import { forwardRef, useCallback, useEffect, useRef } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Card, type CardProps } from '@components/ui/card/index';

export interface SwipeAction {
  id: string;
  icon: React.ComponentType<{ width?: number; height?: number; color?: string; strokeWidth?: number }>;
  color: string;
  onPress: () => void;
}

export interface ArticleItemProps extends Omit<CardProps, 'variant'> {
  article?: Article;
  fallbackComponent?: React.FC<{ size?: number; className?: string }>;
  leftActions?: SwipeAction[]; // Actions revealed when swiping right
  rightActions?: SwipeAction[]; // Actions revealed when swiping left
  // Legacy props for backward compatibility
  onMarkAsRead?: (article: Article) => void;
  onMarkAsUnread?: (article: Article) => void;
  onSaveArticle?: (article: Article) => void;
}

/**
 * SwipeableCard wraps Card with swipe gesture functionality.
 * Extends the article variant with swipe actions.
 */
export const ArticleItemCard = forwardRef<React.ComponentRef<typeof Pressable>, ArticleItemProps>(
  (
    {
      article,
      leftActions: leftActionsProp,
      rightActions: rightActionsProp,
      onMarkAsRead,
      onMarkAsUnread,
      onSaveArticle,
      showTopDivider = false,
      showBottomDivider = true,
      className,
      fallbackComponent,
      ...cardProps
    },
    ref
  ) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];

    // Swipeable hooks
    const ACTION_WIDTH = 80;
    const SWIPE_THRESHOLD = ACTION_WIDTH * 0.6;
    const translateX = useSharedValue(0);
    const VERTICAL_THRESHOLD = 10; // Fail gesture if vertical movement exceeds this
    const isSwipeGesture = useSharedValue(false); // Track if this is a swipe vs press

    // Shared values for icon scaling
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
          icon: LetterUnreadBoldIcon,
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
          icon: BookmarkBoldIcon,
          color: '#fb923c', // orange-400
          onPress: () => onSaveArticle(article),
        });
      }
      if (onMarkAsRead && article) {
        actions.push({
          id: 'read',
          icon: LetterOpenedBoldIcon,
          color: colors.primary,
          onPress: () => onMarkAsRead(article),
        });
      }
      return actions;
    }, [rightActionsProp, onSaveArticle, onMarkAsRead, article, colors.primary]);

    // Compute actions outside worklets (before gestures are defined)
    const leftActionsList = buildLeftActions();
    const rightActionsList = buildRightActions();

    // Update shared values when props change
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
    const executeMarkAsUnreadRef = useRef<(articleId: string) => void>(() => { });
    const executeMarkAsReadRef = useRef<(articleId: string) => void>(() => { });
    const executeSaveArticleRef = useRef<(articleId: string) => void>(() => { });

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

    const resetSwipeGesture = useCallback(() => {
      setTimeout(() => {
        isSwipeGesture.value = false;
      }, 100);
    }, [isSwipeGesture]);

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
          // Update left action scale
          leftActionScale.value = Math.min(1, e.translationX / SWIPE_THRESHOLD);
          rightActionScale.value = 0;
        } else {
          // Swiping left (reveal right actions)
          const maxWidth = ACTION_WIDTH * rightCount;
          const clampedX = Math.max(e.translationX, -maxWidth);
          translateX.value = clampedX;
          // Update right action scale
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
        runOnJS(resetSwipeGesture)();
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

    // Animated styles for icon scaling
    const leftIconAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: leftActionScale.value }],
    }));

    const rightIconAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: rightActionScale.value }],
    }));

    // Extract onPress from cardProps to avoid dependency issues
    const { onPress: cardOnPress, ...restCardProps } = cardProps;

    // Create a wrapped onPress that checks if this was a swipe gesture
    const handlePress = useCallback(
      (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
        if (!isSwipeGesture.value && cardOnPress) {
          cardOnPress(e);
        }
      },
      [isSwipeGesture, cardOnPress]
    );

    return (
      <View className="relative overflow-hidden">
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
                    <action.icon width={24} height={24} color={colors.white} />
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
                    <action.icon width={24} height={24} color={colors.white} />
                  </Animated.View>
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        {/* Main card */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={cardAnimatedStyle}>
            <Card
              ref={ref}
              variant="article"
              {...restCardProps}
              className={className}
              onPress={handlePress}
              fallbackComponent={fallbackComponent}
            />
          </Animated.View>
        </GestureDetector>

        {/* Bottom divider */}
        {showBottomDivider && <Divider />}
      </View>
    );
  }
);

ArticleItemCard.displayName = 'ArticleItemCard';
