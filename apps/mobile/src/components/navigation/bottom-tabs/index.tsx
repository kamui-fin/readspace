import React, { useRef } from 'react';
import { View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';

import { BlurView } from '@components/ui/blurview';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { styles } from '@/components/navigation/bottom-tabs/ui/bottom-tab-bar/bottom-tab-bar.styles';
import { ANIMATION_DURATION, WIDTH } from '@components/navigation/bottom-tabs/constants';
import { AnimatedTab } from '@components/navigation/bottom-tabs/ui/animated-tab';
import { ExpandTab } from '@components/navigation/bottom-tabs/ui/expand-tab';
import {
  FeedSwitcherBottomSheet,
  type FeedSwitcherBottomSheetRef,
} from '@components/bottom-sheets/feed-switcher';

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const isDark = useIsDarkMode();
  const tabBarColors = COLORS[isDark ? 'dark' : 'light'];
  const animationProgress = useSharedValue(0);
  const feedSwitcherRef = useRef<FeedSwitcherBottomSheetRef>(null);

  const startY = useSharedValue(0);
  const translationY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onStart(async () => {
      startY.value = 0;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    })
    .onUpdate((event) => {
      translationY.value = event.translationY;
    })
    .onEnd((event) => {
      const velocity = event.velocityY;
      const threshold = 500;

      if (velocity < -threshold && animationProgress.value === 0) {
        animationProgress.value = withTiming(1, {
          duration: ANIMATION_DURATION,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
      } else if (velocity > threshold && animationProgress.value === 1) {
        animationProgress.value = withTiming(0, {
          duration: ANIMATION_DURATION,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
      } else if (animationProgress.value > 0.8) {
        animationProgress.value = withTiming(0, {
          duration: ANIMATION_DURATION,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
      }
      scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
      translationY.value = 0;
    });

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    feedSwitcherRef.current?.present();
  };

  const filteredRouteTabs = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    return options?.tabBarIcon !== undefined;
  });

  const blurTint = isDark ? 'systemThickMaterialDark' : 'systemThickMaterialLight';

  return (
    <GestureHandlerRootView style={styles.gestureContainer}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <GestureDetector gesture={panGesture}>
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
        </GestureDetector>
      </View>

      {/* Feed Switcher Bottom Sheet */}
      <FeedSwitcherBottomSheet ref={feedSwitcherRef} />
    </GestureHandlerRootView>
  );
};

export { BottomTabBar as BottomTabbar };
