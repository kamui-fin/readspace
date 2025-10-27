import { FeedItem } from '@/components/FeedSwitcher/FeedItem';
import { FolderItem } from '@/components/FeedSwitcher/FolderItem';
import { FolderPicker } from '@/components/FolderPicker';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { FolderNameModal } from '@/components/modals/FolderNameModal';
import { Button } from '@/components/ui/Button';
import { useFeedViewStore } from '@/stores/feed-view';
import {
    MOCK_FEEDS,
    MOCK_FOLDERS,
    type Feed,
    type Folder,
} from '@/utils/mockFeeds';
import {
    BottomSheetBackdrop,
    BottomSheetFlashList,
    BottomSheetFooter,
    BottomSheetModal,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Monicon } from '@monicon/native';
import { usePathname, useRouter } from 'expo-router';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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

        const bottomSheetRef = useRef<BottomSheetModal>(null);
        const folderNameModalRef = useRef<BottomSheetModal>(null);
        const folderPickerRef = useRef<BottomSheetModal>(null);
        const confirmDeleteRef = useRef<BottomSheetModal>(null);

        const [feeds, setFeeds] = useState<Feed[]>(MOCK_FEEDS);
        const [folders, setFolders] = useState<Folder[]>(MOCK_FOLDERS);
        const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
        const [isEditMode, setIsEditMode] = useState(false);
        const [selectedFeedIds, setSelectedFeedIds] = useState<Set<string>>(new Set());
        const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());

        const snapPoints = useMemo(() => ['50%', '75%', '90%'], []);

        // Expose methods to parent
        useImperativeHandle(ref, () => ({
            present: () => bottomSheetRef.current?.present(),
            dismiss: () => bottomSheetRef.current?.dismiss(),
        }));

        const selectedCount = selectedFeedIds.size + selectedFolderIds.size;

        const renderBackdrop = useCallback(
            (props: any) => (
                <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
            ),
            []
        );

        // Flatten folders and feeds into a single list for FlashList
        const listData = useMemo<ListItem[]>(() => {
            const items: ListItem[] = [];

            folders.forEach((folder) => {
                const folderFeeds = feeds.filter((feed) => feed.folderId === folder.id);
                const unreadCount = folderFeeds.reduce((sum, feed) => sum + feed.unreadCount, 0);
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
                        selectFeed(feedId, feed.name);
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
                    const folderFeedIds = feeds.filter((f) => f.folderId === folderId).map((f) => f.id);
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
            // Mock implementation
            const feedsToUpdate = Array.from(selectedFeedIds);
            setFeeds((prev) =>
                prev.map((feed) =>
                    feedsToUpdate.includes(feed.id) ? { ...feed, unreadCount: 0 } : feed
                )
            );
            toast.success(`Marked ${feedsToUpdate.length} feeds as read`);
            setIsEditMode(false);
            setSelectedFeedIds(new Set());
            setSelectedFolderIds(new Set());
        }, [selectedFeedIds]);

        const handleMoveToFolder = useCallback(() => {
            folderPickerRef.current?.present();
        }, []);

        const handleFolderSelect = useCallback(
            (folderId: string) => {
                const feedsToMove = Array.from(selectedFeedIds);
                setFeeds((prev) =>
                    prev.map((feed) =>
                        feedsToMove.includes(feed.id) ? { ...feed, folderId } : feed
                    )
                );
                toast.success(`Moved ${feedsToMove.length} feeds to folder`);
                setIsEditMode(false);
                setSelectedFeedIds(new Set());
                setSelectedFolderIds(new Set());
            },
            [selectedFeedIds]
        );

        const handleDeletePress = useCallback(() => {
            confirmDeleteRef.current?.present();
        }, []);

        const handleConfirmDelete = useCallback(() => {
            const feedsToDelete = Array.from(selectedFeedIds);
            const foldersToDelete = Array.from(selectedFolderIds);

            // Delete folders and their feeds
            const feedsInDeletedFolders = feeds
                .filter((feed) => foldersToDelete.includes(feed.folderId || ''))
                .map((f) => f.id);

            // Delete feeds and feeds in deleted folders
            setFeeds((prev) =>
                prev.filter(
                    (feed) =>
                        !feedsToDelete.includes(feed.id) &&
                        !feedsInDeletedFolders.includes(feed.id)
                )
            );

            setFolders((prev) => prev.filter((folder) => !foldersToDelete.includes(folder.id)));

            const totalDeleted = feedsToDelete.length + foldersToDelete.length;
            toast.success(`Deleted ${totalDeleted} item${totalDeleted > 1 ? 's' : ''}`);

            setIsEditMode(false);
            setSelectedFeedIds(new Set());
            setSelectedFolderIds(new Set());
        }, [selectedFeedIds, selectedFolderIds, feeds]);

        const handleCreateFolder = useCallback(
            (name: string) => {
                const newFolder: Folder = {
                    id: `folder-${Date.now()}`,
                    name,
                    feedIds: [],
                };
                setFolders((prev) => [...prev, newFolder]);
                toast.success(`Created folder "${name}"`);
            },
            []
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

        const renderFooter = useCallback(
            (props: any) => (
                <BottomSheetFooter {...props}>
                    <View className="border-t border-light-grey bg-white px-6 pb-6 pt-4">
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
                                            <Monicon name="solar:add-folder-linear" size={20} color="#90988B" />
                                            <Text className="font-geist-semibold text-base text-grey">
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
                                            <Monicon name="solar:tuning-2-linear" size={20} color="#FFFFFF" />
                                            <Text className="font-geist-semibold text-base text-white">Edit</Text>
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
                    backgroundStyle={{ backgroundColor: '#FFFFFF' }}
                    handleIndicatorStyle={{ backgroundColor: '#D1DBCD' }}>
                    <BottomSheetView className="flex-1">
                        {/* Header */}
                        <View className="mb-4 flex-row items-center justify-between px-6">
                            <Text className="font-geist-bold text-2xl tracking-heading text-black">
                                {isEditMode ? `${selectedCount} selected` : 'My Feeds'}
                            </Text>

                            {/* Edit Mode Actions */}
                            {isEditMode && selectedCount > 0 && (
                                <View className="flex-row gap-4">
                                    <Pressable
                                        onPress={handleMarkAllAsRead}
                                        className="transition-opacity active:opacity-70">
                                        <Monicon name="solar:check-read-linear" size={24} color="#232222" />
                                    </Pressable>
                                    <Pressable
                                        onPress={handleMoveToFolder}
                                        className="transition-opacity active:opacity-70">
                                        <Monicon name="solar:move-to-folder-linear" size={24} color="#232222" />
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

                        {/* Feed List */}
                        <BottomSheetFlashList
                            data={listData}
                            renderItem={renderItem}
                            keyExtractor={keyExtractor}
                            estimatedItemSize={50}
                            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
                            showsVerticalScrollIndicator={false}
                        />

                    </BottomSheetView>
                </BottomSheetModal>

                {/* Modals */}
                <FolderNameModal ref={folderNameModalRef} onCreateFolder={handleCreateFolder} />
                <FolderPicker
                    ref={folderPickerRef}
                    folders={folders}
                    onFolderSelect={handleFolderSelect}
                />
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

