import { cva } from 'class-variance-authority';
import clsx from 'clsx';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@components/ui/button';
import { Monicon } from '@monicon/native';
import { COLORS } from '@lib/constants/colors';
import { DEVICE_CORNER_RADIUS } from '@lib/constants/app';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { Tab } from '@components/navigation/tab';
import type { HeaderProps } from '@components/navigation/header/type';
import { ExpandVerticalIcon } from '@components/icons/expand-vertical';
import { Pressable } from 'react-native';

export const buttonConfigs = [
  { label: 'Today', iconName: 'solar:calendar-bold' },
  { label: 'Saved', iconName: 'solar:bookmark-bold' },
  { label: 'All', iconName: 'solar:inbox-bold' },
];

const headerContainerVariants = cva('w-full bg-background dark:bg-background-dark', {
  variants: {
    variant: {
      static: 'relative', // Static position, not absolute
      sticky: '',
      tabbed: '', // Position handled dynamically via animated style
    },
  },
  defaultVariants: {
    variant: 'sticky',
  },
});

const foregroundVariants = cva('flex-row items-center pb-3', {
  variants: {
    layout: {
      default: 'justify-between px-4',
      centered: 'justify-center',
    },
  },
  defaultVariants: {
    layout: 'default',
  },
});

const titleContainerVariants = cva('', {
  variants: {
    layout: {
      default: 'flex-1 max-w-[70%]',
      centered: 'items-center',
    },
  },
  defaultVariants: {
    layout: 'default',
  },
});

const titleVariants = cva('leading-8 text-primary-foreground dark:text-primary-foreground-dark', {
  variants: {
    fontWeight: {
      bold: 'font-geist-bold',
      semibold: 'font-geist-semibold',
    },
    size: {
      default: 'text-3xl',
      small: 'text-xl',
    },
  },
  defaultVariants: {
    fontWeight: 'bold',
    size: 'default',
  },
});

const subtitleVariants = cva(
  'font-geist-semibold text-base text-grey2 dark:text-grey2 mt-1 opacity-80'
);

const actionsContainerVariants = cva('flex-row items-center gap-3');

const tabsRowVariants = cva(
  'flex-row justify-between items-center px-4 py-2 gap-3 w-full bg-background dark:bg-background-dark'
);

const tabsContainerVariants = cva('flex-row items-center justify-between flex-1');

const tabsGroupVariants = cva('flex-row items-center gap-1.5');

