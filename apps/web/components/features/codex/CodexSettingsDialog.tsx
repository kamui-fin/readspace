"use client"

import { useCallback, useMemo, useState } from "react"
import { toast } from "react-hot-toast"
import { SettingsMinimalisticIcon } from "@solar-icons/react/bold"
import {
    useCodexPreferences,
    useFeeds,
    useUpdateCodexPreferences,
} from "@readspace/shared"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"

/**
 * Gear-icon trigger + dialog for the one Daily Digest knob we expose: which folders feed the
 * digest. Every folder is included by default; toggling one off drops its feeds from the next
 * generation (not the digest already on screen). Scrollable folder list, Save bottom-right.
 *
 * State model: the switches are DERIVED from the server's `excluded_folder_ids` plus an
 * optional `draft` override that only exists while the user is mid-edit. There is no effect
 * copying server state into local state, so a slow `useCodexPreferences` fetch resolving
 * after the dialog opens (or a post-save refetch) can never clobber an edit or leave a stale
 * toggle — when `draft` is null the UI simply shows whatever the server currently says.
 */
export function CodexSettingsDialog() {
    const [open, setOpen] = useState(false)
    /** null = "no unsaved edits, mirror the server"; a Set = the in-progress excluded set. */
    const [draft, setDraft] = useState<Set<string> | null>(null)

    const { data: feedsResponse, isLoading: feedsLoading } = useFeeds({})
    const { data: prefs, isLoading: prefsLoading } = useCodexPreferences()
    const updatePreferences = useUpdateCodexPreferences()

    const folders = useMemo(
        () =>
            [...(feedsResponse?.folders ?? [])].sort((a, b) =>
                a.name.localeCompare(b.name)
            ),
        [feedsResponse]
    )

    const serverExcluded = useMemo(
        () => new Set(prefs?.excluded_folder_ids ?? []),
        [prefs]
    )
    /** What the switches actually reflect right now. */
    const excluded = draft ?? serverExcluded

    const dirty =
        draft !== null &&
        (draft.size !== serverExcluded.size ||
            [...draft].some((id) => !serverExcluded.has(id)))

    const loading = feedsLoading || prefsLoading

    const handleOpenChange = useCallback((next: boolean) => {
        setOpen(next)
        if (!next) setDraft(null) // discard any unsaved edits on close
    }, [])

    const toggle = useCallback(
        (folderId: string, included: boolean) => {
            setDraft((prev) => {
                const base = prev ?? new Set(serverExcluded)
                const next = new Set(base)
                if (included) next.delete(folderId)
                else next.add(folderId)
                return next
            })
        },
        [serverExcluded]
    )

    const handleSave = useCallback(async () => {
        if (!draft) return
        try {
            await toast.promise(
                updatePreferences.mutateAsync({
                    excluded_folder_ids: [...draft],
                }),
                {
                    loading: "Saving digest settings…",
                    success: "Digest settings saved",
                    error: "Couldn't save digest settings",
                }
            )
            setDraft(null)
            setOpen(false)
        } catch {
            // toast.promise surfaced it; keep the dialog open with the edit intact for a retry.
        }
    }, [draft, updatePreferences])

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Daily Digest settings"
                >
                    <SettingsMinimalisticIcon className="size-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-md">
                <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle>Daily Digest settings</DialogTitle>
                    <DialogDescription>
                        Choose which folders feed your digest. Changes take
                        effect the next time a digest is built.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between"
                                >
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-6 w-10 rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : folders.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            You don&apos;t have any folders yet. Organise your
                            feeds into folders to control what your digest
                            reads.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border/60">
                            {folders.map((folder) => {
                                const included = !excluded.has(folder.id)
                                return (
                                    <li
                                        key={folder.id}
                                        className="flex items-center justify-between gap-4 py-3"
                                    >
                                        <label
                                            htmlFor={`codex-folder-${folder.id}`}
                                            className="min-w-0 flex-1 cursor-pointer truncate text-sm text-foreground"
                                        >
                                            {folder.name}
                                        </label>
                                        <Switch
                                            id={`codex-folder-${folder.id}`}
                                            checked={included}
                                            onCheckedChange={(checked) =>
                                                toggle(folder.id, checked)
                                            }
                                        />
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                <DialogFooter className="px-6 pt-2 pb-6">
                    <Button
                        onClick={handleSave}
                        disabled={
                            !dirty || loading || updatePreferences.isPending
                        }
                    >
                        {updatePreferences.isPending ? "Saving…" : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
