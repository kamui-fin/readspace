import { AddFeedBottomSheet, type AddFeedBottomSheetRef } from '@components/bottom-sheets/add-feed';
import {
  FolderPickerBottomSheet,
  type FolderPickerBottomSheetRef,
} from '@components/bottom-sheets/folder-picker';
import { toast } from '@components/ui/toast';
import { useCreateFeed } from '@readspace/shared';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';

export interface AddFeedFlowRef {
  /** Opens the URL sheet; the folder picker follows once a feed is confirmed. */
  present: () => void;
}

/**
 * "Add a feed by URL", end to end: the URL sheet, then the folder to file it under, then the
 * subscribe call.
 *
 * It ships as one component rather than two sheets plus a handler per screen because the pending
 * URL has to survive the hand-off between them — every screen that offered the action was
 * otherwise re-implementing the same two refs, the same pending-URL state and the same toast.
 */
export const AddFeedFlow = forwardRef<AddFeedFlowRef>((_props, ref) => {
  const addFeedRef = useRef<AddFeedBottomSheetRef>(null);
  const folderPickerRef = useRef<FolderPickerBottomSheetRef>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const createFeed = useCreateFeed();

  useImperativeHandle(ref, () => ({ present: () => addFeedRef.current?.present() }), []);

  const handleConfirm = useCallback((url: string) => {
    setPendingUrl(url);
    folderPickerRef.current?.present();
  }, []);

  const handleFolderSelect = useCallback(
    async (folderId: string | null) => {
      if (!pendingUrl) return;
      const urlToSubscribe = pendingUrl;
      setPendingUrl(null);

      try {
        // `mutateAsync` inside `toast.promise` so the toast resolves only once the mutation's
        // cache invalidations have settled — otherwise success shows over stale lists.
        await toast.promise(
          createFeed.mutateAsync({ url: urlToSubscribe, folder_id: folderId || undefined }),
          {
            loading: 'Subscribing to feed...',
            success: 'Subscribed successfully!',
            error: 'Failed to subscribe to feed',
          }
        );
      } catch (error) {
        console.log('Error subscribing to feed:', error);
      }
    },
    [pendingUrl, createFeed]
  );

  return (
    <>
      <AddFeedBottomSheet ref={addFeedRef} onConfirm={handleConfirm} />
      <FolderPickerBottomSheet ref={folderPickerRef} onFolderSelect={handleFolderSelect} />
    </>
  );
});

AddFeedFlow.displayName = 'AddFeedFlow';
