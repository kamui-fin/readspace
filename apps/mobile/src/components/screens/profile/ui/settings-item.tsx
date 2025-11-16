import clsx from 'clsx';
import { forwardRef } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import { Text } from '@components/ui/text';
import { Monicon } from '@monicon/native';

type SettingsItemVariant = 'select' | 'button' | 'link';

interface BaseSettingsItemProps extends PressableProps {
  label: string;
  variant: SettingsItemVariant;
  className?: string;
  isLast?: boolean;
}

interface SelectSettingsItemProps extends BaseSettingsItemProps {
  variant: 'select';
  value: string;
  icon?: never;
}

interface ButtonSettingsItemProps extends BaseSettingsItemProps {
  variant: 'button';
  value?: never;
  icon?: never;
}

interface LinkSettingsItemProps extends BaseSettingsItemProps {
  variant: 'link';
  value?: never;
  icon: React.ReactNode;
}

export type SettingsItemProps =
  | SelectSettingsItemProps
  | ButtonSettingsItemProps
  | LinkSettingsItemProps;

export const SettingsItem = forwardRef<React.ElementRef<typeof Pressable>, SettingsItemProps>(
  ({ label, variant, value, icon, className, isLast = false, ...props }, ref) => {
    const renderRightContent = () => {
      switch (variant) {
        case 'select':
          return (
            <View className="flex-row items-center gap-2">
              <Text size="base" fontFamily="geist" className="text-grey dark:text-grey">
                {value}
              </Text>
              <Monicon name="lucide:chevrons-up-down" size={20} color="#9FA29F" />
            </View>
          );
        case 'button':
          return <Monicon name="solar:alt-arrow-right-linear" size={20} color="#9FA29F" />;
        case 'link':
          return icon;
        default:
          return null;
      }
    };

    return (
      <Pressable
        ref={ref}
        className={clsx(
          'flex-row items-center justify-between bg-background px-4 py-4 dark:bg-background-dark',
          !isLast && 'border-b border-grey5 dark:border-grey4-dark',
          className
        )}
        style={({ pressed }) => ({
          opacity: pressed ? 0.7 : 1,
        })}
        {...props}>
        <Text size="base" fontFamily="geist" className="text-black dark:text-black-dark">
          {label}
        </Text>
        {renderRightContent()}
      </Pressable>
    );
  }
);

SettingsItem.displayName = 'SettingsItem';
