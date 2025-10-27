import { cn } from '@/utils/cn';
import { Monicon } from '@monicon/native';
import { forwardRef } from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';

export interface TabProps extends PressableProps {
    label: string;
    iconName: string;
    active?: boolean;
}

export const Tab = forwardRef<React.ElementRef<typeof Pressable>, TabProps>(
    ({ label, iconName, active = false, className, ...props }, ref) => {
        // Convert icon name from linear to bold when active
        const displayIconName = active ? iconName.replace('-linear', '-bold') : iconName;

        return (
            <Pressable
                ref={ref}
                className={cn(
                    'flex-row items-center gap-1.5 rounded px-3 py-2',
                    active ? 'bg-secondary/10' : 'bg-light-grey/60',
                    className
                )}
                {...props}>
                <Monicon
                    name={displayIconName}
                    size={16}
                    strokeWidth={2}
                    color={active ? '#6A994E' : '#90988B'}
                />
                <Text
                    className={cn(
                        'font-geist-medium text-sm',
                        active ? 'font-geist-bold text-secondary' : 'text-grey'
                    )}>
                    {label}
                </Text>
            </Pressable>
        );
    }
);

Tab.displayName = 'Tab';
