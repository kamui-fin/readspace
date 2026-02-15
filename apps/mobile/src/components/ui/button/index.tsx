import { buttonVariants } from '@components/ui/button/constants/button-variants';
import { textVariants } from '@components/ui/button/constants/text-variants';
import { ThreeDotsAnimation } from '@components/ui/three-dots';
import { COLORS } from '@lib/constants/colors';
import type { VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, StyleSheet, Text, View } from 'react-native';

export interface ButtonProps
  extends Omit<PressableProps, 'children'>,
    VariantProps<typeof buttonVariants> {
  children: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  textClassName?: string;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  loading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = true,
  leftIcon,
  rightIcon,
  className,
  textClassName,
  numberOfLines,
  ellipsizeMode,
  style,
  loading = false,
  disabled = false,
  ...props
}: ButtonProps) {
  const hasIcon = Boolean(leftIcon || rightIcon);

  // Check if children is text content (string, number, or Text component with text children)
  let isTextContent = typeof children === 'string' || typeof children === 'number';
  let textContent = children;
  let textStyle;

  // Handle Text component as children - extract its props
  if (!isTextContent && typeof children === 'object' && children !== null && 'props' in children) {
    const child = children as any;
    if (child.type === Text || child.type?.displayName === 'Text') {
      isTextContent = true;
      textContent = child.props.children;
      textStyle = child.props.style;
      textClassName = clsx(child.props.className, textClassName);
    }
  }

  const isDisabled = disabled || loading;

  // Get the text color for the dots based on variant
  const dotColor =
    variant === 'primary'
      ? COLORS.white
      : variant === 'secondary'
        ? COLORS.light.secondary
        : COLORS.light.black;

  // Dynamic gap based on button size
  const gap = size === 'large' ? 8 : 6;

  // For large buttons with icons, use absolute positioning (icon at edge, text centered)
  // For medium/small buttons, center everything together
  const useCenteredLayout = size !== 'large';

  return (
    <Pressable
      className={clsx(
        buttonVariants({ variant, size, fullWidth }),
        isDisabled && 'opacity-50',
        className
      )}
      style={style}
      disabled={isDisabled}
      {...props}>
      {loading ? (
        <View style={{ transform: [{ scale: 3 }] }}>
          <ThreeDotsAnimation color={dotColor} />
        </View>
      ) : useCenteredLayout ? (
        // Medium/Small: Center everything together
        <View style={[styles.contentContainer, { gap }]}>
          {leftIcon && <View style={styles.iconSpacing}>{leftIcon}</View>}
          {isTextContent ? (
            <Text
              className={clsx(textVariants({ variant, size, hasIcon }), textClassName)}
              style={textStyle}
              numberOfLines={numberOfLines}
              ellipsizeMode={ellipsizeMode}>
              {textContent}
            </Text>
          ) : (
            children
          )}
          {rightIcon && <View style={styles.iconSpacing}>{rightIcon}</View>}
        </View>
      ) : (
        // Large: Icon at edge, text centered
        <>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          {isTextContent ? (
            <Text
              className={clsx(textVariants({ variant, size, hasIcon }), textClassName)}
              style={textStyle}
              numberOfLines={numberOfLines}
              ellipsizeMode={ellipsizeMode}>
              {textContent}
            </Text>
          ) : (
            children
          )}
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSpacing: {
    flexShrink: 0,
  },
  iconLeft: {
    position: 'absolute',
    left: 16,
    flexShrink: 0,
  },
  iconRight: {
    position: 'absolute',
    right: 16,
    flexShrink: 0,
  },
});
