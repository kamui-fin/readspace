"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Globe, ExternalLink, Star, Tag, Search } from "lucide-react"
import Link from "next/link"

import Header from "@/components/navigation/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiClient } from "@/lib/api/client"

// Predefined categories - no need to fetch from backend
const CATEGORIES = [
    { name: "Technology & Programming", display_name: "Technology & Programming", feed_count: 0, avg_popularity: 0.0 },
    { name: "Artificial Intelligence", display_name: "Artificial Intelligence", feed_count: 0, avg_popularity: 0.0 },
    { name: "Design & Creativity", display_name: "Design & Creativity", feed_count: 0, avg_popularity: 0.0 },
    { name: "Business & Finance", display_name: "Business & Finance", feed_count: 0, avg_popularity: 0.0 },
    { name: "News & Politics", display_name: "News & Politics", feed_count: 0, avg_popularity: 0.0 },
    { name: "Gaming & Entertainment", display_name: "Gaming & Entertainment", feed_count: 0, avg_popularity: 0.0 },
    { name: "Science & Research", display_name: "Science & Research", feed_count: 0, avg_popularity: 0.0 },
    { name: "Lifestyle & Personal", display_name: "Lifestyle & Personal", feed_count: 0, avg_popularity: 0.0 },
    { name: "Culture & Arts", display_name: "Culture & Arts", feed_count: 0, avg_popularity: 0.0 },
    { name: "Security & Privacy", display_name: "Security & Privacy", feed_count: 0, avg_popularity: 0.0 },
    { name: "Education & Learning", display_name: "Education & Learning", feed_count: 0, avg_popularity: 0.0 },
    { name: "Miscellaneous", display_name: "Miscellaneous", feed_count: 0, avg_popularity: 0.0 },
]

interface CategoryPageClientProps {
    categoryName: string
    initialLanguage?: string
}

export default function CategoryPageClient({
    categoryName,
    initialLanguage = "en"
}: CategoryPageClientProps) {
    const router = useRouter()
    const [language, setLanguage] = useState(initialLanguage)

    // Get category feeds
    const { data: feedsData, isLoading: feedsLoading, error } = useQuery({
        queryKey: ['discover', 'category', categoryName, { language }],
        queryFn: () => ApiClient.rss.getCategoryFeeds(categoryName, { 
            language,
            limit: 20 
        }),
    })

    // Use predefined categories - no API call needed
    const categoriesData = { categories: CATEGORIES }

    const handleLanguageChange = (newLanguage: string) => {
        setLanguage(newLanguage)
        router.push(`/discover/category/${encodeURIComponent(categoryName)}?language=${newLanguage}`)
    }

    // Find current category info
    const currentCategory = categoriesData?.categories.find(cat => cat.name === categoryName)

    return (
        <div className="min-h-screen bg-background">
            <Header breadcrumbItems={[
                { label: "Discover", href: "/discover" },
                { label: categoryName }
            ]} />
            
            <div className="container mx-auto px-6 py-8 max-w-7xl">
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-4">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            asChild
                            className="gap-2"
                        >
                            <Link href="/discover">
                                <ArrowLeft className="h-4 w-4" />
                                Back to Discover
                            </Link>
                        </Button>
                        
                        <div className="flex-1" />
                        
                        <Select value={language} onValueChange={handleLanguageChange}>
                            <SelectTrigger className="w-32">
                                <Globe className="h-4 w-4 mr-2" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="zh">中文</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="flex items-center gap-3 mb-2">
                        <Tag className="h-6 w-6 text-primary" />
                        <h1 className="text-3xl font-bold text-foreground">
                            {categoryName}
                        </h1>
                    </div>
                    
                    <p className="text-muted-foreground text-lg">
                        {currentCategory ? (
                            <>Explore {currentCategory.feed_count} RSS feeds in this category</>
                        ) : (
                            <>Discover RSS feeds in the {categoryName} category</>
                        )}
                    </p>
                </div>

                {/* Content Section */}
                <div>
                    {error ? (
                        <Card className="p-8 text-center">
                            <div className="text-muted-foreground">
                                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <h3 className="text-lg font-medium mb-2">Error loading feeds</h3>
                                <p>We couldn't load feeds for this category. Please try again later.</p>
                            </div>
                        </Card>
                    ) : feedsLoading ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-6 w-48" />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Card key={i}>
                                        <CardHeader>
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-3 w-1/2" />
                                        </CardHeader>
                                        <CardContent>
                                            <Skeleton className="h-3 w-full mb-2" />
                                            <Skeleton className="h-3 w-2/3" />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ) : feedsData?.results.length === 0 ? (
                        <Card className="p-8 text-center">
                            <div className="text-muted-foreground">
                                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <h3 className="text-lg font-medium mb-2">No feeds found</h3>
                                <p>There are no feeds available in this category for the selected language.</p>
                                <Button 
                                    variant="outline" 
                                    className="mt-4"
                                    asChild
                                >
                                    <Link href="/discover">
                                        Browse other categories
                                    </Link>
                                </Button>
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold">
                                    Top Feeds 
                                    <span className="text-muted-foreground font-normal">
                                        ({feedsData?.total_count} available)
                                    </span>
                                </h2>
                            </div>
                            
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {feedsData?.results.map((feed) => (
                                    <FeedCard key={feed.id} feed={feed} showRank />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Related Categories */}
                {categoriesData?.categories && categoriesData.categories.length > 1 && (
                    <div className="mt-12">
                        <h3 className="text-lg font-semibold mb-4">Explore Other Categories</h3>
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {categoriesData.categories
                                .filter(cat => cat.name !== categoryName)
                                .slice(0, 8)
                                .map((category) => (
                                    <Card 
                                        key={category.name} 
                                        className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/50 p-4"
                                        onClick={() => router.push(`/discover/category/${encodeURIComponent(category.name)}?language=${language}`)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Tag className="h-4 w-4" />
                                            <span className="font-medium text-sm">{category.display_name}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {category.feed_count} feeds
                                        </p>
                                    </Card>
                                ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function FeedCard({ feed, showRank }: { feed: any; showRank?: boolean }) {
    const truncateText = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text
        return text.substring(0, maxLength) + "..."
    }

    return (
        <Card className="h-full hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">
                        {feed.title || "Untitled Feed"}
                    </CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                        {showRank && feed.search_metadata?.rank && (
                            <Badge variant="outline" className="text-xs">
                                #{feed.search_metadata.rank}
                            </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                            {Math.round(feed.relevance * 100)}%
                        </Badge>
                    </div>
                </div>
                
                {feed.category && (
                    <Badge variant="outline" className="w-fit text-xs">
                        {feed.category}
                    </Badge>
                )}
            </CardHeader>
            
            <CardContent className="space-y-3">
                {feed.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {truncateText(feed.description, 120)}
                    </p>
                )}
                
                {feed.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {feed.tags.slice(0, 3).map((tag: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                                {tag}
                            </Badge>
                        ))}
                        {feed.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                                +{feed.tags.length - 3}
                            </Badge>
                        )}
                    </div>
                )}
                
                <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 fill-current text-yellow-500" />
                        {feed.popularity_score.toFixed(1)}
                    </div>
                    
                    <Button 
                        variant="ghost" 
                        size="sm"
                        asChild
                        className="h-8 px-2"
                    >
                        <a 
                            href={feed.link || feed.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1"
                        >
                            <ExternalLink className="h-3 w-3" />
                            <span className="text-xs">Visit</span>
                        </a>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}