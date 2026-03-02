import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';

import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import type React from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

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

export interface EmptyStateProps extends VariantProps<typeof emptyStateVariants> {
  icon: React.ComponentType<{
    width?: number;
    height?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  message: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * EmptyState component for displaying empty states with an icon and message.
 * Use variant="centered" to center vertically relative to the header.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: IconComponent,
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
        <IconComponent width={64} height={64} color={colors.grey2} />
      </View>
      <Text size="lg" fontFamily="geist-medium" className="text-center text-grey dark:text-grey">
        {message}
      </Text>
    </View>
  );
};
