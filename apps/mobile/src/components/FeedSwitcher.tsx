import { FeedItem } from '@/components/FeedSwitcher/FeedItem';
import { FolderItem } from '@/components/FeedSwitcher/FolderItem';
import { FolderPicker, type FolderPickerRef } from '@/components/FolderPicker';
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
    useBulkDeleteFeeds,
    useBulkUpdateFeedsFolder,
    useCreateFolder,
    useDeleteFeed,
    useDeleteFolder,
    useFeeds,
    useFolders,
    useUpdateFeed,
    useUpdateFolder,
    type Feed,
    type Folder,
} from '@readspace/shared';
import { FlashList } from '@shopify/flash-list';
import { usePathname, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
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
        const renameFolderModalRef = useRef<BottomSheetModal>(null);
        const folderPickerRef = useRef<FolderPickerRef>(null);
        const confirmDeleteRef = useRef<BottomSheetModal>(null);
        const flashListRef = useRef<any>(null);

        const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
        const [isEditMode, setIsEditMode] = useState(false);
        const [selectedFeedIds, setSelectedFeedIds] = useState<Set<string>>(new Set());
        const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
        const [folderToRename, setFolderToRename] = useState<Folder | null>(null);
        const [currentIndex, setCurrentIndex] = useState<number>(-1);

        const snapPoints = useMemo(() => ['80%'], []);

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
        const updateFolderMutation = useUpdateFolder();
        const bulkDeleteFeedsMutation = useBulkDeleteFeeds();
        const bulkUpdateFeedsFolderMutation = useBulkUpdateFeedsFolder();

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

        // Handle back button to close feed switcher
        useEffect(() => {
            const onBackPress = () => {
                if (currentIndex !== -1) {
                    bottomSheetRef.current?.dismiss();
                    return true;
                }
                return false;
            };

            if (currentIndex !== -1) {
                const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
                return () => subscription.remove();
            }
        }, [currentIndex]);

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
            // Prepare FlashList for layout animation with Reanimated
            flashListRef.current?.prepareForLayoutAnimationRender();

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

                        // Clear folder selection if any child feed is modified
                        const feed = feeds.find((f) => f.id === feedId);
                        if (feed?.folder_id) {
                            setSelectedFolderIds((prevFolders) => {
                                const nextFolders = new Set(prevFolders);
                                if (feed.folder_id) {
                                    nextFolders.delete(feed.folder_id);
                                }
                                return nextFolders;
                            });
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


        const handleMoveToFolder = useCallback(() => {
            folderPickerRef.current?.present();
        }, []);

        const handleFolderSelect = useCallback(
            async (folderId: string) => {
                const feedsToMove = Array.from(selectedFeedIds);
                try {
                    // Bulk move feeds using single API call
                    await bulkUpdateFeedsFolderMutation.mutateAsync({
                        feedIds: feedsToMove,
                        folderId,
                    });

                    // Don't show toast here - the mutation handles success toast
                    setIsEditMode(false);
                    setSelectedFeedIds(new Set());
                    setSelectedFolderIds(new Set());
                } catch (error) {
                    // Error toast is handled by mutation, but keep fallback
                    console.error('Error moving feeds:', error);
                }
            },
            [selectedFeedIds, bulkUpdateFeedsFolderMutation]
        );

        const handleDeletePress = useCallback(() => {
            confirmDeleteRef.current?.present();
        }, []);

        const handleConfirmDelete = useCallback(async () => {
            const feedsToDelete = Array.from(selectedFeedIds);
            const foldersToDelete = Array.from(selectedFolderIds);

            try {
                // Delete folders first (typically fewer, so individual calls are okay)
                if (foldersToDelete.length > 0) {
                    await Promise.all(
                        foldersToDelete.map((folderId) => deleteFolderMutation.mutateAsync(folderId))
                    );
                }

                // Bulk delete feeds using single API call - only if there are feeds to delete
                if (feedsToDelete.length > 0) {
                    await bulkDeleteFeedsMutation.mutateAsync({
                        feedIds: feedsToDelete,
                    });
                }

                // Don't show toast here - the mutations handle success toasts
                setIsEditMode(false);
                setSelectedFeedIds(new Set());
                setSelectedFolderIds(new Set());
            } catch (error) {
                // Error toasts are handled by mutations, but keep fallback
                console.error('Error deleting items:', error);
            }
        }, [selectedFeedIds, selectedFolderIds, bulkDeleteFeedsMutation, deleteFolderMutation]);

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

        const handleRenameFolderPress = useCallback(() => {
            // Get the single selected folder
            const folderId = Array.from(selectedFolderIds)[0];
            const folder = folders.find((f) => f.id === folderId);
            if (folder) {
                setFolderToRename(folder);
                renameFolderModalRef.current?.present();
            }
        }, [selectedFolderIds, folders]);

        const handleRenameFolder = useCallback(
            async (name: string) => {
                if (folderToRename) {
                    try {
                        await updateFolderMutation.mutateAsync({
                            folderId: folderToRename.id,
                            name,
                        });
                        toast.success(`Renamed folder to "${name}"`);
                        setFolderToRename(null);
                        setIsEditMode(false);
                        setSelectedFolderIds(new Set());
                    } catch (error) {
                        toast.error('Failed to rename folder');
                        console.error('Error renaming folder:', error);
                    }
                }
            },
            [folderToRename, updateFolderMutation]
        );

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
                        <FeedItem
                            feed={item.feed}
                            isEditMode={isEditMode}
                            isSelected={item.isSelected || false}
                            onPress={() => handleFeedPress(item.feed!.id)}
                            isNested
                        />
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
            </View>
        ), [isEditMode, selectedCount]);

        const renderFooter = useCallback(
            (props: any) => (
                <BottomSheetFooter {...props}>
                    <View className="border-t border-light-grey dark:border-light-grey-dark bg-white dark:bg-white-dark px-6 pb-6 pt-4">
                        {isEditMode ? (
                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <Button variant="secondary" fullWidth onPress={toggleEditMode}>
                                        Cancel
                                    </Button>
                                </View>

                                {/* Action buttons - only show when items are selected */}
                                {selectedCount > 0 && (
                                    <>
                                        {/* Rename button - only show when exactly 1 folder is selected */}
                                        {selectedFolderIds.size === 1 && (
                                            <Pressable
                                                onPress={handleRenameFolderPress}
                                                className="h-12 w-12 items-center justify-center rounded-2xl bg-light-grey transition-opacity active:opacity-70 dark:bg-mid-grey-dark">
                                                <Monicon
                                                    name="solar:pen-2-linear"
                                                    size={24}
                                                    color={colors.black}
                                                />
                                            </Pressable>
                                        )}

                                        {/* Move button - show when feeds are selected */}
                                        {selectedFeedIds.size > 0 && (
                                            <Pressable
                                                onPress={handleMoveToFolder}
                                                className="h-12 w-12 items-center justify-center rounded-2xl bg-light-grey transition-opacity active:opacity-70 dark:bg-mid-grey-dark">
                                                <Monicon
                                                    name="solar:move-to-folder-linear"
                                                    size={24}
                                                    color={colors.black}
                                                />
                                            </Pressable>
                                        )}

                                        {/* Delete button - always show when items are selected */}
                                        <Pressable
                                            onPress={handleDeletePress}
                                            className="h-12 w-12 items-center justify-center rounded-2xl bg-light-grey transition-opacity active:opacity-70 dark:bg-mid-grey-dark">
                                            <Monicon
                                                name="solar:trash-bin-minimalistic-2-linear"
                                                size={24}
                                                color="#E63946"
                                            />
                                        </Pressable>
                                    </>
                                )}
                            </View>
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
            [isEditMode, selectedCount, selectedFeedIds, selectedFolderIds, handleNewFolderPress, toggleEditMode, handleRenameFolderPress, handleMoveToFolder, handleDeletePress]
        );

        return (
            <>
                <BottomSheetModal
                    key="feed-switcher-main"
                    ref={bottomSheetRef}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    enableDynamicSizing={false}
                    enableDismissOnClose={true}
                    footerComponent={renderFooter}
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: colors.white }}
                    handleIndicatorStyle={{ backgroundColor: colors.green_grey }}
                    onChange={setCurrentIndex}>
                    <BottomSheetFlashList
                        ref={flashListRef}
                        data={listData}
                        renderItem={renderItem}
                        keyExtractor={keyExtractor}
                        estimatedItemSize={50}
                        ListHeaderComponent={renderHeader}
                        ListEmptyComponent={
                            <View className="items-center justify-center px-6 py-12">
                                <Text className="font-geist text-center text-base text-grey dark:text-grey-dark">
                                    No feeds yet. Add some feeds to get started!
                                </Text>
                            </View>
                        }
                        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        enableDynamicSizing={false}
                    />
                </BottomSheetModal>

                {/* Modals */}
                <FolderNameModal 
                    key="folder-name-create"
                    ref={folderNameModalRef} 
                    onCreateFolder={handleCreateFolder} 
                />
                <FolderNameModal
                    key="folder-name-rename"
                    ref={renameFolderModalRef}
                    mode="update"
                    initialName={folderToRename?.name || ''}
                    onUpdateFolder={handleRenameFolder}
                />
                <FolderPicker 
                    key="folder-picker-switcher"
                    ref={folderPickerRef} 
                    onFolderSelect={handleFolderSelect} 
                />
                <ConfirmationModal
                    key="confirm-delete-switcher"
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
