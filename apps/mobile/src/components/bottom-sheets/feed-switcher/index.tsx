import {
  CreateFolderModal,
  type CreateFolderModalRef,
} from '@components/bottom-sheets/create-folder';
import { RenameFeedModal, type RenameFeedModalRef } from '@components/bottom-sheets/rename-feed';
import {
  RenameFolderModal,
  type RenameFolderModalRef,
} from '@components/bottom-sheets/rename-folder';
import AddFolderBoldIcon from '@components/icons/solar/add-folder-bold';
import ChecklistMinimalisticLinearIcon from '@components/icons/solar/checklist-minimalistic-linear';
import FolderWithFilesBoldIcon from '@components/icons/solar/folder-with-files-bold';
import InboxBrokenIcon from '@components/icons/solar/inbox-broken';
import MenuDotsBoldIcon from '@components/icons/solar/menu-dots-bold';
import StarBoldIcon from '@components/icons/solar/star-bold';
import TrashBinTrashBoldIcon from '@components/icons/solar/trash-bin-trash-bold';
import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { DropdownMenuRoot, DropdownMenuTrigger } from '@components/ui/dropdown-menu';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { COLORS } from '@lib/constants/colors';
import {
  type Folder,
  type Subscription,
  useBulkDeleteFeeds,
  useBulkUpdateFeedsFolder,
  useDeleteFeed,
  useDeleteFolder,
  useFeeds,
  useUnreadCounts,
  useUpdateFeed,
} from '@readspace/shared';
import { type FeedSwitcherStore, useFeedSwitcherStore } from '@stores/feed-switcher';
import { useFeedViewStore } from '@stores/feed-view';
import { useRouter } from 'expo-router';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PINNED_YELLOW = '#EAB308';

