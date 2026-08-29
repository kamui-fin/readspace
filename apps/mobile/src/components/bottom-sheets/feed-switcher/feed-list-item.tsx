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
import { FeedFallbackIcon } from '@components/ui/feed-fallback-icon';
import { FeedIcon } from '@components/ui/feed-icon';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import { resolveSupabaseImageUrl } from '@lib/utils/network';
import type { Subscription } from '@readspace/shared';
import { memo } from 'react';
import { TouchableOpacity, View, type ViewStyle } from 'react-native';

function getFaviconUrl(feed: { link?: string | null; image_url?: string | null }): string | null {
  if (feed.image_url) return resolveSupabaseImageUrl(feed.image_url) ?? null;
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
  onPressIn?: () => void;
  onToggleFavorite: (sub: Subscription) => void;
  onRename: (sub: Subscription) => void;
  onUnfollow: (sub: Subscription) => void;
  onMoveToFolder?: (sub: Subscription) => void;
  showFolder?: boolean;
  variant?: 'pinned' | 'folder';
  isSelectionMode?: boolean;
  isSelected?: boolean;
  style?: ViewStyle;
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
  onMoveToFolder,
  showFolder = false,
  variant,
  isSelectionMode = false,
  isSelected = false,
  style,
}: FeedListItemProps) => {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const feed = sub.feed;
  const faviconUrl = getFaviconUrl(feed);
  const title = sub.custom_title || feed.title;

  const activeRowBg =
    isActive && !isSelectionMode
      ? isDark
        ? 'rgba(255,255,255,0.04)'
        : 'rgba(0,0,0,0.03)'
      : 'transparent';

  const Fallback = ({ size = 40, className }: { size?: number; className?: string }) => (
    <FeedFallbackIcon feedName={feed.title} size={size} borderRadius={8} className={className} />
  );

  const content = (
    <>
      <View className="shrink-0">
        {isSelectionMode ? (
          <View className="h-10 w-10 items-center justify-center">
            {isSelected ? (
              <CheckCircleBoldIcon width={28} height={28} color={colors.secondary} />
            ) : (
              <View
                className="h-6 w-6 rounded-full border-[1.5px]"
                style={{ borderColor: isDark ? colors.grey4 : colors.grey3 }}
              />
            )}
          </View>
        ) : isActive ? (
          <View className="h-10 w-10 items-center justify-center">
            <CheckCircleBoldIcon width={32} height={32} color={colors.secondary} />
          </View>
        ) : (
          <FeedIcon url={faviconUrl} fallbackComponent={Fallback} size={40} borderRadius={8} />
        )}
      </View>

      <View className="min-w-0 flex-1 justify-center">
        <Text
          className="font-geist-medium truncate text-base text-black"
          numberOfLines={1}
          ellipsizeMode="tail">
          {title}
        </Text>
        {!isSelectionMode && (unreadCount > 0 || showFolder) && (
          <View className="mt-0.5 flex-row items-center gap-2">
            {unreadCount > 0 && (
              <Text className="font-geist-medium text-grey2 text-sm">{unreadCount} unread</Text>
            )}
            {showFolder && (
              <>
                {unreadCount > 0 && <Text className="font-geist-medium text-grey3 text-xs">•</Text>}
                <Text className="font-geist-medium text-grey2 truncate text-sm" numberOfLines={1}>
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
              <MenuDotsBoldIcon
                width={20}
                height={20}
                color={colors.grey2}
                style={{ transform: [{ rotate: '90deg' }] }}
              />
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
              <DropdownMenuItemIcon ios={{ name: 'pencil' }} />
              <DropdownMenuItemTitle>Rename</DropdownMenuItemTitle>
            </DropdownMenuItem>
            {onMoveToFolder && (
              <DropdownMenuItem key="move" onSelect={() => onMoveToFolder(sub)}>
                <DropdownMenuItemIcon ios={{ name: 'folder' }} />
                <DropdownMenuItemTitle>Move to folder</DropdownMenuItemTitle>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem key="unfollow" destructive onSelect={() => onUnfollow(sub)}>
              <DropdownMenuItemIcon ios={{ name: 'person.badge.minus' }} />
              <DropdownMenuItemTitle>Unfollow</DropdownMenuItemTitle>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuRoot>
      )}
    </>
  );

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingRight: 16,
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: activeRowBg,
          borderRadius: 0,
        },
        style,
      ]}>
      {content}
    </TouchableOpacity>
  );
};

export const FeedListItem = memo(FeedListItemComponent);
