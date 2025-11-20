import { TabBarIcon } from '@components/navigation/bottom-tab-bar-icon';
import { BottomTabbar } from '@components/navigation/bottom-tabs';
import { Header } from '@components/navigation/header';
import { Avatar } from '@components/ui/avatar';
import { useSession } from '@contexts/auth-context';
import {
  DiscoverScrollContext,
  type DiscoverScrollContextType,
} from '@contexts/discover-scroll-context';
import { Tabs, useRouter, useSegments } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

export default function TabsLayout() {
  const segments = useSegments();
  const router = useRouter();
  const { user } = useSession();
  const currentRoute = segments[segments.length - 1] || 'index';
  const isSimilarFeedsRoute = segments.includes('similar');

  const [scrollValues, setScrollValuesState] = useState<{
    scrollY: SharedValue<number>;
    scrollDirection: SharedValue<'up' | 'down'>;
  } | null>(null);
  const [searchBar, setSearchBarState] = useState<ReactNode>(null);
  const [headerHeight, setHeaderHeightState] = useState(0);
  const [similarFeedsScrollValues, setSimilarFeedsScrollValuesState] = useState<{
    scrollY: SharedValue<number>;
    scrollDirection: SharedValue<'up' | 'down'>;
  } | null>(null);
  const [similarFeedsTitle, setSimilarFeedsTitle] = useState<string>('Similar feeds');
  const setScrollValues = useCallback(
    (newScrollY: SharedValue<number>, newScrollDirection: SharedValue<'up' | 'down'>) => {
      setScrollValuesState({
        scrollY: newScrollY,
        scrollDirection: newScrollDirection,
      });
    },
    []
  );

  const setSearchBar = useCallback((newSearchBar: ReactNode) => {
    setSearchBarState(newSearchBar);
  }, []);

  const setHeaderHeight = useCallback((height: number) => {
    setHeaderHeightState(height);
  }, []);

  const setSimilarFeedsScrollValues = useCallback(
    (newScrollY: SharedValue<number>, newScrollDirection: SharedValue<'up' | 'down'>) => {
      setSimilarFeedsScrollValuesState({
        scrollY: newScrollY,
        scrollDirection: newScrollDirection,
      });
    },
    []
  );

  const contextValue: DiscoverScrollContextType = {
    scrollY: scrollValues?.scrollY,
    scrollDirection: scrollValues?.scrollDirection,
    setScrollValues,
    searchBar,
    setSearchBar,
    headerHeight,
    setHeaderHeight,
    similarFeedsScrollValues,
    setSimilarFeedsScrollValues,
    similarFeedsTitle,
    setSimilarFeedsTitle,
  };

  // Get header config based on route
  const getHeaderConfig = (): {
    title: string;
    subtitle?: string;
    showBackButton?: boolean;
    onBackPress?: () => void;
    scrollY?: SharedValue<number>;
    scrollDirection?: SharedValue<'up' | 'down'>;
    bottomContent?: ReactNode;
    titleFontWeight?: 'bold' | 'semibold';
  } | null => {
    // Similar feeds route - use sticky header with back button
    if (isSimilarFeedsRoute) {
      return {
        title: similarFeedsTitle,
        subtitle: undefined,
        showBackButton: true,
        onBackPress: () => {
          router.back();
        },
        scrollY: similarFeedsScrollValues?.scrollY,
        scrollDirection: similarFeedsScrollValues?.scrollDirection,
        titleFontWeight: 'semibold',
      };
    }

    switch (currentRoute) {
      case 'discover':
        return {
          title: 'Discover',
          subtitle: undefined,
          bottomContent: searchBar,
          scrollY: scrollValues?.scrollY,
          scrollDirection: scrollValues?.scrollDirection,
        };
      case 'profile':
        return null; // Profile route handles its own static header
      default:
        return null; // index route handles its own header
    }
  };

  const headerConfig = getHeaderConfig();

  return (
    <DiscoverScrollContext.Provider value={contextValue}>
      {/* Render sticky header for routes that need it (discover, similar-feeds) */}
      {headerConfig && (
        <Header
          variant="sticky"
          title={headerConfig.title}
          subtitle={headerConfig.subtitle}
          showBackButton={headerConfig.showBackButton}
          onBackPress={headerConfig.onBackPress}
          scrollY={headerConfig.scrollY}
          scrollDirection={headerConfig.scrollDirection}
          bottomContent={headerConfig.bottomContent}
          titleFontWeight={headerConfig.titleFontWeight}
          onHeaderHeightChange={
            currentRoute === 'discover' || isSimilarFeedsRoute ? setHeaderHeight : undefined
          }
        />
      )}
      <Tabs
        tabBar={(props) => <BottomTabbar {...props} />}
        screenOptions={{
          headerShown: false,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Following',
            tabBarLabel: 'Following',
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon
                name="solar:notes-bold-duotone"
                size={size}
                color={color}
                focused={focused}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarLabel: 'Discover',
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon name="solar:compass-bold" size={size} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarLabel: 'Profile',
            tabBarIcon: ({ size, focused }) => (
              <View
                style={{
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  overflow: 'hidden',
                  opacity: focused ? 1 : 0.6,
                }}>
                <Avatar
                  name={user?.user_metadata?.full_name || user?.email || 'User'}
                  imageUrl={user?.user_metadata?.avatar_url}
                  size={size}
                />
              </View>
            ),
          }}
        />
      </Tabs>
    </DiscoverScrollContext.Provider>
  );
}
