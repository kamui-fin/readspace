import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { Monicon } from '@monicon/native';
import { cva } from 'class-variance-authority';
import clsx from 'clsx';
import type { PressableProps } from 'react-native';
import { Pressable, Text, View } from 'react-native';

const tabVariants = cva('flex-row items-center justify-center px-4 py-2.5 rounded-lg', {
  variants: {
    active: {
      true: '',
      false: 'bg-transparent',
    },
  },
  defaultVariants: {
    active: false,
  },
});

const tabTextVariants = cva('font-geist-medium text-base', {
  variants: {
    active: {
      true: 'text-secondary',
      false: 'text-grey dark:text-grey',
    },
  },
  defaultVariants: {
    active: false,
  },
});

export interface TabProps extends Omit<PressableProps, 'children'> {
  label: string;
  active?: boolean;
  iconName?: string;
  onPress?: () => void;
}

export function Tab({ label, active = false, iconName, onPress, ...props }: TabProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  // Use a very light tint of secondary color for active tab background
  // Secondary: #6A994E -> Very light tint: rgba(106, 153, 78, 0.15) or lighter
  const activeBgColor = isDark
    ? 'rgba(106, 153, 78, 0.2)' // Slightly more visible in dark mode
    : 'rgba(106, 153, 78, 0.12)'; // Very light tint for light mode

  return (
    <Pressable
      className={clsx(tabVariants({ active }))}
      style={active ? { backgroundColor: activeBgColor } : undefined}
      onPress={onPress}
      {...props}>
      {iconName && (
        <Monicon name={iconName} size={18} color={active ? colors.secondary : colors.grey} />
      )}
      {iconName && <View className="w-2" />}
      <Text className={clsx(tabTextVariants({ active }))}>{label}</Text>
    </Pressable>
  );
}
