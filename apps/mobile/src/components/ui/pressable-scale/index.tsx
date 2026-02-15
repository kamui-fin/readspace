import clsx from 'clsx';
import { forwardRef } from 'react';
import { Pressable as RNPressable, type PressableProps as RNPressableProps } from 'react-native';

export type PressableScaleProps = RNPressableProps & {
  className?: string;
};

export const PressableScale = forwardRef<
  React.ComponentRef<typeof RNPressable>,
  PressableScaleProps
>(function PressableScale({ className, ...props }, ref) {
  return <RNPressable ref={ref} {...props} className={clsx(className)} />;
});

PressableScale.displayName = 'PressableScale';
