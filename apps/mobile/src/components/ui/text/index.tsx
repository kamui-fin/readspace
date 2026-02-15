import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import { forwardRef } from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

const textVariants = cva('', {
  variants: {
    size: {
      sm: 'text-sm',
      base: 'text-base',
      md: 'text-md',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
      '3xl': 'text-3xl',
      '4xl': 'text-4xl',
    },
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
    variant: {
      heading: 'tracking-heading',
      body: '',
    },
  },
  defaultVariants: {
    size: 'base',
    fontFamily: 'geist',
    variant: 'body',
  },
});

export type TextSize = 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export interface TextProps
  extends Omit<RNTextProps, 'className'>,
    VariantProps<typeof textVariants> {
  className?: string;
  variant?: 'heading' | 'body';
}

export const Text = forwardRef<RNText, TextProps>(
  ({ className, size = 'base', fontFamily, variant, ...props }, ref) => {
    // Automatically apply heading variant for large text sizes if variant not specified
    const effectiveVariant =
      variant ?? (size && ['xl', '2xl', '3xl', '4xl'].includes(size) ? 'heading' : 'body');

    return (
      <RNText
        ref={ref}
        className={clsx(textVariants({ size, fontFamily, variant: effectiveVariant }), className)}
        {...props}
      />
    );
  }
);

Text.displayName = 'Text';
