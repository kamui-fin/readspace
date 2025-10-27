import { cn } from '@/utils/cn';
import { Monicon } from '@monicon/native';
import { forwardRef } from 'react';
import { Pressable, type PressableProps } from 'react-native';

export interface FABProps extends PressableProps {
    icon?: string;
    size?: 'default' | 'lg';
    className?: string;
}

export const FAB = forwardRef<React.ElementRef<typeof Pressable>, FABProps>(
    ({ icon = 'lucide:plus', size = 'lg', className, children, ...props }, ref) => {
        const iconSize = size === 'lg' ? 28 : 24;
        const containerSize = size === 'lg' ? 'h-16 w-16' : 'h-14 w-14';

        return (
            <Pressable
                ref={ref}
                className={cn(
                    'items-center justify-center rounded-full bg-primary shadow-lg transition-opacity active:opacity-80',
                    containerSize,
                    className
                )}
                {...props}>
                {children || <Monicon name={icon} size={iconSize} color="#FFFFFF" />}
            </Pressable>
        );
    }
);

FAB.displayName = 'FAB';
