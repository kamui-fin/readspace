import { forwardRef, useMemo } from 'react';
import { Platform, Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';

// Platform-specific size mapping
// Android: text-md (smallest) to text-2xl (largest)
// iOS: text-sm to text-xl
const getPlatformSize = (size: string | null | undefined): string => {
  if (!size) return Platform.OS === 'android' ? 'text-lg' : 'text-base';

  const sizeMap: Record<string, { android: string; ios: string }> = {
    sm: { android: 'text-md', ios: 'text-sm' },
    base: { android: 'text-lg', ios: 'text-lg' },
    md: { android: 'text-xl', ios: 'text-lg' },
    lg: { android: 'text-2xl', ios: 'text-xl' },
    xl: { android: 'text-2xl', ios: 'text-xl' },
    '2xl': { android: 'text-3xl', ios: 'text-2xl' },
    '3xl': { android: 'text-4xl', ios: 'text-3xl' },
    '4xl': { android: 'text-5xl', ios: 'text-4xl' },
  };

  const mapping = sizeMap[size];
  if (!mapping) {
    return Platform.OS === 'android' ? 'text-lg' : 'text-base';
  }

  return Platform.OS === 'android' ? mapping.android : mapping.ios;
};

const textVariants = cva('', {
  variants: {
    fontFamily: {
      geist: 'font-geist-regular',
      'geist-medium': 'font-geist-medium',
      'geist-semibold': 'font-geist-semibold',
      'geist-bold': 'font-geist-bold',
      figtree: 'font-figtree-regular',
      'figtree-medium': 'font-figtree-medium',
      'figtree-semibold': 'font-figtree-semibold',
      'figtree-bold': 'font-figtree-bold',
      garamond: 'font-garamond-regular',
      'garamond-medium': 'font-garamond-medium',
      'garamond-semibold': 'font-garamond-semibold',
      'garamond-bold': 'font-garamond-bold',
      mono: 'font-geist-mono',
      'mono-medium': 'font-geist-mono-medium',
      'mono-semibold': 'font-geist-mono-semibold',
      'mono-bold': 'font-geist-mono-bold',
    },
  },
  defaultVariants: {
    fontFamily: 'geist',
  },
});

export type TextSize = 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export interface TextProps
  extends Omit<RNTextProps, 'className'>,
    VariantProps<typeof textVariants> {
  size?: TextSize;
  className?: string;
}

export const Text = forwardRef<RNText, TextProps>(
  ({ className, size = 'base', fontFamily, ...props }, ref) => {
    const platformSize = useMemo(() => getPlatformSize(size), [size]);

    return (
      <RNText
        ref={ref}
        className={clsx(platformSize, textVariants({ fontFamily }), className)}
        {...props}
      />
    );
  }
);

Text.displayName = 'Text';
