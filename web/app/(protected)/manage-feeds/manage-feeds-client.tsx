"use client"

import { formatDistanceToNow, parseISO } from "date-fns"
import {
    AlertTriangle,
    CheckCircle,
    Edit3,
    ExternalLink,
    MoreHorizontal,
    Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "react-hot-toast"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import Header from "@/components/navigation/header"

import {
    useDeleteFeed,
    useFeeds,
    useFolders,
    useUpdateFeed,
    type Feed,
} from "@/lib/api/hooks/feeds"
import { fuzzySearch } from "@/lib/utils"
import { useDebounce } from "use-debounce"

// Skeleton Loading Component
function ManageFeedsPageSkeleton() {
    return (
        <div className="container mx-auto p-4 md:p-8 space-y-6">
            {/* Header Skeleton */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-9 w-48" />
                    <Skeleton className="h-5 w-80" />
                </div>
            </header>

            {/* Filters and Bulk Actions Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-1">
                    <Skeleton className="h-9 w-full" />
                </div>
                <div className="md:col-span-1">
                    <Skeleton className="h-9 w-full max-w-xs" />
                </div>
                <div className="md:col-span-1 flex justify-end gap-2">
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>

            {/* Table Skeleton */}
            <div className="rounded-lg border overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Skeleton className="h-4 w-4" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-32" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-16" />
                            </TableHead>
                            <TableHead className="text-center">
                                <Skeleton className="h-4 w-16 mx-auto" />
                            </TableHead>
                            <TableHead className="text-right">
                                <Skeleton className="h-4 w-20 ml-auto" />
                            </TableHead>
                            <TableHead className="text-right">
                                <Skeleton className="h-4 w-16 ml-auto" />
                            </TableHead>
                            <TableHead className="w-[100px] text-right">
                                <Skeleton className="h-4 w-16 ml-auto" />
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 8 }).map((_, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <Skeleton className="h-4 w-4" />
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="h-5 w-5 rounded-sm" />
                                        <div className="flex flex-col gap-1">
                                            <Skeleton className="h-4 w-48" />
                                            <Skeleton className="h-3 w-64" />
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-8 w-32" />
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex justify-center">
                                        <Skeleton className="h-6 w-16 rounded-full" />
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Skeleton className="h-3 w-20 ml-auto" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Skeleton className="h-3 w-16 ml-auto" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Skeleton className="h-8 w-8 ml-auto rounded-md" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

// Placeholder for now, will be fleshed out
export default function ManageFeedsPageClient() {
    const {
        data: feeds = [],
        isLoading: isLoadingFeeds,
        error: feedsError,
    } = useFeeds()
    const { data: folders = [], isLoading: isLoadingFolders } = useFolders()

    const [searchTerm, setSearchTerm] = useState("")
    const [debouncedSearchTerm] = useDebounce<string>(searchTerm, 300)
    const [selectedFeedIds, setSelectedFeedIds] = useState<string[]>([])
    const [filterFolderId, setFilterFolderId] = useState<string | "all">("all")
    // TODO: Add filterByTag state

    // Modal States
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isTagsModalOpen, setIsTagsModalOpen] = useState(false)
    const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] =
        useState(false)
    const [isBulkEditFolderModalOpen, setIsBulkEditFolderModalOpen] =
        useState(false)
    const [targetBulkFolderId, setTargetBulkFolderId] = useState<string | null>(
        null
    )
    const [currentFeed, setCurrentFeed] = useState<Feed | null>(null) // For context in modals
    const [editFeedTitle, setEditFeedTitle] = useState("") // State for the title input in edit modal

    const updateFeedMutation = useUpdateFeed()
    const deleteFeedMutation = useDeleteFeed()

    const filteredFeeds = useMemo(() => {
        let tempFeeds = feeds
        if (filterFolderId !== "all") {
            tempFeeds = tempFeeds.filter(
                (feed) => feed.folder_id === filterFolderId
            )
        }
        // TODO: Add tag filtering
        if (debouncedSearchTerm) {
            // tempFeeds = tempFeeds.filter(feed =>
            //     feed.title?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
            //     feed.url.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
            // );
            tempFeeds = fuzzySearch(tempFeeds, debouncedSearchTerm, [
                "title",
                "url",
            ])
        }
        return tempFeeds
    }, [feeds, debouncedSearchTerm, filterFolderId])

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedFeedIds(filteredFeeds.map((feed) => feed.id))
        } else {
            setSelectedFeedIds([])
        }
    }

    const handleSelectFeed = (feedId: string, checked: boolean) => {
        if (checked) {
            setSelectedFeedIds((prev) => [...prev, feedId])
        } else {
            setSelectedFeedIds((prev) => prev.filter((id) => id !== feedId))
        }
    }



    const isFeedDead = (feed: Feed): boolean => {
        if (feed.fetch_error_count > 5) return true
        if (feed.last_article_published_at) {
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90) // Consider dead if no new posts in 90 days
            if (parseISO(feed.last_article_published_at) < thirtyDaysAgo) {
                return true
            }
        } else {
            // If no last_article_published_at and it has been fetched, it might be a new feed or truly dead
            if (feed.last_fetched_at && feed.fetch_error_count === 0) {
                // Successfully fetched but no articles
                const ninetyDaysAgo = new Date()
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
                if (parseISO(feed.last_fetched_at) < ninetyDaysAgo) return true // No articles found for 90 days
            }
        }
        return false
    }

    const handleChangeFolder = (feedId: string, newFolderId: string | null) => {
        if (!newFolderId) return
        updateFeedMutation.mutate({
            feedId,
            data: {
                folder_id: newFolderId === "none" ? undefined : newFolderId,
            },
            silent: false, // Use built-in toast notifications
        })
    }

    const handleDeleteSelected = () => {
        if (selectedFeedIds.length === 0) return
        // Basic confirmation for now
        if (
            window.confirm(
                `Are you sure you want to delete ${selectedFeedIds.length} feed(s)?`
            )
        ) {
            // Use Promise.allSettled with mutateAsync for proper batch handling
            toast.promise(
                Promise.allSettled(
                    selectedFeedIds.map((id) =>
                        deleteFeedMutation.mutateAsync({ feedId: id, silent: true })
                    )
                ),
                {
                    loading: "Deleting feeds...",
                    success: (results) => {
                        const successful = results.filter(
                            (r) => r.status === "fulfilled"
                        ).length
                        const failed = results.length - successful
                        setSelectedFeedIds([])
                        return `Deleted ${successful} feeds. ${failed > 0 ? `${failed} failed.` : ""}`
                    },
                    error: "An unexpected error occurred while deleting feeds.",
                }
            )
        }
    }

    // Show skeleton loading state
    if (isLoadingFeeds || isLoadingFolders) {
        return <ManageFeedsPageSkeleton />
    }

    if (feedsError) {
        return (
            <div className="container mx-auto p-4 text-red-500">
                Error loading feeds: {(feedsError as Error).message}
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header
                breadcrumbItems={[{ href: "/manage-feeds", label: "Manage Feeds" }]}
            />
            <main className="flex-1">
                <div className="container mx-auto p-4 md:p-8 space-y-6">
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold">Manage Feeds</h1>
                            <p className="text-muted-foreground">
                                View, edit, and organize your RSS feeds.
                            </p>
                        </div>
                        {/* <Button onClick={() => alert("Add New Feed functionality TBD")} className="w-full md:w-auto">
                            Add New Feed
                        </Button> */}
                    </header>

            {/* Filters and Bulk Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-1">
                    <Input
                        placeholder="Search feeds by title or URL..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="md:col-span-1">
                    <Select
                        value={filterFolderId}
                        onValueChange={setFilterFolderId}
                    >
                        <SelectTrigger className="max-w-xs">
                            <SelectValue placeholder="Filter by folder" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Folders</SelectItem>
                            {folders.map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                    {folder.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {/* TODO: Add Tag Filter */}
                <div className="md:col-span-1 flex justify-end gap-2">
                    {selectedFeedIds.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={() => setIsBulkEditFolderModalOpen(true)}
                        >
                            Change Folder ({selectedFeedIds.length})
                        </Button>
                    )}
                    {selectedFeedIds.length > 0 && (
                        <Button
                            variant="destructive"
                            onClick={handleDeleteSelected}
                        >
                            Delete ({selectedFeedIds.length})
                        </Button>
                    )}
                </div>
            </div>

            {/* Feeds Table */}
            <div className="w-full overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={
                                        selectedFeedIds.length ===
                                            filteredFeeds.length &&
                                        filteredFeeds.length > 0
                                    }
                                    onCheckedChange={(checked) =>
                                        handleSelectAll(Boolean(checked))
                                    }
                                    aria-label="Select all rows"
                                />
                            </TableHead>
                            <TableHead>Feed Title & URL</TableHead>
                            <TableHead>Folder</TableHead>
                            <TableHead className="text-center w-[90px]">Status</TableHead>
                            <TableHead className="text-right">Last Post</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredFeeds.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="text-center h-24"
                                >
                                    No feeds match your criteria.
                                </TableCell>
                            </TableRow>
                        )}
                        {filteredFeeds.map((feed) => {
                            const isSelected = selectedFeedIds.includes(feed.id)
                            const dead = isFeedDead(feed)
                            return (
                                <TableRow
                                    key={feed.id}
                                    data-state={
                                        isSelected ? "selected" : undefined
                                    }
                                >
                                    <TableCell>
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={(checked) =>
                                                handleSelectFeed(
                                                    feed.id,
                                                    Boolean(checked)
                                                )
                                            }
                                            aria-label={`Select row for ${feed.title}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {feed.image_url && (
                                                <img
                                                    src={feed.image_url}
                                                    alt=""
                                                    className="h-5 w-5 rounded-sm object-cover"
                                                />
                                            )}
                                            <div className="flex flex-col">
                                                <span
                                                    className="whitespace-nowrap"
                                                    title={feed.title || "N/A"}
                                                >
                                                    {feed.title || "N/A"}
                                                </span>
                                                <a
                                                    href={feed.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-muted-foreground hover:text-primary whitespace-nowrap"
                                                    title={feed.url}
                                                >
                                                    {feed.url}{" "}
                                                    <ExternalLink className="inline h-3 w-3 ml-0.5" />
                                                </a>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={feed.folder_id || "none"}
                                            onValueChange={(newFolderId) =>
                                                handleChangeFolder(
                                                    feed.id,
                                                    newFolderId
                                                )
                                            }
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Select folder" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {folders.map((folder) => (
                                                    <SelectItem
                                                        key={folder.id}
                                                        value={folder.id}
                                                    >
                                                        {folder.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {dead ? (
                                            <Badge
                                                variant="destructive"
                                                className="whitespace-nowrap"
                                                title={`Error count: ${feed.fetch_error_count}. ${feed.last_error_message || ""}`}
                                            >
                                                <AlertTriangle className="h-3 w-3 mr-1" />{" "}
                                                Dead
                                            </Badge>
                                        ) : feed.fetch_error_count > 0 ? (
                                            <Badge
                                                variant="orange"
                                                className="whitespace-nowrap"
                                                title={`Error count: ${feed.fetch_error_count}. ${feed.last_error_message || ""}`}
                                            >
                                                <AlertTriangle className="h-3 w-3 mr-1" />{" "}
                                                Warning
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="whitespace-nowrap">
                                                <CheckCircle className="h-3 w-3 mr-1" />{" "}
                                                Active
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right text-xs">
                                        {feed.last_article_published_at ? (
                                            <div className="text-muted-foreground whitespace-nowrap">
                                                {formatDistanceToNow(
                                                    parseISO(
                                                        feed.last_article_published_at
                                                    ),
                                                    { addSuffix: true }
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-muted-foreground whitespace-nowrap">
                                                No posts yet
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setCurrentFeed(feed)
                                                        setEditFeedTitle(
                                                            feed.title || ""
                                                        )
                                                        setIsEditModalOpen(true)
                                                    }}
                                                >
                                                    <Edit3 className="mr-2 h-4 w-4" />{" "}
                                                    Edit Details
                                                </DropdownMenuItem>
                                                {/* <DropdownMenuItem onClick={() => {
                                                    setCurrentFeed(feed);
                                                    setIsTagsModalOpen(true);
                                                }}>
                                                    <TagIcon className="mr-2 h-4 w-4" /> Manage Tags
                                                </DropdownMenuItem> */}
                                                <DropdownMenuItem
                                                    className="text-red-600 focus:text-red-600"
                                                    onClick={() => {
                                                        setCurrentFeed(feed)
                                                        setIsDeleteConfirmModalOpen(
                                                            true
                                                        )
                                                    }}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />{" "}
                                                    Delete Feed
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
            {/* TODO: Pagination if lots of feeds */}

            {/* Edit Feed Details Modal */}
            {currentFeed && (
                <Dialog
                    open={isEditModalOpen}
                    onOpenChange={setIsEditModalOpen}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                Edit Feed: {currentFeed.title}
                            </DialogTitle>
                            <DialogDescription>
                                Current URL: {currentFeed.url}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <label
                                htmlFor="feedTitle"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                            >
                                Feed Title
                            </label>
                            <Input
                                id="feedTitle"
                                value={editFeedTitle}
                                onChange={(e) =>
                                    setEditFeedTitle(e.target.value)
                                }
                                placeholder="Enter new feed title"
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setIsEditModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    if (!editFeedTitle.trim()) {
                                        toast.error("Title cannot be empty.")
                                        return
                                    }
                                    updateFeedMutation.mutate(
                                        {
                                            feedId: currentFeed.id,
                                            data: {
                                                title: editFeedTitle.trim(),
                                            },
                                            silent: false, // Use built-in toast notifications
                                        },
                                        {
                                            onSuccess: () => {
                                                setIsEditModalOpen(false)
                                            },
                                        }
                                    )
                                }}
                                disabled={
                                    updateFeedMutation.status === "pending" ||
                                    editFeedTitle.trim() ===
                                        (currentFeed.title || "")
                                }
                            >
                                {updateFeedMutation.status === "pending"
                                    ? "Saving..."
                                    : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Manage Tags Modal */}
            {currentFeed && (
                <Dialog
                    open={isTagsModalOpen}
                    onOpenChange={setIsTagsModalOpen}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                Manage Tags for: {currentFeed.title}
                            </DialogTitle>
                            <DialogDescription>
                                Current tags:
                                {(currentFeed.tags || []).length > 0 ? (
                                    (currentFeed.tags || []).map((tag) => (
                                        <Badge
                                            key={tag.id}
                                            variant="secondary"
                                            className="mr-1 my-2 text-xs"
                                        >
                                            {tag.name}
                                        </Badge>
                                    ))
                                ) : (
                                    <span className="ml-1 italic text-muted-foreground">
                                        No tags assigned.
                                    </span>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            {/* Placeholder for adding/removing tags */}
                            <p className="text-sm text-muted-foreground">
                                Tag editing functionality (add, remove
                                new/existing tags) will be implemented here.
                            </p>
                            <Input
                                disabled
                                placeholder="Add new or existing tag... (future feature)"
                                className="mt-2"
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setIsTagsModalOpen(false)}
                            >
                                Close
                            </Button>
                            {/* <Button disabled>Save Tag Changes</Button> */}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Delete Confirmation Modal */}
            {currentFeed && (
                <Dialog
                    open={isDeleteConfirmModalOpen}
                    onOpenChange={setIsDeleteConfirmModalOpen}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                Delete Feed: {currentFeed.title}?
                            </DialogTitle>
                            <DialogDescription>
                                Are you sure you want to unfollow and delete
                                this feed? This action cannot be undone. All
                                downloaded articles for this feed will also be
                                removed.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="mt-4">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    setIsDeleteConfirmModalOpen(false)
                                }
                                disabled={
                                    deleteFeedMutation.status === "pending"
                                }
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    deleteFeedMutation.mutate({ feedId: currentFeed.id, silent: false }, {
                                        onSuccess: () => {
                                            setIsDeleteConfirmModalOpen(false)
                                            if (
                                                selectedFeedIds.includes(
                                                    currentFeed.id
                                                )
                                            ) {
                                                setSelectedFeedIds((prev) =>
                                                    prev.filter(
                                                        (id) =>
                                                            id !==
                                                            currentFeed.id
                                                    )
                                                )
                                            }
                                            setCurrentFeed(null) // Clear current feed after deletion
                                        },
                                        onError: () => {
                                            setIsDeleteConfirmModalOpen(false)
                                        },
                                    })
                                }}
                                disabled={
                                    deleteFeedMutation.status === "pending"
                                }
                            >
                                {deleteFeedMutation.status === "pending"
                                    ? "Deleting..."
                                    : "Delete Feed"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Bulk Edit Folder Modal */}
            <Dialog
                open={isBulkEditFolderModalOpen}
                onOpenChange={(isOpen) => {
                    setIsBulkEditFolderModalOpen(isOpen)
                    if (!isOpen) setTargetBulkFolderId(null) // Reset on close
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Change Folder for {selectedFeedIds.length} Feed(s)
                        </DialogTitle>
                        <DialogDescription>
                            Select a new folder for the selected feeds. This
                            will update all selected feeds.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Select
                            onValueChange={(newFolderId) => {
                                setTargetBulkFolderId(newFolderId)
                            }}
                            value={targetBulkFolderId || ""} // Ensure value is controlled
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select new folder" />
                            </SelectTrigger>
                            <SelectContent>
                                {folders.map((folder) => (
                                    <SelectItem
                                        key={folder.id}
                                        value={folder.id}
                                    >
                                        {folder.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsBulkEditFolderModalOpen(false)
                                setTargetBulkFolderId(null) // Reset on cancel
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (!targetBulkFolderId) {
                                    toast.error(
                                        "Please select a target folder."
                                    )
                                    return
                                }

                                const updates = selectedFeedIds.map((feedId) =>
                                    updateFeedMutation.mutateAsync({
                                        feedId,
                                        data: {
                                            folder_id: targetBulkFolderId,
                                        },
                                        silent: true, // Suppress individual toasts for bulk operation
                                    })
                                )

                                toast.promise(Promise.allSettled(updates), {
                                    loading: `Moving ${selectedFeedIds.length} feeds...`,
                                    success: (results) => {
                                        const successfulCount = results.filter(
                                            (r) => r.status === "fulfilled"
                                        ).length
                                        const failedCount =
                                            results.length - successfulCount
                                        setIsBulkEditFolderModalOpen(false)
                                        setSelectedFeedIds([]) // Clear selection
                                        setTargetBulkFolderId(null) // Reset selection
                                        return `Moved ${successfulCount} feeds. ${failedCount > 0 ? `${failedCount} failed.` : ""}`
                                    },
                                    error: "An unexpected error occurred while moving feeds.",
                                })
                            }}
                            disabled={
                                !targetBulkFolderId ||
                                updateFeedMutation.status === "pending"
                            }
                        >
                            Move Feeds
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
                </div>
            </main>
        </div>
    )
}
