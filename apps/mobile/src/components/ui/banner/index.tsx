import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

const bannerVariants = cva('flex-row items-center px-4 py-2 rounded-xl', {
  variants: {
    variant: {
      preview: '',
      info: '',
      warning: '',
      error: '',
      success: '',
    },
  },
  defaultVariants: {
    variant: 'preview',
  },
});

const bannerTextVariants = cva('font-geist-semibold text-[15px] leading-5', {
  variants: {
    variant: {
      preview: '',
      info: '',
      warning: '',
      error: '',
      success: '',
    },
  },
  defaultVariants: {
    variant: 'preview',
  },
});

export interface BannerProps extends VariantProps<typeof bannerVariants> {
  icon?: ReactNode;
  title: string;
  actionButton?: ReactNode;
  className?: string;
}

export function Banner({ icon, title, actionButton, variant = 'preview', className }: BannerProps) {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const getBackgroundColor = () => {
    if (variant === 'preview') {
      return isDark
        ? 'rgba(234, 88, 12, 1)' // Dark mode: orange-600 fully opaque
        : 'rgba(255, 247, 237, 1)'; // Light mode: orange-50 fully opaque
    }
    // Add other variants as needed
    return colors.background;
  };

  const getTextColor = () => {
    if (variant === 'preview') {
      return '#ea580c'; // orange-600
    }
    // Add other variants as needed
    return colors.black;
  };

  return (
    <View
      className={clsx(bannerVariants({ variant }), className)}
      style={{
        backgroundColor: getBackgroundColor(),
      }}>
      {icon && <View className="mr-2">{icon}</View>}
      <Text
        className={clsx(bannerTextVariants({ variant }), 'mr-4 flex-shrink')}
        style={{ color: getTextColor() }}
        numberOfLines={1}>
        {title}
      </Text>
      {actionButton && <View className="ml-auto flex-shrink-0">{actionButton}</View>}
    </View>
  );
}
