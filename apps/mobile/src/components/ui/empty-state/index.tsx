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
  title?: string;
  message?: string; // Backwards compatibility fallback for title
  description?: string;
  actionButton?: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * EmptyState component for displaying empty states with an icon and message.
 * Use variant="centered" to center vertically relative to the header.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: IconComponent,
  title,
  message,
  description,
  actionButton,
  variant = 'default',
  className,
  style,
}) => {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];
  const displayTitle = title || message || '';

  return (
    <View className={clsx(emptyStateVariants({ variant }), className)} style={style}>
      {/* Premium brand-colored circular icon container */}
      <View
        className="mb-5 items-center justify-center rounded-full border"
        style={{
          width: 88,
          height: 88,
          backgroundColor: colors.primary_light,
          borderColor: colors.primary + '20', // 12% opacity brand border
        }}>
        <IconComponent width={36} height={36} color={colors.primary} />
      </View>

      {/* Main Title/Message */}
      <Text
        size="lg"
        fontFamily="geist-semibold"
        className="text-center"
        style={{ color: colors.black, lineHeight: 26 }}>
        {displayTitle}
      </Text>

      {/* Descriptive subtext */}
      {description && (
        <Text
          size="sm"
          fontFamily="geist"
          className="mt-2 max-w-[280px] text-center"
          style={{ color: colors.grey, lineHeight: 20 }}>
          {description}
        </Text>
      )}

      {/* Optional Call to Action */}
      {actionButton && <View className="mt-5">{actionButton}</View>}
    </View>
  );
};
