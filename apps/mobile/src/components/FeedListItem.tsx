import { cn } from '@/utils/cn';
import { forwardRef } from 'react';
import { Image, Pressable, Text, View, type PressableProps } from 'react-native';

export interface FeedListItemProps extends PressableProps {
  title: string;
  description: string;
  iconUrl?: string;
  isFollowing?: boolean;
  onFollowPress?: () => void;
  className?: string;
}

export const FeedListItem = forwardRef<React.ElementRef<typeof Pressable>, FeedListItemProps>(
  (
    { title, description, iconUrl, isFollowing = false, onFollowPress, className, ...props },
    ref
  ) => {
    return (
      <Pressable
        ref={ref}
        className={cn('flex-row items-center gap-4 bg-white py-4', className)}
        {...props}>
        {/* Icon */}
        <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-mid-grey">
          {iconUrl ? (
            <Image source={{ uri: iconUrl }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="font-geist-bold text-lg text-grey">
              {title.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        {/* Content */}
        <View className="flex-1">
          <Text className="mb-1 font-geist-semibold text-base text-black" numberOfLines={1}>
            {title}
          </Text>
          <Text className="font-geist text-sm text-grey" numberOfLines={2}>
            {description}
          </Text>
        </View>

        {/* Follow Button */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onFollowPress?.();
          }}
          className={cn(
            'rounded-full border px-4 py-2',
            isFollowing ? 'border-mid-grey' : 'border-primary bg-primary'
          )}>
          <Text
            className={cn('font-geist-semibold text-sm', isFollowing ? 'text-grey' : 'text-white')}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      </Pressable>
    );
  }
);

FeedListItem.displayName = 'FeedListItem';
