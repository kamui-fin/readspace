"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ApiClient,
    FEED_CATEGORIES,
    type FeedSummary,
    type FeedDetail,
} from "@readspace/shared"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

interface EditFeedDialogProps {
    feed: FeedSummary &
        Partial<
            Pick<
                FeedDetail,
                | "description"
                | "language"
                | "top_level_category"
                | "popularity_score"
            >
        >
    isOpen: boolean
    onClose: () => void
}

export function EditFeedDialog({ feed, isOpen, onClose }: EditFeedDialogProps) {
    const [title, setTitle] = useState(feed.title || "")
    const [description, setDescription] = useState(feed.description || "")
    const [language, setLanguage] = useState(feed.language || "")
    const [category, setCategory] = useState(feed.top_level_category || "")
    const [url, setUrl] = useState(feed.url)
    const [link, setLink] = useState(feed.link || "")
    const [imageUrl, setImageUrl] = useState(feed.image_url || "")
    const [popularityScore, setPopularityScore] = useState(
        feed.popularity_score || 0
    )

    const queryClient = useQueryClient()

    const updateFeed = useMutation({
        mutationFn: (updates: {
            title?: string
            description?: string
            language?: string
            top_level_category?: string
            url?: string
            link?: string
            image_url?: string
            popularity_score?: number
        }) => ApiClient.adminUpdateFeed(feed.id, updates),
        onSuccess: () => {
            toast.success("Feed updated successfully")
            // Invalidate feed queries to refetch the updated data
            queryClient.invalidateQueries({ queryKey: ["feeds"] })
            onClose()
        },
        onError: (error: unknown) => {
            const errorMessage =
                (
                    error as {
                        response?: { data?: { detail?: string } }
                    }
                )?.response?.data?.detail || "Failed to update feed"
            toast.error(errorMessage)
        },
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        const updates: {
            title?: string
            description?: string
            language?: string
            top_level_category?: string
            url?: string
            link?: string
            image_url?: string
            popularity_score?: number
        } = {}

        // Only include changed fields
        if (title !== feed.title) updates.title = title
        if (description !== feed.description) updates.description = description
        if (language !== (feed.language || ""))
            updates.language = language || undefined
        if (category !== (feed.top_level_category || "")) {
            updates.top_level_category = category || undefined
        }
        if (url !== feed.url) updates.url = url
        if (link !== (feed.link || "")) updates.link = link || undefined
        if (imageUrl !== (feed.image_url || ""))
            updates.image_url = imageUrl || undefined
        if (popularityScore !== (feed.popularity_score || 0)) {
            updates.popularity_score = popularityScore
        }

        updateFeed.mutate(updates)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Feed</DialogTitle>
                    <DialogDescription>
                        Update feed properties. These changes will affect the
                        global feed for all users.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Feed title"
                            maxLength={500}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Feed description"
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-2xs transition-[color,box-shadow] outline-hidden placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
                            rows={3}
                        />
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger id="category">
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.values(FEED_CATEGORIES).map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {category && (
                            <button
                                type="button"
                                onClick={() => setCategory("")}
                                className="text-xs text-muted-foreground hover:text-foreground underline"
                            >
                                Clear category
                            </button>
                        )}
                    </div>

                    {/* Language */}
                    <div className="space-y-2">
                        <Label htmlFor="language">Language</Label>
                        <Input
                            id="language"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            placeholder="e.g., en, es, fr"
                            maxLength={50}
                        />
                        <p className="text-xs text-muted-foreground">
                            Language code (ISO 639-1), max 50 characters
                        </p>
                    </div>

                    {/* Feed URL */}
                    <div className="space-y-2">
                        <Label htmlFor="url">Feed URL (RSS/Atom)</Label>
                        <Input
                            id="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com/feed.xml"
                            type="url"
                        />
                        <p className="text-xs text-muted-foreground">
                            The actual RSS/Atom feed URL
                        </p>
                    </div>

                    {/* Website URL */}
                    <div className="space-y-2">
                        <Label htmlFor="link">Website URL</Label>
                        <Input
                            id="link"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            placeholder="https://example.com"
                            type="url"
                        />
                        <p className="text-xs text-muted-foreground">
                            The human-readable website URL
                        </p>
                    </div>

                    {/* Image URL */}
                    <div className="space-y-2">
                        <Label htmlFor="imageUrl">Image URL</Label>
                        <Input
                            id="imageUrl"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://example.com/logo.png"
                            type="url"
                        />
                    </div>

                    {/* Popularity Score */}
                    <div className="space-y-2">
                        <Label htmlFor="popularityScore">
                            Popularity Score
                        </Label>
                        <Input
                            id="popularityScore"
                            value={popularityScore}
                            onChange={(e) =>
                                setPopularityScore(
                                    parseFloat(e.target.value) || 0
                                )
                            }
                            placeholder="0.0"
                            type="number"
                        />
                        <p className="text-xs text-muted-foreground">
                            Popularity estimate (0-100) for feed ranking
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={updateFeed.isPending}>
                            {updateFeed.isPending
                                ? "Saving..."
                                : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