import { FolderPickerBottomSheet, type FolderPickerBottomSheetRef } from '../folder-picker';
import { FeedListItem } from './feed-list-item';
import { FolderGroup } from './folder-group';
import { SectionLabel } from './section-label';

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
    const renameFolderModalRef = useRef<RenameFolderModalRef>(null);
    const renameFeedModalRef = useRef<RenameFeedModalRef>(null);
    const folderPickerModalRef = useRef<FolderPickerBottomSheetRef>(null);
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];

    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedFeedIds, setSelectedFeedIds] = useState<Set<string>>(new Set());
    const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
    const insets = useSafeAreaInsets();

    const { data: feedsData } = useFeeds(undefined, { staleTime: 0 });
    const { data: unreadCountsData } = useUnreadCounts();
    const unreadCounts = useMemo(
      () => unreadCountsData?.feed_counts || {},
      [unreadCountsData?.feed_counts]
    );

    const router = useRouter();

    const updateFeed = useUpdateFeed();
    const deleteFeed = useDeleteFeed();
    const deleteFolder = useDeleteFolder();
    const bulkDeleteFeeds = useBulkDeleteFeeds();
    const bulkUpdateFeedsFolder = useBulkUpdateFeedsFolder();

    const lastPressTime = useRef<number>(0);
    const PRESS_THRESHOLD = 300;

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
      present: () => {
        lastPressTime.current = 0;
        bottomSheetRef.current?.present();
      },
      dismiss: () => {
        setIsSelectionMode(false);
        setSelectedFeedIds(new Set());
        setSelectedFolderIds(new Set());
        bottomSheetRef.current?.dismiss();
      },
    }));

    const favoriteFeeds = useMemo(() => feeds.filter((sub) => sub.is_favorite), [feeds]);

    const listData = useMemo<ListItem[]>(() => {
      return folders.map((folder) => {
        const folderFeeds = feeds.filter((sub) => sub.folder?.id === folder.id);
        const unreadCount = folderFeeds.reduce(
          (sum, sub) => sum + (unreadCounts[sub.feed.id] || 0),
          0
        );
        return {
          type: 'folder-group',
          id: folder.id,
          folder,
          folderFeeds,
          unreadCount,
          isExpanded: expandedFolders.has(folder.id),
          isEmpty: folderFeeds.length === 0,
        };
      });
    }, [folders, feeds, expandedFolders, unreadCounts]);

    const handlePressIn = useCallback(() => {
      lastPressTime.current = Date.now();
    }, []);

    const handleFeedPress = useCallback(
      (feedId: string) => {
        if (Date.now() - lastPressTime.current > PRESS_THRESHOLD) return;

        if (isSelectionMode) {
          setSelectedFeedIds((prev: Set<string>) => {
            const next = new Set(prev);
            if (next.has(feedId)) {
              next.delete(feedId);
              // Also deselect parent folder if it was selected
              const parentFolderId = feeds.find((f) => f.feed.id === feedId)?.folder?.id;
              if (parentFolderId) {
                setSelectedFolderIds((prevFolders) => {
                  const nextFolders = new Set(prevFolders);
                  nextFolders.delete(parentFolderId);
                  return nextFolders;
                });
              }
            } else {
              next.add(feedId);
            }
            return next;
          });
          return;
        }

        const sub = feeds.find((f) => f.feed.id === feedId);
        if (sub) {
          selectFeed(feedId, sub.custom_title || sub.feed.title);
          bottomSheetRef.current?.dismiss();
          router.navigate('/(protected)/(tabs)');
        }
      },
      [feeds, selectFeed, isSelectionMode, router]
    );

    const handleFolderPress = useCallback(
      (folderId: string) => {
        if (Date.now() - lastPressTime.current > PRESS_THRESHOLD) return;

        if (isSelectionMode) {
          const folderFeeds = listData.find((f) => f.id === folderId)?.folderFeeds || [];

          const isCurrentlySelected = selectedFolderIds.has(folderId);

          if (isCurrentlySelected) {
            setSelectedFolderIds((prev) => {
              const next = new Set(prev);
              next.delete(folderId);
              return next;
            });
            setSelectedFeedIds((prev) => {
              const next = new Set(prev);
              folderFeeds.forEach((f) => {
                next.delete(f.feed.id);
              });
              return next;
            });
          } else {
            setSelectedFolderIds((prev) => {
              const next = new Set(prev);
              next.add(folderId);
              return next;
            });
            setSelectedFeedIds((prev) => {
              const next = new Set(prev);
              folderFeeds.forEach((f) => {
                next.add(f.feed.id);
              });
              return next;
            });
          }
          return;
        }

        const folder = folders.find((f) => f.id === folderId);
        if (folder) {
          selectFolder(folderId, folder.name);
          bottomSheetRef.current?.dismiss();
          router.navigate('/(protected)/(tabs)');
        }
      },
      [folders, selectFolder, listData, isSelectionMode, selectedFolderIds, selectedFeedIds, router]
    );

    const handleToggleFavorite = useCallback(
      (sub: Subscription) => {
        updateFeed.mutate(
          {
            feedId: sub.feed.id,
            data: { is_favorite: !sub.is_favorite },
          },
          {
            onSuccess: () => {
              toast.success(sub.is_favorite ? 'Removed from favorites' : 'Added to favorites');
            },
            onError: () => toast.error('Failed to update favorite'),
          }
        );
      },
      [updateFeed]
    );

    const handleUnfollow = useCallback(
      (sub: Subscription) => {
        Alert.alert(
          'Unfollow Feed',
          `Are you sure you want to unfollow "${sub.custom_title || sub.feed.title}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Unfollow',
              style: 'destructive',
              onPress: () =>
                deleteFeed.mutate(
                  { feedId: sub.feed.id },
                  {
                    onSuccess: () => toast.success('Unfollowed feed'),
                    onError: () => toast.error('Failed to unfollow feed'),
                  }
                ),
            },
          ]
        );
      },
      [deleteFeed]
    );

    const handleDeleteFolder = useCallback(
      (folder: Folder) => {
        Alert.alert(
          'Delete Folder',
          `Are you sure you want to delete "${folder.name}"? This will unfollow all feeds inside it.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () =>
                deleteFolder.mutate(folder.id, {
                  onSuccess: () => toast.success('Folder deleted'),
                  onError: () => toast.error('Failed to delete folder'),
                }),
            },
          ]
        );
      },
      [deleteFolder]
    );

    const handleRenameFolder = useCallback((folder: Folder) => {
      renameFolderModalRef.current?.present(folder.id, folder.name);
    }, []);

    const handleBulkDelete = useCallback(() => {
      if (selectedFeedIds.size === 0 && selectedFolderIds.size === 0) return;

      Alert.alert(
        'Delete Items',
        `Are you sure you want to delete ${selectedFeedIds.size} feed(s) and ${selectedFolderIds.size} folder(s)?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              const feedIds = Array.from(selectedFeedIds);
              const folderIds = Array.from(selectedFolderIds);

              const finishDeletion = () => {
                let folderPromises: Promise<unknown>[] = [];
                if (folderIds.length > 0) {
                  folderPromises = folderIds.map((id) => deleteFolder.mutateAsync(id));
                }

                Promise.allSettled(folderPromises).then(() => {
                  toast.success('Successfully deleted selected items');
                  setIsSelectionMode(false);
                  setSelectedFeedIds(new Set());
                  setSelectedFolderIds(new Set());
                  bottomSheetRef.current?.snapToIndex(1);
                });
              };

              if (feedIds.length > 0) {
                bulkDeleteFeeds
                  .mutateAsync({ feedIds })
                  .then(() => finishDeletion())
                  .catch(() => toast.error('Failed to delete some feeds'));
              } else {
                finishDeletion();
              }
            },
          },
        ]
      );
    }, [selectedFeedIds, selectedFolderIds, deleteFeed, deleteFolder]);

    const handleBulkMove = useCallback(() => {
      if (selectedFeedIds.size === 0) {
        if (selectedFolderIds.size > 0) {
          toast.error('Cannot move folders, only feeds can be moved.');
        }
        return;
      }
      folderPickerModalRef.current?.present();
    }, [selectedFeedIds, selectedFolderIds]);

    const handleConfirmBulkMove = useCallback(
      (folderId: string | null) => {
        if (selectedFeedIds.size === 0) return;

        const feedIds = Array.from(selectedFeedIds);

        if (folderId === null) {
          // If moving to "No folder", we have to map over them
          const promises = feedIds.map((feedId) =>
            updateFeed.mutateAsync({
              feedId,
              data: { folder_id: undefined },
            })
          );
          Promise.allSettled(promises).then(() => {
            toast.success(
              `Moved ${selectedFeedIds.size} feed${selectedFeedIds.size === 1 ? '' : 's'}`
            );
            setIsSelectionMode(false);
            setSelectedFeedIds(new Set());
            setSelectedFolderIds(new Set());
            bottomSheetRef.current?.snapToIndex(1);
          });
          return;
        }

        bulkUpdateFeedsFolder
          .mutateAsync({ feedIds, folderId })
          .then(() => {
            toast.success(
              `Moved ${selectedFeedIds.size} feed${selectedFeedIds.size === 1 ? '' : 's'}`
            );
            setIsSelectionMode(false);
            setSelectedFeedIds(new Set());
            setSelectedFolderIds(new Set());
            bottomSheetRef.current?.snapToIndex(1);
          })
          .catch(() => toast.error('Failed to move feeds'));
      },
      [selectedFeedIds, updateFeed, bulkUpdateFeedsFolder]
    );

    const handleRenameFeed = useCallback((sub: Subscription) => {
      renameFeedModalRef.current?.present(sub.feed.id, sub.custom_title || sub.feed.title);
    }, []);

    const handleCreateFolderPress = useCallback(() => {
      createFolderModalRef.current?.present();
    }, []);

    const toggleSelectionMode = useCallback(() => {
      setIsSelectionMode((prev: boolean) => {
        const next = !prev;
        if (!next) {
          setSelectedFeedIds(new Set<string>());
          setSelectedFolderIds(new Set<string>());
          bottomSheetRef.current?.snapToIndex(1); // snap back
        } else {
          bottomSheetRef.current?.snapToIndex(2); // snap to 100%
        }
        return next;
      });
    }, []);

    const headerLeftActions = useMemo(() => {
      return null;
    }, []);

    const headerRightActions = useMemo(() => {
      if (isSelectionMode) {
        if (selectedFeedIds.size === 0 && selectedFolderIds.size === 0) {
          return (
            <Pressable onPress={toggleSelectionMode} className="px-1 py-2">
              <Text className="font-geist-medium text-grey dark:text-grey text-base">Cancel</Text>
            </Pressable>
          );
        }
        return (
          <View className="flex-row items-center gap-2">
            <Button
              variant="icon"
              size="small"
              className="h-8 w-8"
              fullWidth={false}
              onPress={handleBulkDelete}>
              <TrashBinTrashBoldIcon width={20} height={20} color={colors.red} />
            </Button>
            <Button
              variant="icon"
              size="small"
              className="h-8 w-8"
              fullWidth={false}
              onPress={handleBulkMove}>
              <FolderWithFilesBoldIcon width={20} height={20} color={colors.primary} />
            </Button>
            <Pressable onPress={toggleSelectionMode} className="py-2 pl-2">
              <Text className="font-geist text-grey dark:text-grey text-base">Cancel</Text>
            </Pressable>
          </View>
        );
      }

      return (
        <View className="flex-row items-center gap-2">
          <Button
            variant="icon"
            size="small"
            className="h-8 w-8"
            fullWidth={false}
            onPress={handleCreateFolderPress}>
            <AddFolderBoldIcon width={16} height={16} color={colors.grey} />
          </Button>
          <Button
            variant="icon"
            size="small"
            className="h-8 w-8"
            fullWidth={false}
            onPress={toggleSelectionMode}>
            <ChecklistMinimalisticLinearIcon width={18} height={18} color={colors.grey} />
          </Button>
        </View>
      );
    }, [
      colors.grey,
      colors.red,
      colors.primary,
      handleCreateFolderPress,
      isSelectionMode,
      toggleSelectionMode,
      selectedFeedIds.size,
      selectedFolderIds.size,
      handleBulkDelete,
      handleBulkMove,
    ]);

    const selectedFeedId = viewType === 'feed' ? selectedId : null;

    return (
      <>
        <BottomSheet
          ref={bottomSheetRef}
          onDismiss={() => {
            setIsSelectionMode(false);
            setSelectedFeedIds(new Set());
            setSelectedFolderIds(new Set());
          }}
          headerTitle={
            isSelectionMode
              ? `${selectedFeedIds.size + selectedFolderIds.size} Selected`
              : 'My Feeds'
          }
          headerTitleAlign="left"
          headerTitleStyle={isSelectionMode ? { fontSize: 18 } : {}}
          enableContentPanningGesture={true}
          enableOverDrag
          headerLeft={headerLeftActions}
          headerRight={headerRightActions}
          snapPoints={['50%', '90%', '100%']}
          index={1}>
          {listData.length === 0 && favoriteFeeds.length === 0 ? (
            <View className="items-center justify-center py-12">
              <InboxBrokenIcon width={64} height={64} color={colors.grey} />
              <Text className="font-geist-medium text-grey dark:text-grey mt-4 text-base">
                No feeds yet
              </Text>
              <Text className="font-geist-medium text-grey dark:text-grey mt-1 text-sm">
                Subscribe to feeds to see them here
              </Text>
            </View>
          ) : (
            <>
              {/* Pinned Section */}
              {favoriteFeeds.length > 0 && !isSelectionMode && (
                <View className="mb-2">
                  <SectionLabel
                    label="Pinned"
                    icon={<StarBoldIcon width={14} height={14} color={PINNED_YELLOW} />}
                    accentYellow
                  />
                  <View>
                    {favoriteFeeds.map((sub) => (
                      <View key={sub.id} className="mb-3">
                        <FeedListItem
                          sub={sub}
                          isActive={selectedFeedId === sub.feed.id}
                          unreadCount={unreadCounts[sub.feed.id] || 0}
                          onPress={() => handleFeedPress(sub.feed.id)}
                          onPressIn={handlePressIn}
                          onToggleFavorite={handleToggleFavorite}
                          onRename={handleRenameFeed}
                          onUnfollow={handleUnfollow}
                          showFolder
                          variant="pinned"
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Feeds Section */}
              {listData.length > 0 && !isSelectionMode && (
                <SectionLabel label="Feeds" className={favoriteFeeds.length > 0 ? 'mt-4' : ''} />
              )}
              <View>
                {listData.map((item) => (
                  <View key={item.id} className="mb-4">
                    <FolderGroup
                      folder={item.folder}
                      folderFeeds={item.folderFeeds}
                      unreadCount={item.unreadCount}
                      isExpanded={item.isExpanded}
                      isEmpty={item.isEmpty}
                      isFolderViewing={viewType === 'folder' && selectedId === item.folder.id}
                      selectedFeedId={selectedFeedId}
                      unreadCounts={unreadCounts}
                      isSelectionMode={isSelectionMode}
                      selectedFeedIds={selectedFeedIds}
                      selectedFolderIds={selectedFolderIds}
                      onFolderPress={handleFolderPress}
                      onFeedPress={handleFeedPress}
                      onPressIn={handlePressIn}
                      onToggleExpand={toggleFolderInStore}
                      onRenameFolder={handleRenameFolder}
                      onDeleteFolder={handleDeleteFolder}
                      onToggleFavorite={handleToggleFavorite}
                      onRenameFeed={handleRenameFeed}
                      onUnfollow={handleUnfollow}
                    />
                  </View>
                ))}
              </View>
            </>
          )}
        </BottomSheet>

        <CreateFolderModal ref={createFolderModalRef} />
        <RenameFolderModal ref={renameFolderModalRef} />
        <RenameFeedModal ref={renameFeedModalRef} />
        <FolderPickerBottomSheet
          ref={folderPickerModalRef}
          onFolderSelect={handleConfirmBulkMove}
        />
      </>
    );
  }
);

FeedSwitcherBottomSheet.displayName = 'FeedSwitcherBottomSheet';
