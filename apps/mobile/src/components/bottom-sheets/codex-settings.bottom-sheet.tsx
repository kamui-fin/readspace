import { BottomSheet } from '@components/ui/bottom-sheet';
import { Button } from '@components/ui/button';
import { Divider } from '@components/ui/divider';
import { EmptyState } from '@components/ui/empty-state';
import { Skeleton } from '@components/ui/skeleton';
import { Switch } from '@components/ui/switch';
import { Text } from '@components/ui/text';
import { toast } from '@components/ui/toast';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useCodexPreferences, useFeeds, useUpdateCodexPreferences } from '@readspace/shared';
import { FolderIcon } from '@solar-icons/react-native/linear';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';

export interface CodexSettingsBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

/**
 * Daily Digest settings — the one knob mobile exposes: which folders feed the digest. Mirrors
 * the web `CodexSettingsDialog` exactly, including its state model: the switches are DERIVED
 * from the server's `excluded_folder_ids` plus an optional `draft` override that only exists
 * mid-edit. There's no effect copying server state into local state, so a slow prefs/feeds
 * fetch resolving after the sheet opens can never clobber an edit or leave a stale switch —
 * when `draft` is null the UI simply mirrors whatever the server currently says.
 *
 * Triggered from the Profile screen (not a gear on the digest itself, unlike web) — mobile
 * keeps this with the rest of the app's settings rather than a second entry point.
 */
export const CodexSettingsBottomSheet = forwardRef<CodexSettingsBottomSheetRef, object>(
  (_props, ref) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);

    /** null = "no unsaved edits, mirror the server"; a Set = the in-progress excluded set. */
    const [draft, setDraft] = useState<Set<string> | null>(null);

    const { data: feedsResponse, isLoading: feedsLoading } = useFeeds({});
    const { data: prefs, isLoading: prefsLoading } = useCodexPreferences();
    const updatePreferences = useUpdateCodexPreferences();

    useImperativeHandle(ref, () => ({
      // Refetching here (tried it) raced with gorhom's open animation/dynamic-sizing and made
      // the sheet snap itself shut right after presenting. The save mutation's own onSettled
      // already invalidates+refetches this query (verified against the installed
      // @tanstack/query-core source — mutateAsync genuinely awaits it), so by the time a human
      // re-opens the sheet the data is already current; just drop any leftover draft.
      present: () => {
        setDraft(null);
        bottomSheetRef.current?.present();
      },
      dismiss: () => bottomSheetRef.current?.dismiss(),
    }));

    const folders = useMemo(
      () =>
        [...((feedsResponse?.folders as { id: string; name: string }[] | undefined) ?? [])].sort(
          (a, b) => a.name.localeCompare(b.name)
        ),
      [feedsResponse]
    );

    // TEMP DEBUG — remove once the persistence issue is confirmed fixed.
    useEffect(() => {
      console.log('[CodexSettings] prefs query data changed:', prefs);
    }, [prefs]);

    const serverExcluded = useMemo(() => new Set(prefs?.excluded_folder_ids ?? []), [prefs]);
    /** What the switches actually reflect right now. */
    const excluded = draft ?? serverExcluded;

    const dirty =
      draft !== null &&
      (draft.size !== serverExcluded.size || [...draft].some((id) => !serverExcluded.has(id)));

    const loading = feedsLoading || prefsLoading;

    const toggle = useCallback(
      (folderId: string, included: boolean) => {
        setDraft((prev) => {
          const base = prev ?? new Set(serverExcluded);
          const next = new Set(base);
          if (included) next.delete(folderId);
          else next.add(folderId);
          console.log('[CodexSettings] toggle:', { folderId, included, next: [...next] }); // TEMP DEBUG
          return next;
        });
      },
      [serverExcluded]
    );

    const handleSave = useCallback(async () => {
      if (!draft) return;
      const payload = { excluded_folder_ids: [...draft] };
      console.log('[CodexSettings] saving payload:', payload); // TEMP DEBUG
      try {
        // The Save button already shows its own spinner (updatePreferences.isPending) — no
        // need for a redundant loading toast on top of it.
        const result = await updatePreferences.mutateAsync(payload);
        console.log('[CodexSettings] save resolved with:', result); // TEMP DEBUG
        toast.success('Digest settings saved');
        setDraft(null);
        bottomSheetRef.current?.dismiss();
      } catch (err) {
        console.log('[CodexSettings] save threw:', err); // TEMP DEBUG
        toast.error("Couldn't save digest settings");
        // keep the sheet open with the edit intact for a retry.
      }
    }, [draft, updatePreferences]);

    return (
      <BottomSheet
        ref={bottomSheetRef}
        headerTitle="Daily Digest Settings"
        headerTitleAlign="left"
        onDismiss={() => setDraft(null)} // discard any unsaved edits on close
        footerActions={
          <Button
            variant="primary"
            size="large"
            onPress={handleSave}
            disabled={!dirty || loading || updatePreferences.isPending}
            loading={updatePreferences.isPending}>
            Save
          </Button>
        }>
        <Text size="sm" className="text-grey mb-5" style={{ lineHeight: 20 }}>
          Choose which folders feed your digest. Changes take effect the next time a digest is
          built.
        </Text>

        {loading ? (
          <View style={{ gap: 20 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} className="flex-row items-center justify-between">
                <Skeleton width={140} height={16} />
                <Skeleton width={44} height={22} className="rounded-full" />
              </View>
            ))}
          </View>
        ) : folders.length === 0 ? (
          <EmptyState
            icon={FolderIcon}
            title="No folders yet"
            description="Organize your feeds into folders to control what your digest reads."
            className="py-8"
          />
        ) : (
          <View>
            {folders.map((folder, i) => {
              const included = !excluded.has(folder.id);
              return (
                <View key={folder.id}>
                  <View className="flex-row items-center justify-between py-3.5">
                    <Text
                      size={15}
                      fontFamily="geist-medium"
                      className="text-primary-foreground flex-1 pr-4"
                      numberOfLines={1}>
                      {folder.name}
                    </Text>
                    <Switch
                      checked={included}
                      onChange={(nextIncluded) => toggle(folder.id, nextIncluded)}
                    />
                  </View>
                  {i < folders.length - 1 && <Divider />}
                </View>
              );
            })}
          </View>
        )}
      </BottomSheet>
    );
  }
);

CodexSettingsBottomSheet.displayName = 'CodexSettingsBottomSheet';
