import { HeaderForeground } from '@components/navigation/header/ui/header-foreground';
import { HeaderTabs } from '@components/navigation/header/ui/header-tabs';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import clsx from 'clsx';
import Constants from 'expo-constants';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { headerContainerVariants } from '@/components/navigation/header/constants/header-variants';
import type { HeaderProps } from '@/components/navigation/header/types';

export const Header: React.FC<HeaderProps> = (props) => {
  const {
    title,
    titleIcon,
    subtitle,
    unreadCount,
    showBackButton = false,
    onBackPress,
    actions = [],
    variant,
    bottomContent,
    titleFontWeight = 'bold',
    titleSize,
    transparentBackground = false,
    disableSafeAreaTop = false,
    disableCenteredLayout = false,
    className,
    rightElement,
  } = props;

  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const headerBgColor = transparentBackground ? 'transparent' : colors.card;
  const insets = useSafeAreaInsets();
  const safeAreaTop = disableSafeAreaTop
    ? 0
    : insets.top > 0
      ? insets.top
      : Constants.statusBarHeight;

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
      // Only report height when both foreground and tabs have been measured
      if (foregroundHeightState > 0 && tabsHeight > 0) {
        const totalHeight = safeAreaTop + 10 + foregroundHeightState + tabsHeight;
        if (onHeaderHeightChange) {
          onHeaderHeightChange(totalHeight);
        }
      }
    }
  }, [foregroundHeightState, tabsHeight, onHeaderHeightChange, variant, safeAreaTop]);

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

  const [stickyContainerHeight, setStickyContainerHeight] = useState(0);

  const handleStickyContainerLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const height = e.nativeEvent.layout.height;
      if (Math.abs(height - stickyContainerHeight) > 0.5) {
        setStickyContainerHeight(height);
        // For simple sticky headers without scroll, directly report the measured height
        if (variant === 'sticky' && onHeaderHeightChange) {
          onHeaderHeightChange(height);
        }
      }
    },
    [stickyContainerHeight, variant, onHeaderHeightChange]
  );

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

    const translation =
      foregroundHeight.value > 0
        ? interpolate(
            clampedScrollY,
            [0, foregroundHeight.value],
            [0, -foregroundHeight.value],
            Extrapolation.CLAMP
          )
        : 0;

    const isSticky = clampedScrollY > 50; // Threshold to consider sticky

    // Prevent animating values on initial mount (when foregroundHeight is still 0)
    // to avoid the header starting offset/high and sliding down.
    const targetPaddingTop = isSticky ? safeAreaTop : safeAreaTop + 10;
    const animatedPaddingTop =
      foregroundHeight.value === 0
        ? targetPaddingTop
        : withTiming(targetPaddingTop, {
            duration: 200,
            easing: Easing.out(Easing.quad),
          });

    const shadowOpacity =
      foregroundHeight.value === 0
        ? 0
        : withTiming(isSticky ? (isDark ? 0.22 : 0.06) : 0, {
            duration: 200,
          });

    const shadowRadius =
      foregroundHeight.value === 0
        ? 0
        : withTiming(isSticky ? 8 : 0, {
            duration: 200,
          });

    const shadowOffsetHeight =
      foregroundHeight.value === 0
        ? 0
        : withTiming(isSticky ? 3 : 0, {
            duration: 200,
          });

    const elevation =
      foregroundHeight.value === 0
        ? 0
        : withTiming(isSticky ? 4 : 0, {
            duration: 200,
          });

    return {
      position: 'absolute' as const,
      zIndex: 10,
      transform: [{ translateY: translation }],
      paddingTop: animatedPaddingTop,
      borderBottomWidth: 0,
      backgroundColor: headerBgColor,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: shadowOffsetHeight },
      shadowOpacity: shadowOpacity,
      shadowRadius: shadowRadius,
      elevation: elevation,
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
      const paddingTop = safeAreaTop + 10;

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
        backgroundColor: headerBgColor,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        shadowOpacity,
        elevation: shadowOpacity > 0 ? 4 : 0, // Android shadow
      };
    }

    return {};
  });

  const renderForeground = () => (
    <HeaderForeground
      title={title}
      titleIcon={titleIcon}
      subtitle={subtitle}
      unreadCount={unreadCount}
      showBackButton={showBackButton}
      onBackPress={onBackPress}
      actions={actions}
      titleFontWeight={titleFontWeight}
      onTitlePress={onTitlePress}
      titleSize={titleSize}
      colors={colors}
      onLayout={handleForegroundLayout}
      rightElement={rightElement}
      disableCenteredLayout={disableCenteredLayout}
    />
  );

  const renderTabs = () => {
    if (variant !== 'tabbed') return null;
    return (
      <HeaderTabs
        activeTab={activeTab}
        onTabChange={onTabChange}
        showSort={showSort}
        onSortPress={onSortPress}
        actionButton={actionButton}
        colors={colors}
        onLayout={handleTabsLayout}
      />
    );
  };

  // Render sticky variant
  if (variant === 'sticky') {
    // Simple sticky header - always visible, no collapse animations
    if (!scrollY || !scrollDirection) {
      return (
        <View
          className={clsx(headerContainerVariants({ variant }), className)}
          onLayout={handleStickyContainerLayout}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            paddingTop: safeAreaTop + 10,
            backgroundColor: headerBgColor,
          }}>
          {renderForeground()}
          {bottomContent && <View onLayout={handleBottomContentLayout}>{bottomContent}</View>}
        </View>
      );
    }

    // Sticky header with scroll animations
    return (
      <Animated.View
        className={clsx(headerContainerVariants({ variant }), className)}
        style={[animatedContainerStyle, { backgroundColor: headerBgColor }]}>
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
      <View
        className={clsx(headerContainerVariants({ variant }), 'pb-2', className)}
        style={{
          backgroundColor: headerBgColor,
          paddingTop: safeAreaTop + 10,
        }}>
        {renderForeground()}
      </View>
    );
  }

  // Sticky and Tabbed variants - with animations
  return (
    <>
      {variant === 'tabbed' && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: safeAreaTop,
            backgroundColor: headerBgColor,
            zIndex: 11,
          }}
        />
      )}
      <Animated.View
        className={clsx(headerContainerVariants({ variant }), className)}
        style={[
          { paddingTop: safeAreaTop + 10, backgroundColor: headerBgColor },
          animatedHeaderStyle,
        ]}>
        <Animated.View style={animatedForegroundStyle}>{renderForeground()}</Animated.View>
        {renderTabs()}
      </Animated.View>
    </>
  );
};
