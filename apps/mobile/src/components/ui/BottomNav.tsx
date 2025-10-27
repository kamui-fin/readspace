import { View, Pressable, Text } from 'react-native';
import { Monicon } from '@monicon/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import Animated, { useAnimatedStyle, withSpring, interpolate } from 'react-native-reanimated';
import { cn } from '@/utils/cn';

interface BottomNavItem {
  id: string;
  label: string;
  route?: string;
  iconOutline: string;
  iconBold: string;
  onPress?: () => void;
}

interface BottomNavProps {
  onExplorePress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function BottomNav({ onExplorePress }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const navItems: BottomNavItem[] = [
    {
      id: 'today',
      label: 'Today',
      route: '/(tabs)',
      iconOutline: 'solar:notes-linear',
      iconBold: 'solar:notes-bold',
    },
    {
      id: 'explore',
      label: 'Explore',
      iconOutline: 'solar:library-linear',
      iconBold: 'solar:library-bold',
      onPress: onExplorePress,
    },
    {
      id: 'discover',
      label: 'Discover',
      route: '/(tabs)/discover',
      iconOutline: 'solar:compass-outline',
      iconBold: 'solar:compass-bold',
    },
    {
      id: 'library',
      label: 'Library',
      route: '/(tabs)/library',
      iconOutline: 'solar:notebook-minimalistic-outline',
      iconBold: 'solar:notebook-minimalistic-bold',
    },
    {
      id: 'settings',
      label: 'Settings',
      route: '/(tabs)/settings',
      iconOutline: 'solar:settings-outline',
      iconBold: 'solar:settings-bold',
    },
  ];

  const isActive = (item: BottomNavItem) => {
    if (!item.route) return false;

    // Match root route
    if (item.route === '/(tabs)' && pathname === '/') {
      return true;
    }

    // Match other routes
    return pathname === item.route.replace('/(tabs)', '');
  };

  const handlePress = (item: BottomNavItem) => {
    if (item.onPress) {
      item.onPress();
    } else if (item.route) {
      router.push(item.route);
    }
  };

  return (
    <View
      className="border-t border-light-grey bg-white"
      style={{
        paddingBottom: insets.bottom,
        paddingLeft: Math.max(insets.left, 8), // Minimum 8px, but respect safe area
        paddingRight: Math.max(insets.right, 8), // Minimum 8px, but respect safe area
      }}>
      <View className="flex-row items-center justify-around py-2">
        {navItems.map((item) => {
          const active = isActive(item);

          return (
            <NavItem key={item.id} item={item} active={active} onPress={() => handlePress(item)} />
          );
        })}
      </View>
    </View>
  );
}

interface NavItemProps {
  item: BottomNavItem;
  active: boolean;
  onPress: () => void;
}

function NavItem({ item, active, onPress }: NavItemProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = withSpring(active ? 1 : 0.95, {
      damping: 15,
      stiffness: 150,
    });

    return {
      transform: [{ scale }],
    };
  });

  const iconColor = active ? '#6A994E' : '#90988B';
  const iconName = active ? item.iconBold : item.iconOutline;

  return (
    <AnimatedPressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      className={cn(
        'items-center justify-center rounded-2xl p-4 transition-opacity active:opacity-70'
      )}
      style={animatedStyle}>
      <Monicon name={iconName} size={28} color={iconColor} />
    </AnimatedPressable>
  );
}
