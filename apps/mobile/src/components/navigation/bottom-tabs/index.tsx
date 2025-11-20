import {
  FeedSwitcherBottomSheet,
  type FeedSwitcherBottomSheetRef,
} from '@components/bottom-sheets/feed-switcher';
import { WIDTH } from '@components/navigation/bottom-tabs/constants';
import { AnimatedTab } from '@components/navigation/bottom-tabs/ui/animated-tab';
import { styles } from '@components/navigation/bottom-tabs/ui/bottom-tab-bar/bottom-tab-bar.styles';
import { ExpandTab } from '@components/navigation/bottom-tabs/ui/expand-tab';
import { BlurView } from '@components/ui/blurview';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const isDark = useIsDarkMode();
  const tabBarColors = COLORS[isDark ? 'dark' : 'light'];
  const animationProgress = useSharedValue(0);
  const feedSwitcherRef = useRef<FeedSwitcherBottomSheetRef>(null);

  const animatedTabBarStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      animationProgress.value,
      [0, 0.5, 1],
      [1, 0.5, 1],
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      animationProgress.value,
      [0, 0.5, 1],
      [0, -10, -20],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }, { translateY }],
    };
  });

  const animatedFloatingBarStyle = useAnimatedStyle(() => {
    const height = interpolate(
      animationProgress.value,
      [0, 0.4, 0.7, 1],
      [50, 50, 250, 400],
      Extrapolation.CLAMP
    );

    const borderRadius = interpolate(
      animationProgress.value,
      [0, 0.2, 1],
      [25, 100, 40],
      Extrapolation.CLAMP
    );

    return {
      height,
      borderRadius,
      width: WIDTH - 150,
    };
  });

  const animatedOriginalTabBarStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      animationProgress.value,
      [0, 0.25, 0.4],
      [1, 0.2, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      pointerEvents: animationProgress.value > 0.25 ? 'none' : 'auto',
    };
  });

  const handleExpandTabPress = (): void => {
    feedSwitcherRef.current?.present();
  };

  const filteredRouteTabs = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    return options?.tabBarIcon !== undefined;
  });

  const blurTint = isDark ? 'systemThickMaterialDark' : 'systemThickMaterialLight';

  return (
    <View style={styles.gestureContainer}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Animated.View style={[styles.container, { flex: 1, marginRight: 12 }]}>
          <Animated.View
            style={[styles.floatingBarWrapper, animatedFloatingBarStyle, animatedTabBarStyle]}>
            <BlurView intensity={100} tint={blurTint} style={styles.blurView}>
              <Animated.View style={[styles.floatingBar, animatedOriginalTabBarStyle]}>
                {filteredRouteTabs.map((route, index) => {
                  const { options } = descriptors[route.key];
                  const isFocused = state.index === state.routes.indexOf(route);

                  const onPress = (): void => {
                    const event = navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                      navigation.navigate(route.name, route.params);
                    }
                  };

                  const onLongPress = (): void => {
                    navigation.emit({
                      type: 'tabLongPress',
                      target: route.key,
                    });
                  };

                  // Insert ExpandTab before the last tab (profile)
                  const isLastTab = index === filteredRouteTabs.length - 1;

                  return (
                    <React.Fragment key={route.key}>
                      {isLastTab && (
                        <ExpandTab
                          onPress={handleExpandTabPress}
                          animationProgress={animationProgress}
                          colors={tabBarColors}
                        />
                      )}
                      <AnimatedTab
                        isFocused={isFocused}
                        options={options}
                        colors={tabBarColors}
                        onPress={onPress}
                        onLongPress={onLongPress}
                        animationProgress={animationProgress}
                        index={index}
                      />
                    </React.Fragment>
                  );
                })}
              </Animated.View>
            </BlurView>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Feed Switcher Bottom Sheet */}
      <FeedSwitcherBottomSheet ref={feedSwitcherRef} />
    </View>
  );
};

export { BottomTabBar as BottomTabbar };
