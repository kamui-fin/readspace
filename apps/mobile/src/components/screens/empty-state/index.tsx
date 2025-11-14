import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import type React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Monicon } from '@monicon/native';
import { COLORS } from '@lib/constants/colors';
import { useIsDarkMode } from '@hooks/useIsDarkMode';

const emptyStateVariants = cva('items-center justify-center px-6', {
  variants: {
    variant: {
      default: 'py-20',
      centered: 'flex-1',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const iconContainerVariants = cva('mb-4');

const textVariants = cva('text-center font-geist-medium text-lg text-grey dark:text-grey');

export interface EmptyStateProps extends VariantProps<typeof emptyStateVariants> {
  icon: string;
  message: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * EmptyState component for displaying empty states with an icon and message.
 * Use variant="centered" to center vertically relative to the header.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  message,
  variant = 'default',
  className,
  style,
}) => {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  return (
    <View className={clsx(emptyStateVariants({ variant }), className)} style={style}>
      <View className={clsx(iconContainerVariants())}>
        <Monicon name={icon} size={64} color={colors.grey2} />
      </View>
      <Text className={clsx(textVariants())}>{message}</Text>
    </View>
  );
};
