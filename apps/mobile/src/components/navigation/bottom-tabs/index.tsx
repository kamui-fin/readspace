import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlurView } from '@components/ui/blurview';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { BOTTOM_TABBAR_BASE_HEIGHT } from '@lib/constants/app';
import { COLORS } from '@lib/constants/colors';

export const ThemeBottomTabbar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const colorScheme = useColorScheme();
  const colors = COLORS[colorScheme ?? 'light'];

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: 'transparent',
        paddingTop: 8,
        paddingHorizontal: 20,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 72,
      }}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const color = focused ? colors.secondary : colors.inactive_tint;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate({
              name: route.name,
              merge: true,
              params: route.params,
            });
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <View
            key={route.key}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 44,
              minHeight: 44,
            }}>
            <Pressable
              onLongPress={onLongPress}
              onPress={onPress}
              hitSlop={10}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
              }}>
              {options.tabBarIcon?.({ focused, color, size: 28 })}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
};

export const BottomTabbar = (props: BottomTabBarProps) => {
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const isDark = useIsDarkMode();
  const colorScheme = useColorScheme();

  const blurType = isDark ? 'dark' : 'light';

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: BOTTOM_TABBAR_BASE_HEIGHT + 0.8 * safeAreaBottom,
        overflow: 'hidden',
        backgroundColor: Platform.select({
          ios: COLORS[colorScheme ?? 'light'].tab_bar_background_ios,
          default: COLORS[colorScheme ?? 'light'].tab_bar_background_default,
        }),
      }}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={100} tint={blurType} style={[StyleSheet.absoluteFillObject]} />
      ) : null}
      <ThemeBottomTabbar {...props} />
    </View>
  );
};
