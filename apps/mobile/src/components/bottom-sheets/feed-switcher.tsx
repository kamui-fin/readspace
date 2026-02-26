import {
  CreateFolderModal,
  type CreateFolderModalRef,
} from '@components/bottom-sheets/create-folder';
import ExpandVerticalIcon from '@components/icons/local/expand-vertical';
import { BottomSheet } from '@components/ui/bottom-sheet';
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
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { COLORS } from '@lib/constants/colors';
import AddFolderBoldIcon from '@components/icons/solar/add-folder-bold';
import CheckCircleBoldIcon from '@components/icons/solar/check-circle-bold';
import FolderOpenBoldIcon from '@components/icons/solar/folder-open-bold';
import FolderOpenLinearIcon from '@components/icons/solar/folder-open-linear';
import FolderWithFilesBoldIcon from '@components/icons/solar/folder-with-files-bold';
import FolderWithFilesLinearIcon from '@components/icons/solar/folder-with-files-linear';
import InboxBrokenIcon from '@components/icons/solar/inbox-broken';
import MenuDotsBoldIcon from '@components/icons/solar/menu-dots-bold';
import { type Subscription, type Folder, useFeeds, useUnreadCounts } from '@readspace/shared';
import { type FeedSwitcherStore, useFeedSwitcherStore } from '@stores/feed-switcher';
import { useFeedViewStore } from '@stores/feed-view';
import { Image as ExpoImage } from 'expo-image';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Text, useColorScheme, View } from 'react-native';

export interface FeedSwitcherBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface ListItem {
  type: 'folder-group';
  id: string;
  folder: Folder;
  folderFeeds: Subscription[];
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

    const { data: unreadCountsData } = useUnreadCounts();
    const unreadCounts = unreadCountsData?.feed_counts || {};

    const feeds = useMemo(() => (feedsData?.subscriptions as Subscription[]) || [], [feedsData]);
    const folders = useMemo(() => (feedsData?.folders as Folder[]) || [], [feedsData]);

    const expandedFolders = useFeedSwitcherStore(
      (state: FeedSwitcherStore) => state.expandedFolders
    );
    const toggleFolderInStore = useFeedSwitcherStore(
      (state: FeedSwitcherStore) => state.toggleFolder
    );

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
        const folderFeeds = feeds.filter((sub) => sub.folder?.id === folder.id);
        const unreadCount = folderFeeds.reduce((sum, sub) => sum + (unreadCounts[sub.feed.id] || 0), 0);
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
        const sub = feeds.find((f) => f.feed.id === feedId);
        if (sub) {
          selectFeed(feedId, sub.feed.title);
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

        const FolderIconComponent = (() => {
          if (item.isExpanded) {
            return item.isEmpty ? FolderOpenLinearIcon : FolderOpenBoldIcon;
          } else {
            return item.isEmpty ? FolderWithFilesLinearIcon : FolderWithFilesBoldIcon;
          }
        })();

        return (
          <View className={!isLast ? 'mb-4' : 'mb-2'}>
            {/* Folder Group Container */}
            <View
              className={`${item.isExpanded && !item.isEmpty ? 'rounded-2xl' : 'rounded-2xl'} bg-grey6 dark:bg-grey6-dark`}>
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
                      <CheckCircleBoldIcon width={28} height={28} color={colors.secondary} />
                    ) : (
                      <FolderIconComponent width={28} height={28} color={colors.secondary} />
                    )}
                  </View>

                  {/* Folder Content */}
                  <View className="flex-1 flex-row items-center justify-between min-w-0">
                    <Text
                      className="font-geist-semibold text-lg text-grey dark:text-grey-dark mr-3"
                      numberOfLines={1}
                      style={{ flexShrink: 1 }}>
                      {item.folder.name}
                    </Text>

                    <View className="flex-row items-center flex-shrink-0">
                      {item.unreadCount > 0 && (
                        <Chip
                          label={item.unreadCount.toString()}
                          size="small"
                          selected={false}
                          className="bg-grey4 dark:bg-grey4-dark"
                        />
                      )}
                      <Button
                        variant="icon"
                        size="small"
                        fullWidth={false}
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          toggleFolderExpand(item.folder.id);
                        }}
                        className="h-8 w-8 bg-transparent dark:bg-transparent">
                        <ExpandVerticalIcon width={20} height={20} fill={colors.grey2} />
                      </Button>
                    </View>
                  </View>
                </View>
              </Button>

              {/* Expanded Feeds */}
              {item.isExpanded && !item.isEmpty && (
                <View className="pl-4 pb-8">
                  {item.folderFeeds.map((sub) => {
                    const feed = sub.feed;
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
                              <CheckCircleBoldIcon
                                width={32}
                                height={32}
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
                          {unreadCounts[feed.id] > 0 && (
                            <Text className="font-geist text-sm text-grey2 dark:text-grey2-dark">
                              {unreadCounts[feed.id]} unread
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
            <AddFolderBoldIcon width={16} height={16} color={colors.grey} />
          </Button>
          <DropdownMenuRoot>
            <DropdownMenuTrigger>
              <Button variant="icon" size="small" className="h-8 w-8" fullWidth={false}>
                <MenuDotsBoldIcon width={16} height={16} color={colors.grey} />
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
              <InboxBrokenIcon width={64} height={64} color={colors.grey} />
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
