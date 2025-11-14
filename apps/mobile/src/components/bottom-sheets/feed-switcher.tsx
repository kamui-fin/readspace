import { forwardRef, useImperativeHandle, useRef, useCallback, useMemo } from 'react';
import { View, Text, useColorScheme } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Monicon } from '@monicon/native';

import { BottomSheet } from '@components/ui/bottom-sheet';
import { Chip } from '@components/ui/chip';
import { Button } from '@components/ui/button';
import { COLORS } from '@lib/constants/colors';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemTitle,
  DropdownMenuItemIcon,
} from '@components/ui/dropdown-menu';
import { useFeeds, useFolders, type Feed, type Folder } from '@readspace/shared';
import { useFeedViewStore } from '@stores/feed-view';
import { useFeedSwitcherStore } from '@stores/feed-switcher';
import { ExpandVerticalIcon } from '@components/icons/expand-vertical';
import {
  CreateFolderModal,
  type CreateFolderModalRef,
} from '@/components/bottom-sheets/create-folder';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

export interface FeedSwitcherBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface ListItem {
  type: 'folder-group';
  id: string;
  folder: Folder;
  folderFeeds: Feed[];
  unreadCount: number;
  isExpanded: boolean;
  isEmpty: boolean;
}

export const FeedSwitcherBottomSheet = forwardRef<FeedSwitcherBottomSheetRef, object>(
  (_props, ref) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const createFolderModalRef = useRef<CreateFolderModalRef>(null);
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const colors = COLORS[isDark ? 'dark' : 'light'];

    const { data: feedsData } = useFeeds();
    const { data: foldersData } = useFolders();

    const feeds = useMemo(() => (feedsData as Feed[]) || [], [feedsData]);
    const folders = useMemo(() => (foldersData as Folder[]) || [], [foldersData]);

    const expandedFolders = useFeedSwitcherStore((state: any) => state.expandedFolders);
    const toggleFolderInStore = useFeedSwitcherStore((state: any) => state.toggleFolder);

    const selectFeed = useFeedViewStore((state) => state.selectFeed);
    const selectFolder = useFeedViewStore((state) => state.selectFolder);
    const viewType = useFeedViewStore((state) => state.viewType);
    const selectedId = useFeedViewStore((state) => state.selectedId);

    useImperativeHandle(ref, () => ({
      present: () => bottomSheetRef.current?.present(),
      dismiss: () => bottomSheetRef.current?.dismiss(),
    }));

    // Create folder groups
    const listData = useMemo<ListItem[]>(() => {
      const items: ListItem[] = [];

      folders.forEach((folder) => {
        const folderFeeds = feeds.filter((feed) => feed.folder_id === folder.id);
        const unreadCount = folderFeeds.reduce((sum, feed) => sum + (feed.unread_count || 0), 0);
        const isExpanded = expandedFolders.has(folder.id);
        const isEmpty = folderFeeds.length === 0;

        items.push({
          type: 'folder-group',
          id: folder.id,
          folder,
          folderFeeds,
          unreadCount,
          isExpanded,
          isEmpty,
        });
      });

      return items;
    }, [folders, feeds, expandedFolders]);

    const toggleFolderExpand = useCallback(
      (folderId: string) => {
        toggleFolderInStore(folderId);
      },
      [toggleFolderInStore]
    );

    const handleFeedPress = useCallback(
      (feedId: string) => {
        const feed = feeds.find((f) => f.id === feedId);
        if (feed) {
          selectFeed(feedId, feed.title);
          bottomSheetRef.current?.dismiss();
        }
      },
      [feeds, selectFeed]
    );

    const handleFolderPress = useCallback(
      (folderId: string) => {
        const folder = folders.find((f) => f.id === folderId);
        if (folder) {
          selectFolder(folderId, folder.name);
          bottomSheetRef.current?.dismiss();
        }
      },
      [folders, selectFolder]
    );

    const renderItem = useCallback(
      (item: ListItem, index: number): React.ReactElement => {
        const isLast = index === listData.length - 1;
        const isFolderViewing = viewType === 'folder' && selectedId === item.folder.id;

        const getFolderIcon = () => {
          if (item.isExpanded) {
            return item.isEmpty ? 'solar:folder-open-linear' : 'solar:folder-open-bold';
          } else {
            return item.isEmpty ? 'solar:folder-with-files-linear' : 'solar:folder-with-files-bold';
          }
        };

        return (
          <View className={!isLast ? 'mb-4' : 'mb-2'}>
            {/* Folder Group Container */}
            <View
              className={`${item.isExpanded && !item.isEmpty ? 'rounded-2xl' : 'rounded-2xl'} bg-grey5 dark:bg-grey5-dark`}>
              {/* Folder Button */}
              <Button
                variant="secondary"
                size="large"
                fullWidth
                onPress={() => handleFolderPress(item.folder.id)}
                className="px-4 rounded-none overflow-visible"
                style={{
                  minHeight: 64,
                  paddingTop: 12,
                  paddingBottom: item.isExpanded && !item.isEmpty ? 8 : 12,
                }}>
                <View className="flex-row gap-3 items-center flex-1">
                  {/* Folder Icon */}
                  <View className="flex-shrink-0">
                    {isFolderViewing ? (
                      <Monicon name="solar:check-circle-bold" size={28} color={colors.secondary} />
                    ) : (
                      <Monicon name={getFolderIcon()} size={28} color={colors.secondary} />
                    )}
                  </View>

                  {/* Folder Content */}
                  <View className="flex-1 flex-row items-center justify-between min-w-0">
                    <Text
                      className="font-geist-semibold text-lg text-grey dark:text-grey mr-3"
                      numberOfLines={1}
                      style={{ flexShrink: 1 }}>
                      {item.folder.name}
                    </Text>

                    <View className="flex-row items-center flex-shrink-0">
                      {item.unreadCount > 0 && (
                        <Chip label={item.unreadCount.toString()} size="medium" selected={false} />
                      )}
                      <Button
                        variant="icon"
                        size="small"
                        fullWidth={false}
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          toggleFolderExpand(item.folder.id);
                        }}
                        className="h-8 w-8">
                        <ExpandVerticalIcon size={20} color={colors.grey2} />
                      </Button>
                    </View>
                  </View>
                </View>
              </Button>

              {/* Expanded Feeds */}
              {item.isExpanded && !item.isEmpty && (
                <View className="pl-4 pb-8">
                  {item.folderFeeds.map((feed) => {
                    const isFeedViewing = viewType === 'feed' && selectedId === feed.id;
                    const faviconUrl =
                      feed.image_url ||
                      (feed.link
                        ? `https://www.google.com/s2/favicons?domain=${new URL(feed.link).hostname}&sz=32`
                        : null);

                    return (
                      <Button
                        key={feed.id}
                        variant="secondary"
                        size="large"
                        fullWidth
                        onPress={() => handleFeedPress(feed.id)}
                        className="flex-row items-center gap-3 px-6 rounded-none"
                        style={{ paddingTop: 12, paddingBottom: 12 }}>
                        {/* Feed Icon/Favicon */}
                        <View className="flex-shrink-0">
                          {isFeedViewing ? (
                            <View className="h-10 w-10 items-center justify-center">
                              <Monicon
                                name="solar:check-circle-bold"
                                size={32}
                                color={colors.secondary}
                              />
                            </View>
                          ) : faviconUrl ? (
                            <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-md">
                              <ExpoImage
                                source={{ uri: faviconUrl }}
                                style={{ width: 40, height: 40 }}
                                contentFit="cover"
                                cachePolicy={'memory-disk'}
                              />
                            </View>
                          ) : (
                            <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-grey4 dark:bg-grey4-dark">
                              <Text className="font-geist-medium text-md text-base text-grey dark:text-grey">
                                {feed.title.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Feed Content */}
                        <View className="flex-1 flex-col items-start min-w-0">
                          <Text
                            className="font-geist-medium text-base text-black dark:text-black-dark"
                            numberOfLines={1}>
                            {feed.title}
                          </Text>
                          {feed.unread_count > 0 && (
                            <Text className="font-geist text-sm text-grey2 dark:text-grey2-dark">
                              {feed.unread_count} unread
                            </Text>
                          )}
                        </View>
                      </Button>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        );
      },
      [
        viewType,
        selectedId,
        colors,
        handleFolderPress,
        handleFeedPress,
        toggleFolderExpand,
        listData,
      ]
    );

    const handleCreateFolderPress = useCallback(() => {
      createFolderModalRef.current?.present();
    }, []);

    // Header right actions
    const headerRightActions = useMemo(
      () => (
        <View className="flex-row items-center gap-2">
          <Button
            variant="icon"
            size="small"
            className="h-8 w-8"
            fullWidth={false}
            onPress={handleCreateFolderPress}>
            <Monicon name="solar:add-folder-bold" size={16} color={colors.grey} />
          </Button>
          <DropdownMenuRoot>
            <DropdownMenuTrigger>
              <Button variant="icon" size="small" className="h-8 w-8" fullWidth={false}>
                <Monicon name="solar:menu-dots-bold" size={16} color={colors.grey} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                key="edit"
                onSelect={() => {
                  console.log('Edit folders');
                }}>
                <DropdownMenuItemIcon ios={{ name: 'pencil' }} androidIconName="edit" />
                <DropdownMenuItemTitle>Edit folders</DropdownMenuItemTitle>
              </DropdownMenuItem>
              <DropdownMenuItem
                key="select"
                onSelect={() => {
                  console.log('Select');
                }}>
                <DropdownMenuItemIcon
                  ios={{ name: 'checkmark.circle' }}
                  androidIconName="check_circle"
                />
                <DropdownMenuItemTitle>Select</DropdownMenuItemTitle>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuRoot>
        </View>
      ),
      [colors.grey, handleCreateFolderPress]
    );

    return (
      <>
        <BottomSheet
          ref={bottomSheetRef}
          headerTitle="My Feeds"
          headerTitleAlign="left"
          enableContentPanningGesture={true}
          enableOverDrag={true}
          headerRight={headerRightActions}
          snapPoints={['50%', '90%']}
          index={1}>
          {listData.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Monicon name="solar:inbox-broken" size={64} color={colors.grey} />
              <Text className="mt-4 font-geist-medium text-base text-grey dark:text-grey">
                No feeds yet
              </Text>
              <Text className="mt-1 font-geist text-sm text-grey dark:text-grey">
                Subscribe to feeds to see them here
              </Text>
            </View>
          ) : (
            listData.map((item, index) => (
              <View key={item.id} style={{ marginBottom: 12 }}>
                {renderItem(item, index)}
              </View>
            ))
          )}
        </BottomSheet>

        {/* Create Folder Modal */}
        <CreateFolderModal ref={createFolderModalRef} />
      </>
    );
  }
);

FeedSwitcherBottomSheet.displayName = 'FeedSwitcherBottomSheet';
