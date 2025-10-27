import { cn } from '@/utils/cn';
import { forwardRef } from 'react';
import { Text, type TextProps } from 'react-native';

export interface PageHeadingProps extends TextProps {
  children: React.ReactNode;
  className?: string;
}

export const PageHeading = forwardRef<React.ElementRef<typeof Text>, PageHeadingProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <Text
        ref={ref}
        className={cn('font-figtree text-3xl tracking-heading text-black', className)}
        {...props}>
        {children}
      </Text>
    );
  }
);

PageHeading.displayName = 'PageHeading';
