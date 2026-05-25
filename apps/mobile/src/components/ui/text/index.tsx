import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import { forwardRef } from 'react';
import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';

const hasColorStyle = (style: any): boolean => {
  if (!style) return false;
  if (Array.isArray(style)) {
    return style.some((s) => hasColorStyle(s));
  }
  return typeof style === 'object' && 'color' in style && style.color !== undefined;
};

const getExplicitColorAndOpacity = (
  className: string | undefined,
  colors: any,
  isDark: boolean
): { color?: string; opacity?: number } => {
  if (!className) return { color: colors.primary_foreground };

  const classes = className.split(/\s+/);
  let color: string | undefined = undefined;
  let opacity: number | undefined = undefined;
  
  for (let i = classes.length - 1; i >= 0; i--) {
    const cls = classes[i];
    if (cls.startsWith('text-')) {
      const baseClass = cls.split('/')[0];
      
      // Skip text alignment and sizes
      const isSizeOrAlign = [
        'text-xs', 'text-sm', 'text-base', 'text-md', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl',
        'text-left', 'text-center', 'text-right', 'text-justify'
      ].includes(baseClass);
      
      if (isSizeOrAlign) {
        continue;
      }
      
      let cleanCls = cls;
      let opacityValue: number | undefined = undefined;
      
      if (cls.includes('/')) {
        const parts = cls.split('/');
        cleanCls = parts[0];
        const parsedOpacity = parseInt(parts[1], 10);
        if (!isNaN(parsedOpacity)) {
          opacityValue = parsedOpacity / 100;
        }
      }
      
      if (cleanCls === 'text-primary') color = isDark ? colors.secondary : colors.primary;
      else if (cleanCls === 'text-primary-foreground') color = colors.primary_foreground;
      else if (cleanCls === 'text-secondary') color = colors.secondary;
      else if (cleanCls === 'text-grey') color = colors.grey;
      else if (cleanCls === 'text-grey2') color = colors.grey2;
      else if (cleanCls === 'text-grey3') color = colors.grey3;
      else if (cleanCls === 'text-grey4') color = colors.grey4;
      else if (cleanCls === 'text-grey5') color = colors.grey5;
      else if (cleanCls === 'text-grey6') color = colors.grey6;
      else if (cleanCls === 'text-black') color = colors.black;
      else if (cleanCls === 'text-white') color = '#ffffff';
      else if (cleanCls === 'text-destructive') color = colors.destructive;
      else if (cleanCls === 'text-red') color = colors.red;
      else if (cleanCls === 'text-blue') color = colors.blue;
      
      if (color) {
        opacity = opacityValue;
        break;
      }
    }
  }

  return { color: color || colors.primary_foreground, opacity };
};



const textVariants = cva('text-primary-foreground', {
  variants: {
    size: {
      xs: 'text-xs',
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
      'geist-regular': 'font-geist-regular',
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

export type TextSize = 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | number;

export interface TextProps
  extends Omit<RNTextProps, 'className'>,
  Omit<VariantProps<typeof textVariants>, 'size'> {
  size?: TextSize;
  className?: string;
  variant?: 'heading' | 'body';
}

export const Text = forwardRef<RNText, TextProps>(
  ({ className, size = 'base', fontFamily, variant, style, ...props }, ref) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];

    // Automatically apply heading variant for large text sizes if variant not specified
    const effectiveVariant =
      variant ??
      (typeof size === 'string' && ['xl', '2xl', '3xl', '4xl'].includes(size) ? 'heading' : 'body');

    const sizeVariant =
      typeof size === 'string' ? (size as VariantProps<typeof textVariants>['size']) : undefined;
    
    // Build combined style, appending JS-backed color overrides when not specified inline
    const customStyle: any = typeof size === 'number' ? { fontSize: size } : {};
    
    if (!hasColorStyle(style)) {
      const { color, opacity } = getExplicitColorAndOpacity(className, colors, isDark);
      if (color) {
        customStyle.color = color;
      }
      if (opacity !== undefined) {
        const flatStyle = style ? StyleSheet.flatten(style) : {};
        if (flatStyle.opacity === undefined) {
          customStyle.opacity = opacity;
        }
      }
    }

    return (
      <RNText
        ref={ref}
        className={clsx(
          textVariants({ size: sizeVariant, fontFamily, variant: effectiveVariant }),
          className
        )}
        style={[customStyle, style]}
        {...props}
      />
    );
  }
);

Text.displayName = 'Text';
