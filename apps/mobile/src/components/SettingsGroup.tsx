import { cn } from '@/utils/cn';
import { Monicon } from '@monicon/native';
import { forwardRef } from 'react';
import { Pressable, Text, View, type PressableProps } from 'react-native';

interface SettingsGroupProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

export const SettingsGroup = ({ title, children, className }: SettingsGroupProps) => {
    return (
        <View className={cn('gap-2', className)}>
            <Text className="font-geist-semibold text-sm text-grey dark:text-grey-dark">{title}</Text>
            <View className="overflow-hidden rounded-2xl bg-light-grey dark:bg-light-grey-dark">{children}</View>
        </View>
    );
};

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
                            <Text className="font-geist text-base text-grey dark:text-grey-dark">{value}</Text>
                            <Monicon name="lucide:chevrons-up-down" size={20} color="#90988B" />
                        </View>
                    );
                case 'button':
                    return (
                        <Monicon name="solar:alt-arrow-right-linear" size={20} color="#90988B" />
                    );
                case 'link':
                    return icon;
                default:
                    return null;
            }
        };

        return (
            <Pressable
                ref={ref}
                className={cn(
                    'flex-row items-center justify-between bg-white dark:bg-white-dark px-4 py-4 pl-0 transition-opacity active:opacity-80',
                    !isLast && 'border-b border-light-grey dark:border-mid-grey-dark',
                    className
                )}
                {...props}>
                <Text className="font-geist text-base text-black dark:text-black-dark">{label}</Text>
                {renderRightContent()}
            </Pressable>
        );
    }
);

SettingsItem.displayName = 'SettingsItem';
