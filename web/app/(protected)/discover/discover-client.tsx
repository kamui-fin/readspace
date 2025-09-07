"use client"

import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { Search, X } from "lucide-react"
import NextImage from "next/image"
import { useState } from "react"

import { FeedCard } from "@/components/feeds/FeedCard"
import { FeedCardSkeleton } from "@/components/feeds/FeedCardSkeleton"
import Header from "@/components/navigation/header"
import { Button } from "@/components/ui/button"
import { CategoryBadge } from "@/components/ui/category-badge"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
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

interface DiscoverPageClientProps { }

export default function DiscoverPageClient() {
    const [searchQuery, setSearchQuery] = useState("")
    const [activeQuery, setActiveQuery] = useState("")
    const [activeCategory, setActiveCategory] = useState("")
    const [language, setLanguage] = useState("en")

    const hasSearchParams = Boolean(activeQuery || activeCategory)

    const getPageTitle = () => {
        if (activeCategory) {
            return activeCategory
        }
        return "Discover Feeds"
    }

    // Get search results - only when we have active search
    const { data: searchData, isLoading, isFetching } = useQuery({
        queryKey: ['discover', 'search', { q: activeQuery, category: activeCategory, language }],
        queryFn: () => ApiClient.rss.searchFeeds({
            q: activeQuery,
            category: activeCategory,
            language,
            limit: 20
        }),
        enabled: hasSearchParams,
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

    const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    }

    const clearSearch = () => {
        setSearchQuery("")
        setActiveQuery("")
        setActiveCategory("")
    }

    return (
        <div className="min-h-screen bg-white">
            <Header breadcrumbItems={[
                { label: "Discover", href: "/discover" }
            ]} />

            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex flex-col items-center mb-12">
                    <div className="mb-4">
                        <svg width="128" height="128" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g filter="url(#filter0_d_18_362)">
                                <circle cx="32" cy="25" r="23" fill="#FCFFFC" />
                                <circle cx="32" cy="25" r="22" stroke="#F5FAF6" strokeWidth="2" />
                            </g>
                            <g filter="url(#filter1_d_18_362)">
                                <circle cx="32" cy="25" r="19" fill="#FCFFFC" />
                                <circle cx="32" cy="25" r="18" stroke="#F5FAF6" strokeWidth="2" />
                            </g>
                            <path d="M27.5 23.875C28.9918 23.875 30.4226 24.4676 31.4775 25.5225C32.5324 26.5774 33.125 28.0082 33.125 29.5" stroke="#6A994E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M27.5 19.5C30.1522 19.5 32.6957 20.5536 34.5711 22.4289C36.4464 24.3043 37.5 26.8478 37.5 29.5" stroke="#6A994E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M28.125 29.5C28.4702 29.5 28.75 29.2202 28.75 28.875C28.75 28.5298 28.4702 28.25 28.125 28.25C27.7798 28.25 27.5 28.5298 27.5 28.875C27.5 29.2202 27.7798 29.5 28.125 29.5Z" stroke="#6A994E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <defs>
                                <filter id="filter0_d_18_362" x="0" y="0" width="64" height="64" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                                    <feOffset dy="7" />
                                    <feGaussianBlur stdDeviation="4.5" />
                                    <feComposite in2="hardAlpha" operator="out" />
                                    <feColorMatrix type="matrix" values="0 0 0 0 0.960784 0 0 0 0 0.980392 0 0 0 0 0.964706 0 0 0 1 0" />
                                    <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_18_362" />
                                    <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_18_362" result="shape" />
                                </filter>
                                <filter id="filter1_d_18_362" x="4" y="4" width="56" height="56" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                                    <feOffset dy="7" />
                                    <feGaussianBlur stdDeviation="4.5" />
                                    <feComposite in2="hardAlpha" operator="out" />
                                    <feColorMatrix type="matrix" values="0 0 0 0 0.960784 0 0 0 0 0.980392 0 0 0 0 0.964706 0 0 0 1 0" />
                                    <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_18_362" />
                                    <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_18_362" result="shape" />
                                </filter>
                            </defs>
                        </svg>
                    </div>
                    <h1 className="text-5xl font-semibold text-black mb-10 min-h-[3.5rem] flex items-center justify-center max-w-2xl">
                        {getPageTitle()}
                    </h1>

                    {/* Search Section */}
                    <form onSubmit={handleSearch} className="flex items-center gap-3 w-full max-w-2xl">
                        <div className="relative flex-1">
                            <Input
                                type="text"
                                placeholder={searchQuery ? "" : "cooking recipes, ai news, startups"}
                                value={searchQuery}
                                onChange={handleSearchInputChange}
                                className={`pl-6 pr-12 border-0 h-14 text-lg ${searchQuery
                                    ? 'bg-[#F3F9EF] placeholder:text-[#91998C]'
                                    : 'bg-[#F3F9EF] placeholder:text-[#D8E5D0]'
                                    }`}
                                style={{ color: searchQuery ? '#91998C' : '#D8E5D0' }}
                            />
                            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#91998C]" />
                        </div>

                        <Select value={language} onValueChange={handleLanguageChange}>
                            <SelectTrigger className="bg-[#F3F9EF] border-0 h-14 w-24 text-lg" style={{ color: '#91998C' }}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="en">EN</SelectItem>
                                <SelectItem value="zh">中文</SelectItem>
                            </SelectContent>
                        </Select>
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
                                    <div className="text-[#91998C] text-sm font-medium">
                                        {searchData.total_count} results
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearSearch}
                                        className="h-6 w-6 p-0 text-[#91998C] hover:text-[#6A994E] hover:bg-[#F3F9EF]"
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
                            ) : searchData?.results.length === 0 ? (
                                <motion.div
                                    className="flex flex-col items-center justify-center py-16"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
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
                                    <h3 className="text-xl font-medium mb-3 text-black">No matching feeds found</h3>
                                    <p className="text-gray-500 text-center max-w-md">Try rephrasing your query.</p>
                                </motion.div>
                            ) : (
                                <motion.div
                                    className="space-y-4"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {searchData?.results.map((feed: any, index: number) => (
                                        <motion.div
                                            key={feed.id}
                                            initial={{ opacity: 0, y: 30 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{
                                                duration: 0.4,
                                                delay: index * 0.1,
                                                ease: "easeOut"
                                            }}
                                        >
                                            <FeedCard feed={feed} />
                                        </motion.div>
                                    ))}
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
                            <div className="flex flex-wrap gap-3 justify-center mb-8">
                                {["Technology & Programming", "Artificial Intelligence", "Design & Creativity", "Business & Finance", "News & Politics", "Gaming & Entertainment", "Science & Research", "Lifestyle & Personal", "Culture & Arts", "Security & Privacy", "Education & Learning", "Miscellaneous"].map((category, index) => (
                                    <motion.div
                                        key={category}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{
                                            duration: 0.3,
                                            delay: index * 0.05,
                                            ease: "easeOut"
                                        }}
                                    >
                                        <CategoryBadge
                                            category={category}
                                            onClick={() => handleCategoryClick(category)}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

