import ExpandVerticalIcon from '@components/icons/local/expand-vertical';
import AltArrowRightLinearIcon from '@components/icons/solar/alt-arrow-right-linear';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import clsx from 'clsx';
import { forwardRef } from 'react';
import { Pressable, type PressableProps, StyleSheet, View } from 'react-native';

type SettingsItemVariant = 'select' | 'button' | 'link';

interface BaseSettingsItemProps extends PressableProps {
  label: string;
  variant: SettingsItemVariant;
  className?: string;
  isLast?: boolean;
  danger?: boolean;
  leftIcon?: React.ReactNode;
}

interface SelectSettingsItemProps extends BaseSettingsItemProps {
  variant: 'select';
  value: string;
  rightIcon?: never;
}

interface ButtonSettingsItemProps extends BaseSettingsItemProps {
  variant: 'button';
  value?: never;
  rightIcon?: never;
}

interface LinkSettingsItemProps extends BaseSettingsItemProps {
  variant: 'link';
  value?: never;
  rightIcon?: React.ReactNode;
}

export type SettingsItemProps =
  | SelectSettingsItemProps
  | ButtonSettingsItemProps
  | LinkSettingsItemProps;

export const SettingsItem = forwardRef<React.ElementRef<typeof Pressable>, SettingsItemProps>(
  (
    {
      label,
      variant,
      value,
      leftIcon,
      rightIcon,
      className,
      isLast = false,
      danger = false,
      ...props
    },
    ref
  ) => {
    const renderRightContent = () => {
      switch (variant) {
        case 'select':
          return (
            <View className="flex-row items-center gap-2">
              <Text size={15} fontFamily="geist" className="text-grey dark:text-grey">
                {value}
              </Text>
              <ExpandVerticalIcon width={18} height={18} color="#9FA29F" fill="#9FA29F" />
            </View>
          );
        case 'button':
          return <AltArrowRightLinearIcon width={18} height={18} color="#9FA29F" />;
        case 'link':
          return rightIcon || <AltArrowRightLinearIcon width={18} height={18} color="#9FA29F" />;
        default:
          return null;
      }
    };

    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];

    const itemBgColor = isDark ? 'rgb(32, 32, 32)' : colors.grey6;
    const dividerBgColor = isDark ? 'rgb(46, 46, 46)' : colors.grey5;

    return (
      <Pressable
        ref={ref}
        className={className}
        style={({ pressed }) => ({
          backgroundColor: itemBgColor,
          opacity: pressed ? 0.7 : 1,
        })}
        {...props}>
        <View className="flex-row items-center justify-between px-5 py-3.5">
          <View className="flex-row items-center gap-3">
            {leftIcon}
            <Text
              size={15}
              fontFamily="geist-medium"
              className={clsx(danger ? 'text-red dark:text-red' : 'text-black ')}>
              {label}
            </Text>
          </View>
          {renderRightContent()}
        </View>
        {!isLast && <View className="mx-5 h-[1px]" style={{ backgroundColor: dividerBgColor }} />}
      </Pressable>
    );
  }
);

SettingsItem.displayName = 'SettingsItem';
