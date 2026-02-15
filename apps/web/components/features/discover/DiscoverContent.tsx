import { Sparkles } from "lucide-react"
import NextImage from "next/image"
import { Configure } from "react-instantsearch"

import { CategoryGrid } from "./CategoryGrid"
import { CustomSearchBox } from "./CustomSearchBox"
import { DiscoverLayout } from "./DiscoverLayout"
import { SearchResults } from "./SearchResults"
import { useDiscoverController } from "@/components/features/discover/hooks/use-discover-controller"
import { CATEGORY_CONFIG } from "@/lib/categories"
import { FeedCategory } from "@readspace/shared"

interface DiscoverContentProps {
    /** Initial language preference (not currently used) */
    initialLanguage?: string
    /** Callback when AI search is toggled */
    onAiSettingsChange?: (enabled: boolean) => void
}

/**
 * Main discover content component with InstantSearch integration.
 *
 * Manages search state, category filtering, language filtering, and AI search toggle.
 * Uses InstantSearch hooks for all search functionality.
 */
export function DiscoverContent({ onAiSettingsChange }: DiscoverContentProps) {
    const {
        query,
        activeCategory,
        hasActiveSearch,
        isUrlQuery,
        previewFeed,
        isPreviewLoading,
        previewError,
        isPreviewError,
        displayLanguage,
        isAiEnabled,
        handleCategoryClick,
        handleLanguageChange,
        handleAiToggle,
        clearSearch,
    } = useDiscoverController({ onAiSettingsChange })

    return (
        <>
            {/* Configure search parameters */}
            <Configure
                hitsPerPage={20}
                attributesToHighlight={["title", "description"]}
            />

            <DiscoverLayout centerVertically={!hasActiveSearch}>
                <div className="max-w-full md:max-w-4xl mx-auto w-full pb-24">
                    {/* Header */}
                    <div className="flex flex-col items-center">
                        {hasActiveSearch ? (
                            <h1 className="pt-4 mb-6 text-2xl md:text-4xl font-semibold text-foreground dark:text-foreground tracking-tight">
                                {activeCategory
                                    ? CATEGORY_CONFIG[
                                          activeCategory as FeedCategory
                                      ]?.name || activeCategory
                                    : "Search Feeds"}
                            </h1>
                        ) : (
                            <div className="flex items-center gap-4 mb-8 md:mb-12">
                                <NextImage
                                    src="/readspace.svg"
                                    alt="readspace"
                                    width={64}
                                    height={64}
                                    className="w-12 h-12 md:w-16 md:h-16 rounded"
                                />
                                <h1
                                    className="text-3xl md:text-5xl font-semibold text-foreground dark:text-foreground tracking-tight"
                                    style={{
                                        fontFamily: "Figtree, sans-serif",
                                    }}
                                >
                                    readspace
                                </h1>
                            </div>
                        )}
                    </div>

                    {/* Search Section */}
                    <div className="w-full max-w-2xl mx-auto mb-8">
                        <CustomSearchBox
                            placeholder="Search for a website or paste RSS link"
                            language={displayLanguage}
                            onLanguageChange={handleLanguageChange}
                            aiEnabled={isAiEnabled}
                            onAiToggle={handleAiToggle}
                        />
                        {isAiEnabled && query && (
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-[#6A994E] dark:text-primary">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>AI-powered search active</span>
                            </div>
                        )}
                    </div>

                    {/* Content Section */}
                    {isUrlQuery ? (
                        /* Show preview when URL is detected */
                        <SearchResults
                            onClearSearch={clearSearch}
                            previewFeed={previewFeed}
                            isPreviewLoading={isPreviewLoading}
                            previewError={previewError}
                            isPreviewError={isPreviewError}
                        />
                    ) : hasActiveSearch ? (
                        /* Show search results for regular queries */
                        <SearchResults onClearSearch={clearSearch} />
                    ) : (
                        /* Show category grid when no search */
                        <CategoryGrid onCategoryClick={handleCategoryClick} />
                    )}
                </div>
            </DiscoverLayout>
        </>
    )
}
