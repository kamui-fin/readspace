"use client"

import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { Search, X } from "lucide-react"
import NextImage from "next/image"
import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"

import { FeedCard } from "@/components/feeds/FeedCard"
import { FeedCardSkeleton } from "@/components/feeds/FeedCardSkeleton"
import { FeedPreviewCard } from "@/components/feeds/FeedPreviewCard"
import { Button } from "@/components/ui/button"
import { CategoryBadge } from "@/components/ui/category-badge"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { SidebarLeftTrigger, useSidebarLeft } from "@/components/ui/sidebar"
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile"
import { ApiClient } from "@/lib/api/client"

function usePersistentState(key: string, initialValue: any) {
    const [state, setState] = useState(() => {
        if (typeof window === "undefined") return initialValue
        try {
            const storedValue = localStorage.getItem(key)
            return storedValue ? JSON.parse(storedValue) : initialValue
        } catch (error) {
            console.error("Error retrieving from localStorage:", error)
            return initialValue
        }
    })

    useEffect(() => {
        if (typeof window === "undefined") return
        try {
            localStorage.setItem(key, JSON.stringify(state))
        } catch (error) {
            console.error("Error saving to localStorage:", error)
        }
    }, [key, state])

    return [state, setState]
}

interface DiscoverPageClientProps {
    initialQuery?: string
    initialCategory?: string
}

interface DiscoverLayoutProps {
    children: React.ReactNode
}

function DiscoverLayout({ children }: DiscoverLayoutProps) {
    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-1 px-4 py-4 md:px-6 md:py-6">{children}</main>
        </div>
    )
}