export const Header: React.FC<HeaderProps> = (props) => {
  const {
    title,
    subtitle,
    showBackButton = false,
    onBackPress,
    actions = [],
    variant,
    bottomContent,
    titleFontWeight = 'bold',
  } = props;

  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const [foregroundHeightState, setForegroundHeight] = useState(0);
  const [tabsHeight, setTabsHeight] = useState(0);
  const [bottomContentHeightState, setBottomContentHeight] = useState(0);

  // Convert to SharedValue for use in worklet
  const foregroundHeight = useSharedValue(0);
  const bottomContentHeight = useSharedValue(0);

  // Update SharedValue when state changes
  useEffect(() => {
    foregroundHeight.value = foregroundHeightState;
  }, [foregroundHeightState, foregroundHeight]);

  useEffect(() => {
    bottomContentHeight.value = bottomContentHeightState;
  }, [bottomContentHeightState, bottomContentHeight]);

  // Only extract tabbed-specific props if variant is tabbed
  const activeTab = variant === 'tabbed' ? (props.activeTab ?? 0) : 0;
  const onTabChange = variant === 'tabbed' ? props.onTabChange : undefined;
  const showSort = variant === 'tabbed' ? (props.showSort ?? false) : false;
  const onSortPress = variant === 'tabbed' ? props.onSortPress : undefined;
  const actionButton = variant === 'tabbed' ? props.actionButton : undefined;
  const onTitlePress = variant === 'tabbed' ? props.onTitlePress : undefined;
  const scrollY = variant === 'tabbed' ? props.scrollY : props.scrollY;
  const scrollDirection = variant === 'tabbed' ? undefined : props.scrollDirection;
  const onHeaderHeightChange = props.onHeaderHeightChange;

  useEffect(() => {
    if (variant === 'tabbed') {
      const totalHeight = foregroundHeightState + tabsHeight;
      if (totalHeight > 0 && onHeaderHeightChange) {
        onHeaderHeightChange(totalHeight);
      }
    }
  }, [foregroundHeightState, tabsHeight, onHeaderHeightChange, variant]);

  useEffect(() => {
    if (variant === 'sticky') {
      const totalHeight = foregroundHeightState + bottomContentHeightState;
      if (totalHeight > 0 && onHeaderHeightChange) {
        onHeaderHeightChange(totalHeight + insets.top + 10);
      }
    }
  }, [foregroundHeightState, bottomContentHeightState, onHeaderHeightChange, variant, insets.top]);

  const handleForegroundLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const height = e.nativeEvent.layout.height;
      if (Math.abs(height - foregroundHeightState) > 0.5) {
        setForegroundHeight(height);
      }
    },
    [foregroundHeightState]
  );

  const handleTabsLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const height = e.nativeEvent.layout.height;
      if (Math.abs(height - tabsHeight) > 0.5) {
        setTabsHeight(height);
      }
    },
    [tabsHeight]
  );

  const handleBottomContentLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const height = e.nativeEvent.layout.height;
      if (Math.abs(height - bottomContentHeightState) > 0.5) {
        setBottomContentHeight(height);
      }
    },
    [bottomContentHeightState]
  );

  // Determine if we should use centered layout (for similar feeds with back button and no actions)
  const useCenteredLayout = showBackButton && actions.length === 0 && !subtitle;
  const titleSize = useCenteredLayout ? 'small' : 'default';

  const renderForeground = useCallback(() => {
    if (useCenteredLayout) {
      return (
        <View
          className="flex-row items-center pb-3 w-full absolute"
          onLayout={handleForegroundLayout}>
          {showBackButton && (
            <View className="absolute left-4 top-0 z-10">
              <Button onPress={onBackPress} variant="icon" size="small" fullWidth={false}>
                <Monicon
                  name="solar:arrow-left-linear"
                  size={18}
                  strokeWidth={2.4}
                  color={colors.grey}
                />
              </Button>
            </View>
          )}

          <View className="flex-1 items-center px-16">
            <Text
              className={clsx(titleVariants({ fontWeight: titleFontWeight, size: titleSize }))}
              numberOfLines={1}
              ellipsizeMode="tail">
              {title}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View
        className={clsx(foregroundVariants({ layout: 'default' }))}
        onLayout={handleForegroundLayout}>
        {showBackButton && (
          <Button
            onPress={onBackPress}
            variant="icon"
            size="small"
            fullWidth={false}
            className="mr-3">
            <Monicon
              name="solar:arrow-left-linear"
              size={18}
              strokeWidth={2.4}
              color={colors.grey}
            />
          </Button>
        )}

        <View className={clsx(titleContainerVariants({ layout: 'default' }))}>
          {onTitlePress ? (
            <Pressable
              onPress={onTitlePress}
              className="flex-row items-center gap-1.5 active:opacity-70">
              <Text
                className={clsx(
                  titleVariants({
                    fontWeight: titleFontWeight,
                    size: titleSize,
                  })
                )}
                numberOfLines={1}
                ellipsizeMode="tail">
                {title}
              </Text>
              <View
                className="justify-center"
                style={{ marginBottom: Platform.OS === 'ios' ? 6 : 2 }}>
                <ExpandVerticalIcon size={24} color={colors.black} />
              </View>
            </Pressable>
          ) : (
            <Text
              className={clsx(titleVariants({ fontWeight: titleFontWeight, size: titleSize }))}
              numberOfLines={1}
              ellipsizeMode="tail">
              {title}
            </Text>
          )}
          {subtitle && (
            <Text className={clsx(subtitleVariants())} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          )}
        </View>

        {actions.length > 0 && (
          <View className={clsx(actionsContainerVariants())}>
            {actions.map((action) => (
              <Button
                key={action.label}
                onPress={action.onPress}
                variant="secondary"
                size="small"
                fullWidth={false}
                disabled={action.disabled}
                className="bg-transparent px-2 py-2">
                <Monicon name={action.icon} size={20} color={colors.primary_foreground} />
              </Button>
            ))}
          </View>
        )}
      </View>
    );
  }, [
    title,
    subtitle,
    colors,
    onBackPress,
    showBackButton,
    actions,
    handleForegroundLayout,
    titleFontWeight,
    useCenteredLayout,
    titleSize,
    onTitlePress,
  ]);

  const renderTabs = useCallback(() => {
    if (variant !== 'tabbed') return null;

    return (
      <View className={clsx(tabsRowVariants())} onLayout={handleTabsLayout}>
        <View className={clsx(tabsContainerVariants())}>
          <View className={clsx(tabsGroupVariants())}>
            {buttonConfigs.map((btn, index) => (
              <Tab
                key={btn.label}
                label={btn.label}
                active={activeTab === index}
                onPress={() => onTabChange?.(index)}
                iconName={btn.iconName}
              />
            ))}
          </View>

          <View className="flex-row items-center gap-2">
            {/* Action button - generic, reusable component */}
            {actionButton}

            {showSort && (
              <Button
                onPress={onSortPress}
                variant="secondary"
                size="small"
                fullWidth={false}
                className="min-h-9 px-3 py-2"
                style={{
                  backgroundColor: colors.grey5,
                  borderRadius: DEVICE_CORNER_RADIUS - 2,
                }}>
                <Monicon name="solar:sort-bold" size={16} color={colors.grey2} />
              </Button>
            )}
          </View>
        </View>
      </View>
    );
  }, [
    variant,
    activeTab,
    onTabChange,
    showSort,
    onSortPress,
    actionButton,
    colors,
    handleTabsLayout,
  ]);

  // Animated styles for tabbed variant
  // Header is always absolutely positioned for smooth transitions
  // Content always has paddingTop to account for header height
  // When scrollY is 0, translateY is 0 (header at top)
  // When scrolling, header translates up and becomes sticky
  const animatedHeaderStyle = useAnimatedStyle(() => {
    if (variant !== 'tabbed' || !scrollY) {
      return {};
    }

    // Clamp scrollY to 0 if it's very small (handles floating point precision)
    // This ensures header is never slightly sticky when scroll is at top
    const clampedScrollY = scrollY.value < 1 ? 0 : scrollY.value;

    // If foregroundHeight is 0 or scrollY is 0, ensure translation is 0
    // This prevents header from being stuck in mid-scroll
    if (foregroundHeight.value === 0 || clampedScrollY === 0) {
      return {
        position: 'absolute' as const,
        zIndex: 10,
        transform: [{ translateY: 0 }],
      };
    }

    const translation = interpolate(
      clampedScrollY,
      [0, foregroundHeight.value],
      [0, -foregroundHeight.value],
      Extrapolation.CLAMP
    );

    return {
      position: 'absolute' as const,
      zIndex: 10,
      transform: [{ translateY: translation }],
    };
  });

  const animatedForegroundStyle = useAnimatedStyle(() => {
    if (variant === 'tabbed' && scrollY) {
      // Tabbed variant fade-out logic
      const clampedScrollY = scrollY.value < 1 ? 0 : scrollY.value;
      if (foregroundHeight.value === 0 || clampedScrollY === 0) {
        return {
          opacity: 1,
        };
      }
      return {
        opacity: interpolate(
          clampedScrollY,
          [0, foregroundHeight.value / 2],
          [1, 0],
          Extrapolation.CLAMP
        ),
      };
    }

    if (variant === 'sticky' && scrollY && scrollDirection) {
      const totalHeight = foregroundHeight.value + bottomContentHeight.value;

      if (totalHeight === 0) {
        return {
          opacity: 1,
          transform: [{ translateY: 0 }],
        };
      }

      const currentScrollY = scrollY.value;
      const direction = scrollDirection.value;

      // Clamp scrollY to prevent negative values and handle overscroll
      const clampedScrollY = Math.max(0, currentScrollY);

      // Immediate reveal when scrolling up - smooth animation with refined easing
      if (direction === 'up') {
        return {
          opacity: withTiming(1, {
            duration: 250,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Smoother cubic bezier
          }),
          transform: [
            {
              translateY: withTiming(0, {
                duration: 250,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              }),
            },
          ],
        };
      }

      // Early return for top position - instant response
      if (clampedScrollY === 0) {
        return {
          opacity: 1,
          transform: [{ translateY: 0 }],
        };
      }

      // Normalize scroll with bounds checking
      const normalizedScroll = Math.min(clampedScrollY / totalHeight, 1);

      // Ensure normalizedScroll is valid
      if (!Number.isFinite(normalizedScroll) || normalizedScroll < 0) {
        return {
          opacity: 1,
          transform: [{ translateY: 0 }],
        };
      }

      // Use smooth easing curve for opacity fade-out (ease-out cubic)
      // Start fading earlier for more natural feel
      const opacityProgress = Math.min(normalizedScroll * 1.2, 1); // Start fade slightly earlier
      const opacity = interpolate(opacityProgress, [0, 1], [1, 0], Extrapolation.CLAMP);

      // Translate upward smoothly - synchronized with opacity but slightly offset
      // This creates a more natural collapse effect
      const translation = -totalHeight * normalizedScroll;

      return {
        opacity,
        transform: [{ translateY: translation }],
      };
    }

    return {};
  });

  // Animated style for container to collapse height when faded out
  // Includes subtle shadow when sticky for visual depth
  const animatedContainerStyle = useAnimatedStyle(() => {
    if (variant === 'sticky' && scrollY && scrollDirection) {
      const totalHeight = foregroundHeight.value + bottomContentHeight.value;
      const paddingTop = insets.top + 10;

      if (totalHeight === 0) {
        return {
          position: 'absolute' as const,
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          height: paddingTop,
          overflow: 'hidden' as const,
          paddingTop,
        };
      }

      const currentScrollY = scrollY.value;
      const direction = scrollDirection.value;

      // Clamp scrollY to prevent negative values and handle overscroll
      const clampedScrollY = Math.max(0, currentScrollY);

      // Immediate reveal when scrolling up - refined animation
      if (direction === 'up') {
        return {
          position: 'absolute' as const,
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          height: withTiming(totalHeight + paddingTop, {
            duration: 250,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          }),
          overflow: 'hidden' as const,
          paddingTop: withTiming(paddingTop, {
            duration: 250,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          }),
          shadowOpacity: withTiming(0, {
            duration: 250,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          }),
        };
      }

      // Early return for top position - instant response
      if (clampedScrollY === 0) {
        return {
          position: 'absolute' as const,
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          height: totalHeight + paddingTop,
          overflow: 'hidden' as const,
          paddingTop,
          shadowOpacity: 0,
        };
      }

      // Normalize scroll with bounds checking
      const normalizedScroll = Math.min(clampedScrollY / totalHeight, 1);

      // Ensure normalizedScroll is valid
      if (!Number.isFinite(normalizedScroll) || normalizedScroll < 0) {
        return {
          position: 'absolute' as const,
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          height: totalHeight + paddingTop,
          overflow: 'hidden' as const,
          paddingTop,
          shadowOpacity: 0,
        };
      }

      // Use smooth interpolation for visibility
      const visibility = Math.max(0, Math.min(1, 1 - normalizedScroll));

      // Height and padding directly match visibility for perfect synchronization
      const height = (totalHeight + paddingTop) * visibility;
      const animatedPaddingTop = paddingTop * visibility;

      // Add subtle shadow when header is collapsed (sticky state)
      // Shadow intensity increases as header collapses
      const shadowOpacity = interpolate(
        visibility,
        [0, 0.3, 1],
        [0.08, 0.04, 0],
        Extrapolation.CLAMP
      );

      return {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        height,
        overflow: 'hidden' as const,
        paddingTop: animatedPaddingTop,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        shadowOpacity,
        elevation: shadowOpacity > 0 ? 4 : 0, // Android shadow
      };
    }

    return {};
  });

  // Render sticky variant
  if (variant === 'sticky') {
    // Simple sticky header - always visible, no collapse animations
    if (!scrollY || !scrollDirection) {
      return (
        <View
          className={clsx(headerContainerVariants({ variant }))}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            paddingTop: insets.top + 10,
          }}>
          {renderForeground()}
          {bottomContent && <View onLayout={handleBottomContentLayout}>{bottomContent}</View>}
        </View>
      );
    }

    // Sticky header with scroll animations
    return (
      <Animated.View
        className={clsx(headerContainerVariants({ variant }))}
        style={animatedContainerStyle}>
        <Animated.View style={animatedForegroundStyle}>
          {renderForeground()}
          {bottomContent && <View onLayout={handleBottomContentLayout}>{bottomContent}</View>}
        </Animated.View>
      </Animated.View>
    );
  }

  // Render tabbed variant
  // Header is always absolutely positioned for smooth transitions
  // Content has paddingTop to account for header height
  // When scrollY is 0, translateY is 0 (header at top)
  // When scrolling, header translates up and becomes sticky
  // Static variant - no animations, no absolute positioning
  if (variant === 'static') {
    return (
      <View className={clsx(headerContainerVariants({ variant }), 'pt-6 pb-3')}>
        {renderForeground()}
      </View>
    );
  }

  // Sticky and Tabbed variants - with animations
  return (
    <Animated.View
      className={clsx(headerContainerVariants({ variant }))}
      style={[{ paddingTop: insets.top + 10 }, animatedHeaderStyle]}>
      <Animated.View style={animatedForegroundStyle}>{renderForeground()}</Animated.View>
      {renderTabs()}
    </Animated.View>
  );
};
