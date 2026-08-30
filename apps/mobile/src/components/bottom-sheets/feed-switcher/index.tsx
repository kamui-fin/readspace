import {
  CreateFolderModal,
  type CreateFolderModalRef,
} from '@components/bottom-sheets/create-folder';
import { RenameFeedModal, type RenameFeedModalRef } from '@components/bottom-sheets/rename-feed';
import {
  RenameFolderModal,
  type RenameFolderModalRef,
} from '@components/bottom-sheets/rename-folder';
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
  queryKeys,
  RSS_QUERY_KEYS,
  type Subscription,
  useBulkDeleteFeeds,
  useBulkUpdateFeedsFolder,
  useDeleteFeed,
  useDeleteFolder,
  useFeeds,
  useUnreadCounts,
  useUpdateFeed,
} from '@readspace/shared';
import {
  AddFolderIcon,
  FolderWithFilesIcon,
  MenuDotsIcon,
  StarIcon,
  TrashBinTrashIcon,
} from '@solar-icons/react-native/bold';
import { InboxIcon } from '@solar-icons/react-native/broken';
import { ChecklistMinimalisticIcon } from '@solar-icons/react-native/linear';
import { type FeedSwitcherStore, useFeedSwitcherStore } from '@stores/feed-switcher';
import { useFeedViewStore } from '@stores/feed-view';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
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
    const currentMoveFeedRef = useRef<string | null>(null);
    const isDark = useIsDarkMode();
    const colors = COLORS[isDark ? 'dark' : 'light'];

    const queryClient = useQueryClient();
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
        bottomSheetRef.current?.present();
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS, 'list'] });
        queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() });
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

    const handleFeedPress = useCallback(
      (feedId: string) => {
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          selectFeed(feedId, sub.custom_title || sub.feed.title);
          bottomSheetRef.current?.dismiss();
          router.navigate('/(protected)/(tabs)');
        }
      },
      [feeds, selectFeed, isSelectionMode, router]
    );

    const handleFolderPress = useCallback(
      (folderId: string) => {
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          selectFolder(folderId, folder.name);
          bottomSheetRef.current?.dismiss();
          router.navigate('/(protected)/(tabs)');
        }
      },
      [folders, selectFolder, listData, isSelectionMode, selectedFolderIds, selectedFeedIds, router]
    );

    const handleToggleFavorite = useCallback(
      (sub: Subscription) => {
        const wasFavorite = sub.is_favorite;
        toast.promise(
          updateFeed.mutateAsync({
            feedId: sub.feed.id,
            data: { is_favorite: !wasFavorite },
          }),
          {
            loading: 'Updating...',
            success: wasFavorite ? 'Removed from favorites' : 'Added to favorites',
            error: 'Failed to update favorite',
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
              onPress: () => {
                toast.promise(deleteFeed.mutateAsync({ feedId: sub.feed.id }), {
                  loading: 'Unfollowing...',
                  success: 'Unfollowed feed',
                  error: 'Failed to unfollow feed',
                });
              },
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
              onPress: () => {
                toast.promise(deleteFolder.mutateAsync(folder.id), {
                  loading: 'Deleting...',
                  success: 'Folder deleted',
                  error: 'Failed to delete folder',
                });
              },
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

              // Exit selection mode right away — deleting can take a moment, and the
              // loading toast below is the feedback while it's in flight.
              setIsSelectionMode(false);
              setSelectedFeedIds(new Set());
              setSelectedFolderIds(new Set());
              bottomSheetRef.current?.snapToIndex(1);

              const deletePromise = (async () => {
                if (feedIds.length > 0) {
                  await bulkDeleteFeeds.mutateAsync({ feedIds });
                }
                if (folderIds.length > 0) {
                  await Promise.all(folderIds.map((id) => deleteFolder.mutateAsync(id)));
                }
              })();

              toast.promise(deletePromise, {
                loading: 'Deleting...',
                success: 'Successfully deleted selected items',
                error: 'Failed to delete some items',
              });
            },
          },
        ]
      );
    }, [selectedFeedIds, selectedFolderIds, bulkDeleteFeeds, deleteFolder]);

    const handleBulkMove = useCallback(() => {
      if (selectedFeedIds.size === 0) {
        if (selectedFolderIds.size > 0) {
          toast.error('Cannot move folders, only feeds can be moved.');
        }
        return;
      }
      // Guard against a stale single-feed move: if a previous "Move to folder" from a
      // feed's dropdown was dismissed (swipe-to-close) without confirming a folder,
      // currentMoveFeedRef is never cleared. Without this reset, handleConfirmBulkMove
      // would see it still set and silently treat this bulk move as a single-feed move
      // for that leftover feed — no bulk mutation runs, no bulk toast fires, and the
      // selected feeds never move.
      currentMoveFeedRef.current = null;
      folderPickerModalRef.current?.present();
    }, [selectedFeedIds, selectedFolderIds]);

    const handleSingleFeedMoveComplete = useCallback(
      (feedId: string, folderId: string | null) => {
        updateFeed
          .mutateAsync({
            feedId,
            data: { folder_id: folderId ?? undefined },
          })
          .then(() => {
            toast.success('Feed moved');
          })
          .catch(() => {
            toast.error('Failed to move feed');
          });
      },
      [updateFeed]
    );

    const handleConfirmBulkMove = useCallback(
      (folderId: string | null) => {
        // Check if this is a single feed move (from dropdown)
        if (currentMoveFeedRef.current) {
          const feedId = currentMoveFeedRef.current;
          currentMoveFeedRef.current = null;
          handleSingleFeedMoveComplete(feedId, folderId);
          return;
        }

        if (selectedFeedIds.size === 0) return;

        const feedIds = Array.from(selectedFeedIds);
        const feedLabel = `${feedIds.length} feed${feedIds.length === 1 ? '' : 's'}`;

        // Exit selection mode right away — the move can take a moment, and the loading
        // toast below is the feedback while it's in flight.
        setIsSelectionMode(false);
        setSelectedFeedIds(new Set());
        setSelectedFolderIds(new Set());
        bottomSheetRef.current?.snapToIndex(1);

        if (folderId === null) {
          // If moving to "No folder", we have to map over them
          const movePromise = Promise.all(
            feedIds.map((feedId) =>
              updateFeed.mutateAsync({
                feedId,
                data: { folder_id: undefined },
              })
            )
          );

          toast.promise(movePromise, {
            loading: 'Moving...',
            success: `Moved ${feedLabel}`,
            error: 'Failed to move feeds',
          });
          return;
        }

        toast.promise(bulkUpdateFeedsFolder.mutateAsync({ feedIds, folderId }), {
          loading: 'Moving...',
          success: `Moved ${feedLabel}`,
          error: 'Failed to move feeds',
        });
      },
      [selectedFeedIds, updateFeed, bulkUpdateFeedsFolder, handleSingleFeedMoveComplete]
    );

    const handleRenameFeed = useCallback((sub: Subscription) => {
      renameFeedModalRef.current?.present(sub.feed.id, sub.custom_title || sub.feed.title);
    }, []);

    const handleMoveToFolder = useCallback((sub: Subscription) => {
      currentMoveFeedRef.current = sub.feed.id;
      setSelectedFeedIds(new Set([sub.feed.id]));
      folderPickerModalRef.current?.present();
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
              <TrashBinTrashIcon size={20} color={colors.red} />
            </Button>
            <Button
              variant="icon"
              size="small"
              className="h-8 w-8"
              fullWidth={false}
              onPress={handleBulkMove}>
              <FolderWithFilesIcon size={20} color={colors.primary} />
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
            <AddFolderIcon size={16} color={colors.grey} />
          </Button>
          <Button
            variant="icon"
            size="small"
            className="h-8 w-8"
            fullWidth={false}
            onPress={toggleSelectionMode}>
            <ChecklistMinimalisticIcon size={18} color={colors.grey} />
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
          index={1}
          contentPaddingHorizontal={0}>
          {listData.length === 0 && favoriteFeeds.length === 0 ? (
            <View className="items-center justify-center py-12">
              <InboxIcon size={64} color={colors.grey} />
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
                  <View style={{ paddingLeft: 24, paddingRight: 0 }}>
                    <SectionLabel
                      label="Pinned"
                      icon={<StarIcon size={14} color={PINNED_YELLOW} />}
                      accentYellow
                    />
                  </View>
                  <View>
                    {favoriteFeeds.map((sub) => (
                      <View key={sub.id}>
                        <FeedListItem
                          sub={sub}
                          isActive={selectedFeedId === sub.feed.id}
                          unreadCount={unreadCounts[sub.feed.id] || 0}
                          onPress={() => handleFeedPress(sub.feed.id)}
                          onToggleFavorite={handleToggleFavorite}
                          onRename={handleRenameFeed}
                          onUnfollow={handleUnfollow}
                          onMoveToFolder={handleMoveToFolder}
                          showFolder
                          variant="pinned"
                          style={{ paddingLeft: 24 }}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Feeds Section label - left-padded to align with header */}
              {listData.length > 0 && !isSelectionMode && (
                <SectionLabel
                  label="Feeds"
                  className={favoriteFeeds.length > 0 ? 'mt-4' : ''}
                  style={{ paddingLeft: 24 }}
                />
              )}
              <View style={{ paddingBottom: 48 }}>
                {listData.map((item) => (
                  <View key={item.id}>
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
                      onToggleExpand={toggleFolderInStore}
                      onRenameFolder={handleRenameFolder}
                      onDeleteFolder={handleDeleteFolder}
                      onToggleFavorite={handleToggleFavorite}
                      onRenameFeed={handleRenameFeed}
                      onUnfollow={handleUnfollow}
                      onMoveToFolder={handleMoveToFolder}
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
