import { useState } from "react"
import NextImage from "next/image"
import { Configure } from "react-instantsearch"

import { getDiscoverSearchParameters } from "./lib/discover-search-parameters"

import { AiSearchToggle } from "./AiSearchToggle"
import { CategoryGrid } from "./CategoryGrid"
import { ContentTypeFilter } from "./ContentTypeFilter"
import { CustomSearchBox } from "./CustomSearchBox"
import { DiscoverLayout } from "./DiscoverLayout"
import { LanguageMenu } from "./LanguageMenu"
import { SearchResults } from "./SearchResults"
import { NewsletterSection } from "./NewsletterSection"
import { useDiscoverController } from "@/components/features/discover/hooks/use-discover-controller"
import { CATEGORY_CONFIG } from "@/lib/categories"
import { cn } from "@/lib/utils"
import { FeedCategory } from "@readspace/shared"

interface DiscoverContentProps {
    aiSearchEnabled: boolean
    onAiSearchToggle: (enabled: boolean) => void
}

/**
 * Main discover content component with InstantSearch integration.
 *
 * Manages search state, category filtering, and language filtering.
 * Uses InstantSearch hooks for all search functionality.
 */
export function DiscoverContent({
    aiSearchEnabled,
    onAiSearchToggle,
}: DiscoverContentProps) {
    const [isInstantTyping, setIsInstantTyping] = useState(false)

    const {
        activeCategory,
        hasActiveSearch,
        isUrlQuery,
        previewFeed,
        isPreviewLoading,
        previewError,
        isPreviewError,
        displayLanguage,
        setDisplayLanguage,
        isLanguageInitialized,
        languageFilter,
        handleCategoryClick,
        clearSearch,
        resetFilters,
    } = useDiscoverController()

    return (
        <>
            {/* Configure search parameters. `filters` applies the language
                preference as a raw Meilisearch filter. Withheld until the
                persisted language preference has loaded from localStorage,
                so InstantSearch never fires a request against the wrong
                default language before it's restored (see
                use-discover-controller's isLanguageInitialized doc). */}
            {isLanguageInitialized && (
                <Configure
                    {...getDiscoverSearchParameters(aiSearchEnabled)}
                    hitsPerPage={20}
                    attributesToHighlight={["title", "description"]}
                    filters={languageFilter}
                />
            )}

            <DiscoverLayout centerVertically={!hasActiveSearch}>
                <div
                    className={cn(
                        "w-full mx-auto",
                        hasActiveSearch
                            ? "max-w-3xl pt-3 md:pt-6 pb-20"
                            : "max-w-full md:max-w-4xl pb-0"
                    )}
                >
                    {/* Header */}
                    <div className="flex flex-col items-center">
                        {hasActiveSearch ? (
                            <h1 className="mb-4 md:mb-6 text-2xl md:text-3xl font-semibold text-foreground dark:text-foreground tracking-tight text-center">
                                {activeCategory
                                    ? CATEGORY_CONFIG[
                                          activeCategory as FeedCategory
                                      ]?.name || activeCategory
                                    : "Search feeds"}
                            </h1>
                        ) : (
                            <div className="flex items-center gap-4 mb-6 md:mb-8">
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
                    <div
                        className={cn(
                            "w-full",
                            hasActiveSearch
                                ? "max-w-3xl mb-3 md:mb-4"
                                : "max-w-2xl mx-auto mb-6 md:mb-8"
                        )}
                    >
                        <CustomSearchBox
                            placeholder="Search for a website or paste RSS link"
                            aiSearchEnabled={aiSearchEnabled}
                            onInstantTyping={() => setIsInstantTyping(true)}
                        >
                            <AiSearchToggle
                                enabled={aiSearchEnabled}
                                onToggle={onAiSearchToggle}
                            />
                            <div className="h-4 w-px bg-[#D8E5D0] dark:bg-border/60 shrink-0" />
                            <LanguageMenu
                                language={displayLanguage}
                                onLanguageChange={setDisplayLanguage}
                            />
                        </CustomSearchBox>
                    </div>

                    {/* Content Section */}
                    {isUrlQuery ? (
                        /* Show preview when URL is detected */
                        <SearchResults
                            onClearSearch={resetFilters}
                            isInstantTyping={isInstantTyping}
                            onSearchDone={() => setIsInstantTyping(false)}
                            previewFeed={previewFeed}
                            isPreviewLoading={isPreviewLoading}
                            previewError={previewError}
                            isPreviewError={isPreviewError}
                        />
                    ) : hasActiveSearch ? (
                        /* Show search results for regular queries */
                        <div className="space-y-3 md:space-y-4">
                            <ContentTypeFilter />
                            <SearchResults
                                onClearSearch={resetFilters}
                                isInstantTyping={isInstantTyping}
                                onSearchDone={() => setIsInstantTyping(false)}
                            />
                        </div>
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
