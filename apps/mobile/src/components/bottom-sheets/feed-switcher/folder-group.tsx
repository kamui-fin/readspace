import AltArrowRightLinearIcon from '@components/icons/solar/alt-arrow-right-linear';
import AltArrowRightOutlineIcon from '@components/icons/solar/alt-arrow-right-outline';
import CheckCircleBoldIcon from '@components/icons/solar/check-circle-bold';
import FolderOpenBoldIcon from '@components/icons/solar/folder-open-bold';
import FolderOpenLinearIcon from '@components/icons/solar/folder-open-linear';
import FolderWithFilesBoldIcon from '@components/icons/solar/folder-with-files-bold';
import FolderWithFilesLinearIcon from '@components/icons/solar/folder-with-files-linear';
import MenuDotsBoldIcon from '@components/icons/solar/menu-dots-bold';
import { Button } from '@components/ui/button';
import { Chip } from '@components/ui/chip';
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
import type { Folder, Subscription } from '@readspace/shared';
import * as Haptics from 'expo-haptics';
import { AnimatePresence, MotiView } from 'moti';
import { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { FeedListItem } from './feed-list-item';

// ---------------------------------------------------------------------------
// Favicon URL helper (mirrors the one in feed-list-item)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// FaviconStack – overlapping favicon avatars shown when a folder is collapsed
// ---------------------------------------------------------------------------
const FAVICON_SIZE = 20;
const FAVICON_OVERLAP = 6;
const MAX_AVATARS = 3;

function FaviconStack({ feeds }: { feeds: Subscription[] }) {
  const visible = feeds.slice(0, MAX_AVATARS);
  const totalWidth =
    visible.length * FAVICON_SIZE - (visible.length - 1) * FAVICON_OVERLAP;

  return (
    <View style={{ width: totalWidth, height: FAVICON_SIZE, position: 'relative' }}>
      {visible.map((sub, i) => {
        const url = getFaviconUrl(sub.feed);
        const Fallback = ({ size = FAVICON_SIZE }: { size?: number }) => (
          <FeedFallbackIcon feedName={sub.feed.title} size={size} borderRadius={4} />
        );
        return (
          <View
            key={sub.id}
            style={{
              position: 'absolute',
              left: i * (FAVICON_SIZE - FAVICON_OVERLAP),
              top: 0,
              zIndex: MAX_AVATARS - i,
            }}>
            <FeedIcon
              url={url}
              fallbackComponent={Fallback}
              size={FAVICON_SIZE}
              borderRadius={4}
            />
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface FolderGroupProps {
  folder: Folder;
  folderFeeds: Subscription[];
  unreadCount: number;
  isExpanded: boolean;
  isEmpty: boolean;
  isFolderViewing: boolean;
  selectedFeedId: string | null;
  unreadCounts: Record<string, number>;
  isSelectionMode: boolean;
  selectedFeedIds: Set<string>;
  selectedFolderIds: Set<string>;
  onFolderPress: (folderId: string) => void;
  onFeedPress: (feedId: string) => void;
  onPressIn?: () => void;
  onToggleExpand: (folderId: string) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onToggleFavorite: (sub: Subscription) => void;
  onRenameFeed: (sub: Subscription) => void;
  onUnfollow: (sub: Subscription) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const CONTENT_LEFT = 24; // Aligns with the "My Feeds" header title

const FolderGroupComponent = ({
  folder,
  folderFeeds,
  unreadCount,
  isExpanded,
  isEmpty,
  isFolderViewing,
  unreadCounts,
  onFolderPress,
  onFeedPress,
  onPressIn,
  onToggleExpand,
  onRenameFolder,
  onDeleteFolder,
  onToggleFavorite,
  onRenameFeed,
  onUnfollow,
  selectedFeedId,
  isSelectionMode,
  selectedFeedIds,
  selectedFolderIds,
}: FolderGroupProps) => {
  const isDark = useIsDarkMode();
  const colors = COLORS[isDark ? 'dark' : 'light'];

  const FolderIcon = isExpanded
    ? isEmpty
      ? FolderOpenLinearIcon
      : FolderOpenBoldIcon
    : isEmpty
      ? FolderWithFilesLinearIcon
      : FolderWithFilesBoldIcon;

  const allSelected = !isEmpty && folderFeeds.every((f) => selectedFeedIds.has(f.feed.id));
  const someSelected =
    !isEmpty && !allSelected && folderFeeds.some((f) => selectedFeedIds.has(f.feed.id));

  const isSelected = selectedFolderIds.has(folder.id);
  const feedCountLabel = `${folderFeeds.length} ${folderFeeds.length === 1 ? 'feed' : 'feeds'}`;

  // Show favicon stack only when collapsed and has feeds
  const showFaviconStack = !isExpanded && !isEmpty && !isSelectionMode;

  // Active folder row gets a subtle tinted background (only when not in selection mode)
  const activeRowBg =
    isFolderViewing && !isSelectionMode
      ? isDark
        ? 'rgba(255,255,255,0.04)'
        : 'rgba(0,0,0,0.03)'
      : 'transparent';

  return (
    <View>
      {/* ------------------------------------------------------------------ */}
      {/* Folder header row — full-width, no card wrapper                     */}
      {/* ------------------------------------------------------------------ */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onFolderPress(folder.id)}
        style={{
          minHeight: 52,
          paddingLeft: CONTENT_LEFT,
          paddingRight: 16,
          paddingTop: 12,
          paddingBottom: 12,
          backgroundColor: activeRowBg,
        }}>
        <View className="flex-1 flex-row items-center gap-3">
          {/* Left: selection toggle or folder icon */}
          <View className="shrink-0">
            {isSelectionMode ? (
              <View className="h-7 w-7 items-center justify-center">
                {isSelected ? (
                  <CheckCircleBoldIcon width={28} height={28} color={colors.secondary} />
                ) : (
                  <View
                    className="h-6 w-6 rounded-full border-[1.5px]"
                    style={{ borderColor: isDark ? colors.grey4 : colors.grey3 }}
                  />
                )}
              </View>
            ) : isFolderViewing ? (
              <CheckCircleBoldIcon width={28} height={28} color={colors.secondary} />
            ) : (
              <FolderIcon width={28} height={28} color={colors.secondary} />
            )}
          </View>

          {/* Middle: folder name + feed count subtitle w/ navigation cue */}
          <View className="min-w-0 flex-1 justify-center">
            <Text
              className="font-geist-semibold text-grey mr-2 text-lg"
              numberOfLines={1}
              style={{ flexShrink: 1 }}>
              {folder.name}
            </Text>
            {!isSelectionMode && (
              <View className="flex-row items-center gap-0.5" style={{ marginTop: 1 }}>
                <Text className="font-geist text-grey3 text-xs">{feedCountLabel}</Text>
                <AltArrowRightLinearIcon
                  width={11}
                  height={11}
                  color={colors.grey3}
                  style={{ marginLeft: 1 }}
                />
              </View>
            )}
          </View>

          {/* Right: favicon stack + unread count + menu + expand toggle */}
          <View className="flex-row items-center gap-1.5">
            {/* Collapsed favicon preview */}
            {showFaviconStack && folderFeeds.length > 0 && (
              <FaviconStack feeds={folderFeeds} />
            )}

            {/* Unread badge */}
            {!isSelectionMode && unreadCount > 0 && (
              <Chip
                label={unreadCount.toString()}
                size="small"
                selected={false}
                className="bg-grey4"
              />
            )}

            {/* Context menu */}
            {!isSelectionMode && (
              <DropdownMenuRoot>
                <DropdownMenuTrigger>
                  <Button
                    variant="icon"
                    size="small"
                    fullWidth={false}
                    className="flex h-9 w-9 items-center justify-center bg-transparent dark:bg-transparent">
                    <MenuDotsBoldIcon width={18} height={18} color={colors.grey2} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem key="rename" onSelect={() => onRenameFolder(folder)}>
                    <DropdownMenuItemIcon ios={{ name: 'pencil' }} androidIconName="edit" />
                    <DropdownMenuItemTitle>Rename</DropdownMenuItemTitle>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    key="delete"
                    destructive
                    onSelect={() => onDeleteFolder(folder)}>
                    <DropdownMenuItemIcon ios={{ name: 'trash' }} androidIconName="delete" />
                    <DropdownMenuItemTitle>Delete</DropdownMenuItemTitle>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuRoot>
            )}

            {/* Expand / collapse toggle — bold outline chevron */}
            {!isSelectionMode && (
              <MotiView
                animate={{ rotate: isExpanded ? '180deg' : '0deg' }}
                transition={{ type: 'timing', duration: 200 }}>
                <Button
                  variant="icon"
                  size="small"
                  fullWidth={false}
                  onPressIn={onPressIn}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    Haptics.selectionAsync();
                    onToggleExpand(folder.id);
                  }}
                  className="flex h-9 w-9 items-center justify-center bg-transparent dark:bg-transparent">
                  <AltArrowRightOutlineIcon
                    width={18}
                    height={18}
                    color={colors.grey2}
                    style={{ transform: [{ rotate: '90deg' }] }}
                  />
                </Button>
              </MotiView>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded feed list — full-width, no border decorations */}
      <AnimatePresence>
        {isExpanded && !isEmpty && (
          <MotiView
            from={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'timing', duration: 200 }}
            style={{ overflow: 'hidden' }}>
            <View style={{ paddingBottom: 4 }}>
              {folderFeeds.map((sub) => (
                <FeedListItem
                  key={sub.id}
                  sub={sub}
                  isActive={selectedFeedId === sub.feed.id}
                  unreadCount={unreadCounts[sub.feed.id] || 0}
                  onPress={() => onFeedPress(sub.feed.id)}
                  onPressIn={onPressIn}
                  onToggleFavorite={onToggleFavorite}
                  onRename={onRenameFeed}
                  onUnfollow={onUnfollow}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedFeedIds.has(sub.feed.id)}
                  variant="folder"
                  style={{ paddingLeft: CONTENT_LEFT + 12 }}
                />
              ))}
            </View>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
};

export const FolderGroup = memo(FolderGroupComponent);
