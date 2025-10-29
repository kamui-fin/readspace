import { FeedItem } from '@/components/FeedSwitcher/FeedItem';
import { FolderItem } from '@/components/FeedSwitcher/FolderItem';
import { FolderPicker } from '@/components/FolderPicker';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { FolderNameModal } from '@/components/modals/FolderNameModal';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/constants/Colors';
import { useFeedViewStore } from '@/stores/feed-view';
import {
    BottomSheetBackdrop,
    BottomSheetFlashList,
    BottomSheetFooter,
    BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import {
    useCreateFolder,
    useDeleteFeed,
    useDeleteFolder,
    useFeeds,
    useFolders,
    useUpdateFeed,
    type Feed,
    type Folder,
} from '@readspace/shared';
import { usePathname, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { toast } from 'sonner-native';

export interface FeedSwitcherRef {
    present: () => void;
    dismiss: () => void;
}

export interface FeedSwitcherProps {
    onFeedSelect?: (feedId: string) => void;
}

interface ListItem {
    type: 'folder' | 'feed';
    id: string;
    folder?: Folder;
    feed?: Feed;
    folderFeeds?: Feed[];
    unreadCount?: number;
    isExpanded?: boolean;
    isSelected?: boolean;
    isEmpty?: boolean;
}

export const FeedSwitcher = forwardRef<FeedSwitcherRef, FeedSwitcherProps>(
    ({ onFeedSelect }, ref) => {
        const router = useRouter();
        const pathname = usePathname();
        const selectFeed = useFeedViewStore((state) => state.selectFeed);
        const selectFolder = useFeedViewStore((state) => state.selectFolder);
        const { colorScheme } = useColorScheme();
        const colors = COLORS[colorScheme ?? 'light'];

        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const folderNameModalRef = useRef<BottomSheetModal>(null);
        const folderPickerRef = useRef<BottomSheetModal>(null);
        const confirmDeleteRef = useRef<BottomSheetModal>(null);

        const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
        const [isEditMode, setIsEditMode] = useState(false);
        const [selectedFeedIds, setSelectedFeedIds] = useState<Set<string>>(new Set());
        const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());

        const snapPoints = useMemo(() => ['50%', '75%', '90%'], []);

        // Fetch feeds and folders using TanStack Query
        const {
            data: feedsData,
            isLoading: isFeedsLoading,
            isFetching: isFeedsFetching,
            isSuccess: isFeedsSuccess
        } = useFeeds();
        const {
            data: foldersData,
            isLoading: isFoldersLoading,
            isFetching: isFoldersFetching,
            isSuccess: isFoldersSuccess
        } = useFolders();
        const createFolderMutation = useCreateFolder();
        const deleteFeedMutation = useDeleteFeed();
        const deleteFolderMutation = useDeleteFolder();
        const updateFeedMutation = useUpdateFeed();

        const feeds = useMemo(() => (feedsData as Feed[]) || [], [feedsData]);
        const folders = useMemo(() => (foldersData as Folder[]) || [], [foldersData]);

        // Only show loading spinner during initial load before any data arrives
        const isLoading = ((isFeedsLoading || isFeedsFetching) && !isFeedsSuccess && !feedsData) ||
                         ((isFoldersLoading || isFoldersFetching) && !isFoldersSuccess && !foldersData);

        // Expose methods to parent
        useImperativeHandle(ref, () => ({
            present: () => bottomSheetRef.current?.present(),
            dismiss: () => bottomSheetRef.current?.dismiss(),
        }));

        const selectedCount = selectedFeedIds.size + selectedFolderIds.size;

        const renderBackdrop = useCallback(
            (props: any) => (
                <BottomSheetBackdrop
                    {...props}
                    appearsOnIndex={0}
                    disappearsOnIndex={-1}
                    opacity={0.5}
                />
            ),
            []
        );

        // Flatten folders and feeds into a single list for FlashList
        const listData = useMemo<ListItem[]>(() => {
            const items: ListItem[] = [];

            folders.forEach((folder) => {
                const folderFeeds = feeds.filter((feed) => feed.folder_id === folder.id);
                const unreadCount = folderFeeds.reduce(
                    (sum, feed) => sum + (feed.unread_count || 0),
                    0
                );
                const isExpanded = expandedFolders.has(folder.id);
                const isSelected = selectedFolderIds.has(folder.id);
                const isEmpty = folderFeeds.length === 0;

                // Add folder item
                items.push({
                    type: 'folder',
                    id: folder.id,
                    folder,
                    folderFeeds,
                    unreadCount,
                    isExpanded,
                    isSelected,
                    isEmpty,
                });

                // Add feed items if expanded
                if (isExpanded && !isEmpty) {
                    folderFeeds.forEach((feed) => {
                        items.push({
                            type: 'feed',
                            id: feed.id,
                            feed,
                            isSelected: selectedFeedIds.has(feed.id),
                        });
                    });
                }
            });

            return items;
        }, [folders, feeds, expandedFolders, selectedFolderIds, selectedFeedIds]);

        const toggleFolderExpand = useCallback((folderId: string) => {
            setExpandedFolders((prev) => {
                const next = new Set(prev);
                if (next.has(folderId)) {
                    next.delete(folderId);
                } else {
                    next.add(folderId);
                }
                return next;
            });
        }, []);

        const handleFeedPress = useCallback(
            (feedId: string) => {
                if (isEditMode) {
                    setSelectedFeedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(feedId)) {
                            next.delete(feedId);
                        } else {
                            next.add(feedId);
                        }
                        return next;
                    });
                } else {
                    // Update view state and dismiss sheet
                    const feed = feeds.find((f) => f.id === feedId);
                    if (feed) {
                        selectFeed(feedId, feed.title);
                        bottomSheetRef.current?.dismiss();

                        // Navigate to home page if not already there
                        if (pathname !== '/') {
                            router.push(`/?feed_id=${feedId}`);
                        }

                        onFeedSelect?.(feedId);
                    }
                }
            },
            [isEditMode, feeds, selectFeed, onFeedSelect, pathname, router]
        );

        const handleFolderPress = useCallback(
            (folderId: string) => {
                if (isEditMode) {
                    const folderFeedIds = feeds
                        .filter((f) => f.folder_id === folderId)
                        .map((f) => f.id);
                    setSelectedFolderIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(folderId)) {
                            next.delete(folderId);
                            // Deselect all feeds in folder
                            setSelectedFeedIds((prevFeeds) => {
                                const nextFeeds = new Set(prevFeeds);
                                folderFeedIds.forEach((id) => nextFeeds.delete(id));
                                return nextFeeds;
                            });
                        } else {
                            next.add(folderId);
                            // Select all feeds in folder
                            setSelectedFeedIds((prevFeeds) => {
                                const nextFeeds = new Set(prevFeeds);
                                folderFeedIds.forEach((id) => nextFeeds.add(id));
                                return nextFeeds;
                            });
                        }
                        return next;
                    });
                } else {
                    // Update view state and dismiss sheet
                    const folder = folders.find((f) => f.id === folderId);
                    if (folder) {
                        selectFolder(folderId, folder.name);
                        bottomSheetRef.current?.dismiss();

                        // Navigate to home page if not already there
                        if (pathname !== '/') {
                            router.push(`/?folder_id=${folderId}`);
                        }

                        onFeedSelect?.(folderId);
                    }
                }
            },
            [isEditMode, feeds, folders, selectFolder, onFeedSelect, pathname, router]
        );

        const toggleEditMode = useCallback(() => {
            setIsEditMode((prev) => !prev);
            setSelectedFeedIds(new Set());
            setSelectedFolderIds(new Set());
        }, []);

        const handleMarkAllAsRead = useCallback(() => {
            // TODO: Implement mark all as read API
            const feedsToUpdate = Array.from(selectedFeedIds);
            toast.success(`Marked ${feedsToUpdate.length} feeds as read`);
            setIsEditMode(false);
            setSelectedFeedIds(new Set());
            setSelectedFolderIds(new Set());
        }, [selectedFeedIds]);

        const handleMoveToFolder = useCallback(() => {
            folderPickerRef.current?.present();
        }, []);

        const handleFolderSelect = useCallback(
            async (folderId: string) => {
                const feedsToMove = Array.from(selectedFeedIds);
                try {
                    // Move each feed to the new folder
                    await Promise.all(
                        feedsToMove.map((feedId) =>
                            updateFeedMutation.mutateAsync({
                                feedId,
                                data: { folder_id: folderId },
                            })
                        )
                    );
                    toast.success(`Moved ${feedsToMove.length} feed${feedsToMove.length > 1 ? 's' : ''} to folder`);
                    setIsEditMode(false);
                    setSelectedFeedIds(new Set());
                    setSelectedFolderIds(new Set());
                } catch (error) {
                    toast.error('Failed to move feeds');
                    console.error('Error moving feeds:', error);
                }
            },
            [selectedFeedIds, updateFeedMutation]
        );

        const handleDeletePress = useCallback(() => {
            confirmDeleteRef.current?.present();
        }, []);

        const handleConfirmDelete = useCallback(async () => {
            const feedsToDelete = Array.from(selectedFeedIds);
            const foldersToDelete = Array.from(selectedFolderIds);

            try {
                // Delete feeds first
                await Promise.all(
                    feedsToDelete.map((feedId) => deleteFeedMutation.mutateAsync({ feedId }))
                );

                // Then delete folders
                await Promise.all(
                    foldersToDelete.map((folderId) => deleteFolderMutation.mutateAsync(folderId))
                );

                const totalDeleted = feedsToDelete.length + foldersToDelete.length;
                toast.success(`Deleted ${totalDeleted} item${totalDeleted > 1 ? 's' : ''}`);

                setIsEditMode(false);
                setSelectedFeedIds(new Set());
                setSelectedFolderIds(new Set());
            } catch (error) {
                toast.error('Failed to delete items');
                console.error('Error deleting items:', error);
            }
        }, [selectedFeedIds, selectedFolderIds, deleteFeedMutation, deleteFolderMutation]);

        const handleCreateFolder = useCallback(
            async (name: string) => {
                try {
                    await createFolderMutation.mutateAsync({ name });
                    toast.success(`Created folder "${name}"`);
                } catch (error) {
                    toast.error('Failed to create folder');
                    console.error('Error creating folder:', error);
                }
            },
            [createFolderMutation]
        );

        const handleNewFolderPress = useCallback(() => {
            folderNameModalRef.current?.present();
        }, []);

        const renderItem = useCallback(
            ({ item }: { item: ListItem }) => {
                if (item.type === 'folder' && item.folder) {
                    return (
                        <FolderItem
                            folder={item.folder}
                            unreadCount={item.unreadCount || 0}
                            isExpanded={item.isExpanded || false}
                            isEditMode={isEditMode}
                            isSelected={item.isSelected || false}
                            isEmpty={item.isEmpty || false}
                            onPress={() => handleFolderPress(item.folder!.id)}
                            onToggleExpand={() => toggleFolderExpand(item.folder!.id)}
                            onLongPress={() => toggleFolderExpand(item.folder!.id)}
                        />
                    );
                } else if (item.type === 'feed' && item.feed) {
                    return (
                        <View className="pl-6">
                            <FeedItem
                                feed={item.feed}
                                isEditMode={isEditMode}
                                isSelected={item.isSelected || false}
                                onPress={() => handleFeedPress(item.feed!.id)}
                            />
                        </View>
                    );
                }
                return null;
            },
            [isEditMode, handleFolderPress, toggleFolderExpand, handleFeedPress]
        );

        const keyExtractor = useCallback((item: ListItem) => item.id, []);

        const renderHeader = useCallback(() => (
            <View className="mb-4 flex-row items-center justify-between px-6">
                <Text className="font-geist-bold text-2xl tracking-heading text-black dark:text-black-dark">
                    {isEditMode ? `${selectedCount} selected` : 'My Feeds'}
                </Text>

                {/* Loading indicator */}
                {isLoading && !isEditMode && (
                    <ActivityIndicator size="small" color="#6A994E" />
                )}

                {/* Edit Mode Actions */}
                {isEditMode && selectedCount > 0 && (
                    <View className="flex-row gap-4">
                        <Pressable
                            onPress={handleMarkAllAsRead}
                            className="transition-opacity active:opacity-70">
                            <Monicon
                                name="solar:check-read-linear"
                                size={24}
                                color="#232222"
                                className="dark:text-black-dark"
                            />
                        </Pressable>
                        <Pressable
                            onPress={handleMoveToFolder}
                            className="transition-opacity active:opacity-70">
                            <Monicon
                                name="solar:move-to-folder-linear"
                                size={24}
                                color="#232222"
                                className="dark:text-black-dark"
                            />
                        </Pressable>
                        <Pressable
                            onPress={handleDeletePress}
                            className="transition-opacity active:opacity-70">
                            <Monicon
                                name="solar:trash-bin-minimalistic-2-linear"
                                size={24}
                                color="#E63946"
                            />
                        </Pressable>
                    </View>
                )}
            </View>
        ), [isEditMode, selectedCount, isLoading, handleMarkAllAsRead, handleMoveToFolder, handleDeletePress]);

        const renderFooter = useCallback(
            (props: any) => (
                <BottomSheetFooter {...props}>
                    <View className="border-t border-light-grey dark:border-light-grey-dark bg-white dark:bg-white-dark px-6 pb-6 pt-4">
                        {isEditMode ? (
                            <Button variant="secondary" fullWidth onPress={toggleEditMode}>
                                Cancel
                            </Button>
                        ) : (
                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <Button
                                        variant="secondary"
                                        fullWidth
                                        onPress={handleNewFolderPress}
                                        className="rounded-2xl">
                                        <View className="flex-row items-center gap-2">
                                            <Monicon
                                                name="solar:add-folder-linear"
                                                size={20}
                                                color="#90988B"
                                            />
                                            <Text className="font-geist-semibold text-base text-grey dark:text-grey-dark">
                                                New Folder
                                            </Text>
                                        </View>
                                    </Button>
                                </View>

                                <View className="flex-1">
                                    <Button
                                        variant="primary"
                                        fullWidth
                                        onPress={toggleEditMode}
                                        className="rounded-2xl">
                                        <View className="flex-row items-center gap-2">
                                            <Monicon
                                                name="solar:tuning-2-linear"
                                                size={20}
                                                color="#FFFFFF"
                                            />
                                            <Text className="font-geist-semibold text-base text-white">
                                                Edit
                                            </Text>
                                        </View>
                                    </Button>
                                </View>
                            </View>
                        )}
                    </View>
                </BottomSheetFooter>
            ),
            [isEditMode, handleNewFolderPress, toggleEditMode]
        );

        return (
            <>
                <BottomSheetModal
                    ref={bottomSheetRef}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    footerComponent={renderFooter}
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: colors.white }}
                    handleIndicatorStyle={{ backgroundColor: colors.green_grey }}>
                    <BottomSheetFlashList
                        data={listData}
                        renderItem={renderItem}
                        keyExtractor={keyExtractor}
                        estimatedItemSize={50}
                        ListHeaderComponent={renderHeader}
                        ListEmptyComponent={
                            isLoading ? (
                                <View className="items-center justify-center py-12">
                                    <ActivityIndicator size="large" color="#6A994E" />
                                </View>
                            ) : (
                                <View className="items-center justify-center px-6 py-12">
                                    <Text className="text-center text-base text-grey dark:text-grey-dark">
                                        No feeds yet. Add some feeds to get started!
                                    </Text>
                                </View>
                            )
                        }
                        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                    />
                </BottomSheetModal>

                {/* Modals */}
                <FolderNameModal ref={folderNameModalRef} onCreateFolder={handleCreateFolder} />
                <FolderPicker ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
                <ConfirmationModal
                    ref={confirmDeleteRef}
                    title={`Delete ${selectedCount} feed${selectedCount > 1 ? 's' : ''}?`}
                    message="This action cannot be undone. The selected feeds will be removed permanently."
                    confirmText="Yes, delete"
                    onConfirm={handleConfirmDelete}
                />
            </>
        );
    }
);

FeedSwitcher.displayName = 'FeedSwitcher';
