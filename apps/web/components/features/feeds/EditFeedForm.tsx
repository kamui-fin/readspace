import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import {
    FEED_CATEGORIES,
    type FeedDetail,
    type FeedSummary,
    useAdminUpdateFeed,
    useFeed,
} from "@readspace/shared"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

const formSchema = z.object({
    title: z.string().max(500).optional(),
    description: z.string().optional(),
    language: z.string().max(50).optional(),
    top_level_category: z.string().optional(),
    url: z.string().url("Invalid URL").optional(),
    link: z.string().url("Invalid URL").optional().or(z.literal("")),
    image_url: z.string().optional(),
    popularity_score: z.coerce.number().min(0).optional(),
    frontend_rank_override: z.coerce.number().int().min(1).max(9999).optional(),
})

type FormValues = z.infer<typeof formSchema>

interface EditFeedFormProps {
    feed: FeedSummary &
        Partial<
            Pick<
                FeedDetail,
                | "description"
                | "language"
                | "top_level_category"
                | "popularity_score"
                | "frontend_rank_override"
            >
        >
    onClose: () => void
}

function getCuratedRank(rank: number | null | undefined): number | undefined {
    return rank !== undefined && rank !== null && rank < 9999 ? rank : undefined
}

export function EditFeedForm({ feed, onClose }: EditFeedFormProps) {
    const { data: feedDetail } = useFeed(feed.id, {
        enabled: !!feed.id,
    })

    const initialRank = getCuratedRank(feed.frontend_rank_override)

    const form = useForm<FormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(formSchema as any),
        defaultValues: {
            title: feed.title || "",
            description: feed.description || "",
            language: feed.language || "",
            top_level_category: feed.top_level_category || "",
            url: feed.url || "",
            link: feed.link || "",
            image_url: feed.image_url || "",
            popularity_score: feed.popularity_score || 0,
            frontend_rank_override: initialRank,
        },
    })

    useEffect(() => {
        if (feedDetail && !form.formState.isDirty) {
            form.reset({
                title: feedDetail.title || "",
                description: feedDetail.description || "",
                language: feedDetail.language || "",
                top_level_category: feedDetail.top_level_category || "",
                url: feedDetail.url || "",
                link: feedDetail.link || "",
                image_url: feedDetail.image_url || "",
                popularity_score: feedDetail.popularity_score || 0,
                frontend_rank_override: getCuratedRank(
                    feedDetail.frontend_rank_override
                ),
            })
        }
    }, [feedDetail, form])

    const updateFeed = useAdminUpdateFeed({
        onSuccess: () => {
            toast.success("Feed updated successfully")
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

    const onSubmit = (values: FormValues) => {
        const updates: Record<string, string | number | undefined> = {}

        const currentFeed = feedDetail || feed
        const effectiveInitialRank = getCuratedRank(
            currentFeed.frontend_rank_override
        )

        // Only include changed fields
        if (values.title !== currentFeed.title) updates.title = values.title
        if (values.description !== currentFeed.description)
            updates.description = values.description
        if (values.language !== (currentFeed.language || ""))
            updates.language = values.language || undefined
        if (values.top_level_category !== (currentFeed.top_level_category || "")) {
            updates.top_level_category = values.top_level_category || undefined
        }
        if (values.url !== currentFeed.url) updates.url = values.url
        if (values.link !== (currentFeed.link || ""))
            updates.link = values.link || undefined
        if (values.image_url !== (currentFeed.image_url || ""))
            updates.image_url = values.image_url || undefined
        if (values.popularity_score !== (currentFeed.popularity_score || 0)) {
            updates.popularity_score = values.popularity_score
        }
        if (values.frontend_rank_override !== effectiveInitialRank) {
            updates.frontend_rank_override =
                values.frontend_rank_override !== undefined
                    ? values.frontend_rank_override
                    : 9999
        }

        if (Object.keys(updates).length === 0) {
            onClose()
            return
        }

        updateFeed.mutate({ feedId: feed.id, data: updates })
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Title */}
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Feed title"
                                    maxLength={500}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Description */}
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Feed description"
                                    className="min-h-[80px]"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Category */}
                <FormField
                    control={form.control}
                    name="top_level_category"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                value={field.value}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {Object.values(FEED_CATEGORIES).map(
                                        (cat) => (
                                            <SelectItem key={cat} value={cat}>
                                                {cat}
                                            </SelectItem>
                                        )
                                    )}
                                </SelectContent>
                            </Select>
                            {field.value && (
                                <button
                                    type="button"
                                    onClick={() => field.onChange("")}
                                    className="text-xs text-muted-foreground hover:text-foreground underline mt-1"
                                >
                                    Clear category
                                </button>
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Language */}
                <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Language</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="e.g., en, es, fr"
                                    maxLength={50}
                                    {...field}
                                />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                                Language code (ISO 639-1), max 50 characters
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Feed URL */}
                <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Feed URL (RSS/Atom)</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="https://example.com/feed.xml"
                                    type="url"
                                    {...field}
                                />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                                The actual RSS/Atom feed URL
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Website URL */}
                <FormField
                    control={form.control}
                    name="link"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Website URL</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="https://example.com"
                                    type="url"
                                    {...field}
                                />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                                The human-readable website URL
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Image URL */}
                <FormField
                    control={form.control}
                    name="image_url"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Image URL</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="/storage/v1/object/public/favicons/... or URL"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Popularity Score */}
                <FormField
                    control={form.control}
                    name="popularity_score"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Popularity Score</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="0.0"
                                    type="number"
                                    step="0.1"
                                    {...field}
                                />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                                Popularity score used for ranking (typically 0-1000)
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Curated Rank Override */}
                <FormField
                    control={form.control}
                    name="frontend_rank_override"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Curated Rank (Optional)</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Leave empty for default"
                                    type="number"
                                    min="1"
                                    max="9999"
                                    value={field.value ?? ""}
                                    onChange={(e) =>
                                        field.onChange(
                                            e.target.value
                                                ? Number(e.target.value)
                                                : undefined
                                        )
                                    }
                                />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                                For curated feeds: 1-50 (1 = highest priority).
                                Leave empty or use 9999 for default ranking
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={updateFeed.isPending}>
                        {updateFeed.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
