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
} from "@readspace/shared"
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
    image_url: z.string().url("Invalid URL").optional().or(z.literal("")),
    popularity_score: z.coerce.number().min(0).max(100).optional(),
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
        >
    >
    onClose: () => void
}

export function EditFeedForm({ feed, onClose }: EditFeedFormProps) {
    const form = useForm<FormValues>({
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
        },
    })

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
        const updates: Record<string, any> = {}

        // Only include changed fields
        if (values.title !== feed.title) updates.title = values.title
        if (values.description !== feed.description)
            updates.description = values.description
        if (values.language !== (feed.language || ""))
            updates.language = values.language || undefined
        if (values.top_level_category !== (feed.top_level_category || "")) {
            updates.top_level_category = values.top_level_category || undefined
        }
        if (values.url !== feed.url) updates.url = values.url
        if (values.link !== (feed.link || ""))
            updates.link = values.link || undefined
        if (values.image_url !== (feed.image_url || ""))
            updates.image_url = values.image_url || undefined
        if (values.popularity_score !== (feed.popularity_score || 0)) {
            updates.popularity_score = values.popularity_score
        }

        if (Object.keys(updates).length === 0) {
            onClose()
            return
        }

        updateFeed.mutate({ feedId: feed.id, data: updates })
    }

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
            >
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
                                            <SelectItem
                                                key={cat}
                                                value={cat}
                                            >
                                                {cat}
                                            </SelectItem>
                                        )
                                    )}
                                </SelectContent>
                            </Select>
                            {field.value && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        field.onChange("")
                                    }
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
                                Language code (ISO 639-1), max 50
                                characters
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
                                    placeholder="https://example.com/logo.png"
                                    type="url"
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
                                Popularity estimate (0-100) for feed
                                ranking
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={updateFeed.isPending}
                    >
                        {updateFeed.isPending
                            ? "Saving..."
                            : "Save Changes"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
