import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import { forwardRef } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import { Text } from '@components/ui/text';

const radioVariants = cva(
  'flex-row items-center gap-3 rounded-2xl bg-grey6 px-5 py-4 transition-opacity active:opacity-80 ',
  {
    variants: {},
    defaultVariants: {},
  }
);

export interface RadioProps
  extends Omit<PressableProps, 'children'>,
    VariantProps<typeof radioVariants> {
  label: string;
  selected?: boolean;
  className?: string;
  labelClassName?: string;
}

export const Radio = forwardRef<React.ElementRef<typeof Pressable>, RadioProps>(
  ({ label, selected, className, labelClassName, ...props }, ref) => {
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];

    return (
      <Pressable
        ref={ref}
        className={clsx(radioVariants(), className)}
        style={{
          backgroundColor: colors.grey6,
          borderWidth: 1,
          borderColor: isDark ? colors.grey5 : 'transparent',
        }}
        {...props}>
        <View
          className="h-6 w-6 items-center justify-center rounded-full border-2"
          style={{
            borderColor: selected ? colors.secondary : (isDark ? colors.grey4 : colors.grey3),
          }}>
          {selected && (
            <View
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor: colors.secondary,
              }}
            />
          )}
        </View>
        <Text
          className={clsx(
            'font-geist-medium text-base text-black ',
            labelClassName
          )}>
          {label}
        </Text>
      </Pressable>
    );
  }
);

Radio.displayName = 'Radio';
