import { cn } from '@/utils/cn';
import { Monicon } from '@monicon/native';
import { forwardRef } from 'react';
import { Image, Pressable, Text, View, type PressableProps } from 'react-native';

export interface ArticleListItemProps extends PressableProps {
  source: string;
  timestamp: string;
  title: string;
  description?: string;
  imageUrl?: string;
  faviconUrl?: string;
  isRead?: boolean;
  isSaved?: boolean;
  className?: string;
}

export const ArticleListItem = forwardRef<React.ElementRef<typeof Pressable>, ArticleListItemProps>(
  (
    {
      source,
      timestamp,
      title,
      description,
      imageUrl,
      faviconUrl,
      isRead = false,
      isSaved = false,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <Pressable
        ref={ref}
        className={cn('flex-row gap-3 bg-white py-4', isRead && 'opacity-60', className)}
        {...props}>
        {/* Content */}
        <View className="flex-1">
          {/* Header */}
          <View className="mb-2 flex-row items-center gap-2">
            {/* Favicon */}
            {faviconUrl ? (
              <Image source={{ uri: faviconUrl }} className="h-4 w-4 rounded-sm" />
            ) : (
              <View className="h-4 w-4 rounded-sm bg-mid-grey" />
            )}

            <Text className={cn('font-geist text-xs', isRead ? 'text-grey' : 'text-grey')}>
              {source}
            </Text>

            {isSaved && <Monicon name="solar:bookmark-bold" size={16} color="#FBBC04" />}

            <Monicon name="solar:clock-circle-linear" size={14} color="#90988B" />

            <Text className="font-geist text-xs text-grey">{timestamp}</Text>
          </View>

          {/* Title */}
          <Text
            className={cn(
              'mb-2 font-geist-semibold text-base leading-5',
              isRead ? 'text-grey' : 'text-black'
            )}
            numberOfLines={3}>
            {title}
          </Text>

          {/* Description */}
          {description && (
            <Text className="font-geist text-sm leading-5 text-grey" numberOfLines={2}>
              {description}
            </Text>
          )}
        </View>

        {/* Thumbnail - positioned to the right */}
        {imageUrl && (
          <View className="h-24 w-24 overflow-hidden rounded-xl bg-mid-grey">
            <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
          </View>
        )}
      </Pressable>
    );
  }
);

ArticleListItem.displayName = 'ArticleListItem';
