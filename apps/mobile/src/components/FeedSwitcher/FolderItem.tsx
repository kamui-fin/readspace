import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/utils/cn';
import { Monicon } from '@monicon/native';
import type { Folder } from '@readspace/shared';
import { forwardRef } from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';

export interface FolderItemProps extends Omit<PressableProps, 'children'> {
    folder: Folder;
    unreadCount: number;
    isExpanded: boolean;
    isEditMode?: boolean;
    isSelected?: boolean;
    isEmpty?: boolean;
    onPress?: () => void;
    onToggleExpand?: () => void;
    onLongPress?: () => void;
    className?: string;
}

export const FolderItem = forwardRef<React.ElementRef<typeof Pressable>, FolderItemProps>(
    (
        {
            folder,
            unreadCount,
            isExpanded,
            isEditMode = false,
            isSelected = false,
            isEmpty = false,
            onPress,
            onToggleExpand,
            onLongPress,
            className,
            ...props
        },
        ref
    ) => {
        const handlePress = () => {
            if (isEditMode) {
                onPress?.();
            } else {
                onPress?.();
            }
        };

        const handleLongPress = () => {
            if (!isEditMode) {
                onLongPress?.();
            }
        };

        const handleChevronPress = (e: any) => {
            e.stopPropagation();
            onToggleExpand?.();
        };

        // Determine folder icon based on state
        const getFolderIcon = () => {
            if (isExpanded) {
                return isEmpty ? 'solar:folder-open-linear' : 'solar:folder-open-bold';
            } else {
                return isEmpty ? 'solar:folder-with-files-linear' : 'solar:folder-with-files-bold';
            }
        };

        return (
            <Pressable
                ref={ref}
                onPress={handlePress}
                onLongPress={handleLongPress}
                delayLongPress={500}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className={cn(
                    'flex-row items-center gap-3 py-3 transition-opacity active:opacity-70',
                    className
                )}
                {...props}>
                {/* Icon or Checkbox */}
                {isEditMode ? (
                    <Checkbox checked={isSelected} />
                ) : (
                    <Monicon name={getFolderIcon()} size={24} color="#6A994E" />
                )}

                {/* Folder Name */}
                <Text className="flex-1 font-geist-medium text-base text-grey" numberOfLines={1}>
                    {folder.name}
                </Text>

                {/* Unread Badge */}
                {unreadCount > 0 && <Badge label={unreadCount.toString()} />}

                {/* Chevron Icon with larger hit area */}
                {!isEditMode && (
                    <Pressable
                        onPress={handleChevronPress}
                        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                        className="transition-opacity active:opacity-70">
                        <Monicon
                            name={
                                isExpanded
                                    ? 'solar:alt-arrow-down-linear'
                                    : 'solar:alt-arrow-right-linear'
                            }
                            size={20}
                            color="#90988B"
                        />
                    </Pressable>
                )}
            </Pressable>
        );
    }
);

FolderItem.displayName = 'FolderItem';
