import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import React, { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

const chipVariants = cva('flex-row items-center rounded-full', {
  variants: {
    variant: {
      filled: '',
      text: '',
    },
    size: {
      small: 'px-2 py-1.5',
      medium: 'px-3 py-2.5',
      category: 'px-5 py-3 justify-center',
    },
    selected: {
      true: '',
      false: '',
    },
  },
  compoundVariants: [
    {
      variant: 'filled',
      selected: true,
      class: 'bg-secondary dark:bg-secondary',
    },
    {
      variant: 'filled',
      selected: false,
      class: 'bg-grey5 ',
    },
  ],
  defaultVariants: {
    variant: 'filled',
    size: 'small',
    selected: false,
  },
});

const chipTextVariants = cva('font-geist-medium', {
  variants: {
    size: {
      small: 'text-xs',
      medium: 'text-sm',
      category: 'text-sm',
    },
    selected: {
      true: '',
      false: '',
    },
  },
  defaultVariants: {
    size: 'small',
    selected: false,
  },
});

export type ChipProps = {
  label: string;
  className?: string;
  icon?: ReactNode;
  textClassName?: string;
  onPress?: () => void;
} & VariantProps<typeof chipVariants>;

export const Chip = ({
  label,
  className,
  icon,
  variant = 'filled',
  size = 'small',
  textClassName,
  selected = false,
  onPress,
}: ChipProps) => {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const textColor = selected ? colors.white : textClassName ? undefined : colors.grey;

  const content = (
    <View className={clsx(chipVariants({ variant, size, selected }), className)}>
      {React.isValidElement(icon) && <View className="mr-1.5">{icon}</View>}
      <Text
        className={clsx(chipTextVariants({ size, selected }), textClassName)}
        style={textColor ? { color: textColor } : undefined}>
        {label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="transition-opacity active:opacity-60">
        {content}
      </Pressable>
    );
  }

  return content;
};