export default function DiscoverPageClient({
    initialQuery,
    initialCategory,
}: DiscoverPageClientProps) {
    const [searchQuery, setSearchQuery] = useState(initialQuery || "")
    const [activeQuery, setActiveQuery] = useState(initialQuery || "")
    const [activeCategory, setActiveCategory] = useState(initialCategory || "")
    const [language, setLanguage] = usePersistentState("discover-language", "en")

    // Sidebar state for tablet mode
    const isTablet = useIsTablet()
    const isMobile = useIsMobile()
    const { state: sidebarState } = useSidebarLeft()

    // Shorter category names for mobile
    const getMobileCategoryName = (category: string) => {
        const mobileNames: Record<string, string> = {
            "Technology & Programming": "Tech & Code",
            "Artificial Intelligence": "AI",
            "Design & Creativity": "Design",
            "Business & Finance": "Business",
            "News & Politics": "News",
            "Gaming & Entertainment": "Gaming",
            "Science & Research": "Science",
            "Lifestyle & Personal": "Lifestyle",
            "Culture & Arts": "Culture",
            "Security & Privacy": "Security",
            "Education & Learning": "Education",
            "Miscellaneous": "Other",
        }
        return isMobile ? (mobileNames[category] || category) : category
    }


    const hasSearchParams = Boolean(activeQuery || activeCategory)

    const getPageTitle = () => {
        if (activeCategory) {
            return getMobileCategoryName(activeCategory)
        }
        return "Discover Feeds"
    }

    // Get search results - only when we have active search
    const {
        data: searchData,
        isLoading,
        isFetching,
        error: searchError,
    } = useQuery({
        queryKey: [
            "discover",
            "search",
            { q: activeQuery, category: activeCategory, language },
        ],
        queryFn: async () => {
            try {
                return await ApiClient.rss.searchFeeds({
                    q: activeQuery,
                    category: activeCategory,
                    language,
                    limit: 50,
                })
            } catch (error) {
                toast.error("Failed to search feeds. Please try again.")
                throw error
            }
        },
        enabled: hasSearchParams,
        retry: (failureCount, error) => {
            // Only retry on network errors, not API errors
            return failureCount < 2 && !error?.message?.includes("400")
        }
    })

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (!searchQuery.trim()) {
            // Clear search and go back to categories
            setActiveQuery("")
            setActiveCategory("")
            return
        }

        // Set active query to trigger search
        setActiveQuery(searchQuery)
        setActiveCategory("")
    }

    const handleSearchInputChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = e.target.value
        setSearchQuery(value)

        // If input becomes empty, automatically reset to categories
        if (!value.trim()) {
            setActiveQuery("")
            setActiveCategory("")
        }
    }

    const handleCategoryClick = (categoryName: string) => {
        // Set active category to trigger search
        setActiveCategory(categoryName)
        setActiveQuery("")
        setSearchQuery("")
    }

    const handleLanguageChange = (newLanguage: string) => {
        setLanguage(newLanguage)
        // Language change will automatically trigger a new search due to the query key dependency
        // Persistence is handled automatically by usePersistentState
    }

    const clearSearch = () => {
        setSearchQuery("")
        setActiveQuery("")
        setActiveCategory("")
    }

    return (
        <DiscoverLayout>
            <div className="max-w-full md:max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col items-start md:items-center mb-8 md:mb-12">
                    <div className="mb-4 hidden md:block">
                        <svg
                            width="128"
                            height="128"
                            viewBox="0 0 64 64"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="[&_g]:dark:!filter-none dark:[&_circle[fill='#FCFFFC']]:fill-card dark:[&_circle[stroke='#F5FAF6']]:stroke-border"
                        >
                            <g filter="url(#filter0_d_18_362)">
                                <circle cx="32" cy="25" r="23" fill="#FCFFFC" />
                                <circle
                                    cx="32"
                                    cy="25"
                                    r="22"
                                    stroke="#F5FAF6"
                                    strokeWidth="2"
                                />
                            </g>
                            <g filter="url(#filter1_d_18_362)">
                                <circle cx="32" cy="25" r="19" fill="#FCFFFC" />
                                <circle
                                    cx="32"
                                    cy="25"
                                    r="18"
                                    stroke="#F5FAF6"
                                    strokeWidth="2"
                                />
                            </g>
                            <path
                                d="M27.5 23.875C28.9918 23.875 30.4226 24.4676 31.4775 25.5225C32.5324 26.5774 33.125 28.0082 33.125 29.5"
                                stroke="#6A994E"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M27.5 19.5C30.1522 19.5 32.6957 20.5536 34.5711 22.4289C36.4464 24.3043 37.5 26.8478 37.5 29.5"
                                stroke="#6A994E"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M28.125 29.5C28.4702 29.5 28.75 29.2202 28.75 28.875C28.75 28.5298 28.4702 28.25 28.125 28.25C27.7798 28.25 27.5 28.5298 27.5 28.875C27.5 29.2202 27.7798 29.5 28.125 29.5Z"
                                stroke="#6A994E"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <defs>
                                <filter
                                    id="filter0_d_18_362"
                                    x="0"
                                    y="0"
                                    width="64"
                                    height="64"
                                    filterUnits="userSpaceOnUse"
                                    colorInterpolationFilters="sRGB"
                                >
                                    <feFlood
                                        floodOpacity="0"
                                        result="BackgroundImageFix"
                                    />
                                    <feColorMatrix
                                        in="SourceAlpha"
                                        type="matrix"
                                        values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                                        result="hardAlpha"
                                    />
                                    <feOffset dy="7" />
                                    <feGaussianBlur stdDeviation="4.5" />
                                    <feComposite
                                        in2="hardAlpha"
                                        operator="out"
                                    />
                                    <feColorMatrix
                                        type="matrix"
                                        values="0 0 0 0 0.960784 0 0 0 0 0.980392 0 0 0 0 0.964706 0 0 0 1 0"
                                    />
                                    <feBlend
                                        mode="normal"
                                        in2="BackgroundImageFix"
                                        result="effect1_dropShadow_18_362"
                                    />
                                    <feBlend
                                        mode="normal"
                                        in="SourceGraphic"
                                        in2="effect1_dropShadow_18_362"
                                        result="shape"
                                    />
                                </filter>
                                <filter
                                    id="filter1_d_18_362"
                                    x="4"
                                    y="4"
                                    width="56"
                                    height="56"
                                    filterUnits="userSpaceOnUse"
                                    colorInterpolationFilters="sRGB"
                                >
                                    <feFlood
                                        floodOpacity="0"
                                        result="BackgroundImageFix"
                                    />
                                    <feColorMatrix
                                        in="SourceAlpha"
                                        type="matrix"
                                        values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                                        result="hardAlpha"
                                    />
                                    <feOffset dy="7" />
                                    <feGaussianBlur stdDeviation="4.5" />
                                    <feComposite
                                        in2="hardAlpha"
                                        operator="out"
                                    />
                                    <feColorMatrix
                                        type="matrix"
                                        values="0 0 0 0 0.960784 0 0 0 0 0.980392 0 0 0 0 0.964706 0 0 0 1 0"
                                    />
                                    <feBlend
                                        mode="normal"
                                        in2="BackgroundImageFix"
                                        result="effect1_dropShadow_18_362"
                                    />
                                    <feBlend
                                        mode="normal"
                                        in="SourceGraphic"
                                        in2="effect1_dropShadow_18_362"
                                        result="shape"
                                    />
                                </filter>
                            </defs>
                        </svg>
                    </div>
                    {/* Mobile: Sidebar Toggle, Title and Language Selector */}
                    <div className="flex md:hidden items-center w-full max-w-2xl mb-6 gap-3">
                        {sidebarState === "collapsed" && (
                            <SidebarLeftTrigger />
                        )}

                        <h1 className="text-3xl font-semibold text-black dark:text-foreground min-h-[2.5rem] flex items-center truncate break-words flex-1">
                            {getPageTitle()}
                        </h1>

                        <Select
                            value={language}
                            onValueChange={handleLanguageChange}
                        >
                            <SelectTrigger
                                className="bg-[#F3F9EF] dark:bg-input border-0 h-8 w-16 text-sm text-[#91998C] dark:text-muted-foreground flex-shrink-0"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="en">eng</SelectItem>
                                <SelectItem value="zh">中文</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Desktop: Title centered */}
                    <h1 className="hidden md:flex text-5xl font-semibold text-black dark:text-foreground mb-10 min-h-[3.5rem] items-center justify-center max-w-2xl truncate break-words">
                        {getPageTitle()}
                    </h1>

                    {/* Search Section */}
                    <form
                        onSubmit={handleSearch}
                        className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 w-full max-w-2xl min-w-0"
                    >
                        <div className="relative flex-1 min-w-0">
                            <Input
                                type="text"
                                placeholder={
                                    searchQuery
                                        ? ""
                                        : "Search feeds..."
                                }
                                value={searchQuery}
                                onChange={handleSearchInputChange}
                                className={`pl-6 pr-12 border-0 h-12 md:h-14 text-base md:text-lg w-full ${searchQuery
                                    ? "bg-[#F3F9EF] dark:bg-input placeholder:text-[#91998C] dark:placeholder:text-muted-foreground"
                                    : "bg-[#F3F9EF] dark:bg-input placeholder:text-[#D8E5D0] dark:placeholder:text-muted-foreground/60"
                                    }`}
                                style={{
                                    color: searchQuery ? "#91998C" : "#D8E5D0",
                                }}
                            />
                            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#91998C] dark:text-muted-foreground" />
                        </div>

                        <div className="hidden md:block">
                            <Select
                                value={language}
                                onValueChange={handleLanguageChange}
                            >
                                <SelectTrigger
                                    className="bg-[#F3F9EF] dark:bg-input border-0 h-14 w-24 text-lg text-[#91998C] dark:text-muted-foreground flex-shrink-0"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en">eng</SelectItem>
                                    <SelectItem value="zh">中文</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </form>
                </div>

                {/* Content Section */}
                <AnimatePresence mode="wait">
                    {hasSearchParams ? (
                        /* Search Results */
                        <motion.div
                            key="search-results"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                            {/* Results Count and Clear Button */}
                            {searchData && (
                                <motion.div
                                    className="flex items-center justify-between mb-6"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    <div className="text-[#91998C] dark:text-muted-foreground text-sm font-medium">
                                        {searchData.total_count} results
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearSearch}
                                        className="h-6 w-6 p-0 text-[#91998C] hover:text-[#6A994E] hover:bg-[#F3F9EF] dark:text-muted-foreground dark:hover:text-primary dark:hover:bg-accent"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </motion.div>
                            )}
                            {isFetching ? (
                                <div className="space-y-4">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <FeedCardSkeleton key={i} />
                                    ))}
                                </div>
                            ) : searchError || searchData?.results.length === 0 ? (
                                <motion.div
                                    className="flex flex-col items-center justify-center py-16"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{
                                        duration: 0.4,
                                        ease: "easeOut",
                                    }}
                                >
                                    <div className="mb-6">
                                        <NextImage
                                            src="/discover/Search.svg"
                                            alt="No results found"
                                            width={132}
                                            height={128}
                                            className="w-32 h-auto"
                                        />
                                    </div>
                                    <h3 className="text-xl font-medium mb-3 text-black dark:text-foreground">
                                        {searchError ? "Search failed" : "No matching feeds found"}
                                    </h3>
                                    <p className="text-gray-500 dark:text-muted-foreground text-center max-w-md">
                                        {searchError ? "Please try again later." : "Try rephrasing your query."}
                                    </p>
                                </motion.div>
                            ) : (
                                <motion.div
                                    className="space-y-4"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {searchData?.results.map(
                                        (feed: any, index: number) => (
                                            <motion.div
                                                key={feed.id}
                                                initial={{ opacity: 0, y: 30 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{
                                                    duration: 0.4,
                                                    delay: index * 0.1,
                                                    ease: "easeOut",
                                                }}
                                            >
                                                {feed.is_preview ? (
                                                    <FeedPreviewCard
                                                        feed={feed}
                                                    />
                                                ) : (
                                                    <FeedCard feed={feed} />
                                                )}
                                            </motion.div>
                                        )
                                    )}
                                </motion.div>
                            )}
                        </motion.div>
                    ) : (
                        /* Categories */
                        <motion.div
                            key="categories"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                            <div className="grid grid-cols-2 gap-2 justify-center mb-8 md:flex md:flex-wrap md:gap-3 md:justify-center">
                                {[
                                    "Technology & Programming",
                                    "Artificial Intelligence",
                                    "Design & Creativity",
                                    "Business & Finance",
                                    "News & Politics",
                                    "Gaming & Entertainment",
                                    "Science & Research",
                                    "Lifestyle & Personal",
                                    "Culture & Arts",
                                    "Security & Privacy",
                                    "Education & Learning",
                                    "Miscellaneous",
                                ].map((category, index) => (
                                    <motion.div
                                        key={category}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{
                                            duration: 0.3,
                                            delay: index * 0.05,
                                            ease: "easeOut",
                                        }}
                                    >
                                        <CategoryBadge
                                            category={getMobileCategoryName(category)}
                                            iconKey={category}
                                            onClick={() =>
                                                handleCategoryClick(category)
                                            }
                                            className={isMobile ? "rounded-lg h-14 w-full text-xs justify-center px-2 py-3 flex-col gap-1" : ""}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </DiscoverLayout>
    )
}
