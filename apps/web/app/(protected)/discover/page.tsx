import "@/lib/api-client"
import DiscoverView from "@/components/features/discover/DiscoverView"

export const metadata = {
    title: "Discover Feeds | Readspace",
    description: "Discover and explore RSS feeds across different categories",
}

export default function DiscoverPage() {
    return <DiscoverView />
}
