import CheckCircleBoldIcon from '@components/icons/solar/check-circle-bold';
import MenuDotsBoldIcon from '@components/icons/solar/menu-dots-bold';
import { Button } from '@components/ui/button';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIcon,
  DropdownMenuItemTitle,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import { COLORS } from '@lib/constants/colors';
import type { Subscription } from '@readspace/shared';
import { Image as ExpoImage } from 'expo-image';
import { memo } from 'react';
import { Text, useColorScheme, View } from 'react-native';

function getFaviconUrl(feed: { link?: string | null; image_url?: string | null }): string | null {
  if (feed.image_url) return feed.image_url;
  if (feed.link) {
    try {
      return `https://www.google.com/s2/favicons?domain=${new URL(feed.link).hostname}&sz=32`;
    } catch {
      return null;
    }
  }
  return null;
}

export interface FeedListItemProps {
  sub: Subscription;
  isActive: boolean;
  unreadCount: number;
  onPress: () => void;
  onPressIn: () => void;
  onToggleFavorite: (sub: Subscription) => void;
  onRename: (sub: Subscription) => void;
  onUnfollow: (sub: Subscription) => void;
  /** Show folder name (for pinned items) */
  showFolder?: boolean;
  /** Layout variant: 'pinned' has more padding and spacing */
  variant?: 'pinned' | 'folder';
  isSelectionMode?: boolean;
  isSelected?: boolean;
}

const FeedListItemComponent = ({
  sub,
  isActive,
  unreadCount,
  onPress,
  onPressIn,
  onToggleFavorite,
  onRename,
  onUnfollow,
  showFolder = false,
  variant = 'folder',
  isSelectionMode = false,
  isSelected = false,
}: FeedListItemProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const feed = sub.feed;
  const faviconUrl = getFaviconUrl(feed);
  const title = sub.custom_title || feed.title;

  const content = (
    <>
      <View className="shrink-0">
        {isSelectionMode ? (
          <View className="h-10 w-10 items-center justify-center">
            {isSelected ? (
              <CheckCircleBoldIcon width={28} height={28} color={colors.primary} />
            ) : (
              <View className="w-6 h-6 rounded-full border-[1.5px] border-grey3 dark:border-grey3-dark" />
            )}
          </View>
        ) : isActive ? (
          <View className="h-10 w-10 items-center justify-center">
            <CheckCircleBoldIcon width={32} height={32} color={colors.secondary} />
          </View>
        ) : faviconUrl ? (
          <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-md">
            <ExpoImage
              source={{ uri: faviconUrl }}
              style={{ width: 40, height: 40 }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </View>
        ) : (
          <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-grey4 dark:bg-grey4-dark">
            <Text className="font-geist-medium text-base text-grey dark:text-grey-dark">
              {feed.title.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-1 min-w-0 justify-center">
        <Text
          className="font-geist-medium text-base text-black dark:text-black-dark truncate"
          numberOfLines={1}
          ellipsizeMode="tail">
          {title}
        </Text>
        {!isSelectionMode && (unreadCount > 0 || showFolder) && (
          <View className="flex-row items-center gap-2 mt-0.5">
            {unreadCount > 0 && (
              <Text className="font-geist-medium text-sm text-grey2 dark:text-grey2-dark">
                {unreadCount} unread
              </Text>
            )}
            {showFolder && (
              <>
                {unreadCount > 0 && (
                  <Text className="font-geist-medium text-xs text-grey3 dark:text-grey3-dark">
                    •
                  </Text>
                )}
                <Text
                  className="font-geist-medium text-sm text-grey2 dark:text-grey2-dark truncate"
                  numberOfLines={1}>
                  {sub.folder?.name || 'No folder'}
                </Text>
              </>
            )}
          </View>
        )}
      </View>

      {!isSelectionMode && (
        <DropdownMenuRoot>
          <DropdownMenuTrigger>
            <Button
              variant="icon"
              size="small"
              fullWidth={false}
              className="h-10 w-10 items-center justify-center bg-transparent dark:bg-transparent">
              <MenuDotsBoldIcon width={20} height={20} color={colors.grey2} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem key="favorite" onSelect={() => onToggleFavorite(sub)}>
              <DropdownMenuItemIcon ios={{ name: sub.is_favorite ? 'star.fill' : 'star' }} />
              <DropdownMenuItemTitle>
                {sub.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              </DropdownMenuItemTitle>
            </DropdownMenuItem>
            <DropdownMenuItem key="rename" onSelect={() => onRename(sub)}>
              <DropdownMenuItemIcon ios={{ name: 'pencil' }} androidIconName="edit" />
              <DropdownMenuItemTitle>Rename</DropdownMenuItemTitle>
            </DropdownMenuItem>
            <DropdownMenuItem key="unfollow" destructive onSelect={() => onUnfollow(sub)}>
              <DropdownMenuItemIcon ios={{ name: 'person.badge.minus' }} androidIconName="delete" />
              <DropdownMenuItemTitle>Unfollow</DropdownMenuItemTitle>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuRoot>
      )}
    </>
  );

  return (
    <Button
      variant="secondary"
      size="large"
      fullWidth
      onPressIn={onPressIn}
      onPress={onPress}
      className={`h-auto flex-row items-center gap-3 overflow-visible px-4 ${
        isSelectionMode ? 'min-h-12 py-2' : 'min-h-14 py-3'
      } ${variant === 'pinned' && !isSelectionMode ? 'rounded-xl' : 'rounded-none'}`}>
      {content}
    </Button>
  );
};

export const FeedListItem = memo(FeedListItemComponent);
