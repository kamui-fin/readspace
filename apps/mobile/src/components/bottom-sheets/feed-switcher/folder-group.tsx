import ExpandVerticalIcon from '@components/icons/local/expand-vertical';
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
import { COLORS } from '@lib/constants/colors';
import type { Folder, Subscription } from '@readspace/shared';
import { AnimatePresence, MotiView } from 'moti';
import { memo } from 'react';
import { View } from 'react-native';
import { Text } from '@components/ui/text';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { FeedListItem } from './feed-list-item';

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
  onPressIn: () => void;
  onToggleExpand: (folderId: string) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onToggleFavorite: (sub: Subscription) => void;
  onRenameFeed: (sub: Subscription) => void;
  onUnfollow: (sub: Subscription) => void;
}

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

  return (
    <View>
      <View className="rounded-xl" style={{ backgroundColor: colors.grey6 }}>
        <Button
          variant="secondary"
          size="large"
          fullWidth
          onPressIn={onPressIn}
          onPress={() => onFolderPress(folder.id)}
          className="overflow-visible rounded-md px-4"
          style={{
            minHeight: 64,
            paddingTop: 12,
            paddingBottom: isExpanded && !isEmpty ? 8 : 12,
          }}>
          <View className="flex-1 flex-row items-center gap-2">
            <View className="shrink-0 pl-1">
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

            <View className="min-w-0 flex-1 flex-row items-center justify-between">
              <Text
                className="font-geist-semibold text-grey mr-3 text-lg"
                numberOfLines={1}
                style={{ flexShrink: 1 }}>
                {folder.name}
              </Text>

              <View className="shrink-0 flex-row items-center gap-2">
                {!isSelectionMode && unreadCount > 0 && (
                  <Chip
                    label={unreadCount.toString()}
                    size="small"
                    selected={false}
                    className="bg-grey4"
                  />
                )}
                {/* Dropdown Menu trigger instead of Context Menu */}
                {!isSelectionMode && (
                  <DropdownMenuRoot>
                    <DropdownMenuTrigger>
                      <Button
                        variant="icon"
                        size="small"
                        fullWidth={false}
                        className="flex h-10 w-10 items-center justify-center bg-transparent dark:bg-transparent">
                        <MenuDotsBoldIcon width={20} height={20} color={colors.grey2} />
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
                        onToggleExpand(folder.id);
                      }}
                      className="flex h-10 w-10 items-center justify-center bg-transparent dark:bg-transparent">
                      <ExpandVerticalIcon
                        width={20}
                        height={20}
                        color={colors.grey2}
                        fill={colors.grey2}
                      />
                    </Button>
                  </MotiView>
                )}
              </View>
            </View>
          </View>
        </Button>

        <AnimatePresence>
          {isExpanded && !isEmpty && (
            <MotiView
              from={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'timing', duration: 200 }}
              style={{ overflow: 'hidden' }}>
              <View className="pb-3 pl-4">
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
                  />
                ))}
              </View>
            </MotiView>
          )}
        </AnimatePresence>
      </View>
    </View>
  );
};

export const FolderGroup = memo(FolderGroupComponent);
