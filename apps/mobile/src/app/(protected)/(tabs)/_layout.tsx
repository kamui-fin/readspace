import CompassBoldIcon from '@components/icons/solar/compass-bold';
import NotesBoldDuotoneIcon from '@components/icons/solar/notes-bold-duotone';
import { TabBarIcon } from '@components/navigation/bottom-tab-bar-icon';
import { BottomTabbar } from '@components/navigation/bottom-tabs';
import { Avatar } from '@components/ui/avatar';
import { useSession } from '@contexts/auth-context';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

export default function TabsLayout() {
  const { user } = useSession();
  const isDark = useIsDarkMode();
  const backgroundColor = isDark ? COLORS.dark.background : COLORS.light.background;

  return (
    <Tabs
      tabBar={(props) => <BottomTabbar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Following',
          tabBarLabel: 'Following',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon
              component={NotesBoldDuotoneIcon}
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
            <TabBarIcon component={CompassBoldIcon} size={size} color={color} focused={focused} />
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
  );
}
