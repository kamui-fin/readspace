import NextImage from "next/image"
import { Configure } from "react-instantsearch"

import { CategoryGrid } from "./CategoryGrid"
import { CustomSearchBox } from "./CustomSearchBox"
import { DiscoverLayout } from "./DiscoverLayout"
import { SearchResults } from "./SearchResults"
import { NewsletterSection } from "./NewsletterSection"
import { useDiscoverController } from "@/components/features/discover/hooks/use-discover-controller"
import { CATEGORY_CONFIG } from "@/lib/categories"
import { FeedCategory } from "@readspace/shared"

/**
 * Main discover content component with InstantSearch integration.
 *
 * Manages search state, category filtering, and language filtering.
 * Uses InstantSearch hooks for all search functionality.
 */
export function DiscoverContent() {
    const {
        activeCategory,
        hasActiveSearch,
        isUrlQuery,
        previewFeed,
        isPreviewLoading,
        previewError,
        isPreviewError,
        displayLanguage,
        languageFilter,
        handleCategoryClick,
        handleLanguageChange,
        clearSearch,
    } = useDiscoverController()

    return (
        <>
            {/* Configure search parameters. `filters` applies the language
                preference as a raw Meilisearch filter (defaults to English). */}
            <Configure
                hitsPerPage={20}
                attributesToHighlight={["title", "description"]}
                filters={languageFilter}
            />

            <DiscoverLayout centerVertically={!hasActiveSearch}>
                <div
                    className={`max-w-full md:max-w-4xl mx-auto w-full ${hasActiveSearch ? "pb-24" : "pb-0"}`}
                >
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
                        />
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
                        <div className="space-y-6 flex flex-col items-center">
                            <CategoryGrid
                                onCategoryClick={handleCategoryClick}
                            />
                            <NewsletterSection />
                        </div>
                    )}
                </div>
            </DiscoverLayout>
        </>
    )
}
