import { Sparkles } from "lucide-react"
import NextImage from "next/image"
import { useCallback, useEffect } from "react"
import {
    Configure,
    useClearRefinements,
    useCurrentRefinements,
    useMenu,
    useSearchBox,
} from "react-instantsearch"

import { CategoryGrid } from "./CategoryGrid"
import { CustomSearchBox } from "./CustomSearchBox"
import { DiscoverLayout } from "./DiscoverLayout"
import { useFeedPreview } from "./hooks/useFeedPreview"
import { usePersistentState } from "./hooks/usePersistentState"
import { SearchResults } from "./SearchResults"

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
    const { query, refine: refineQuery } = useSearchBox()

    // Feed preview hook for URL detection
    const {
        previewFeed,
        isLoading: isPreviewLoading,
        error: previewError,
        isUrlQuery,
        isError: isPreviewError,
    } = useFeedPreview(query)

    // Use InstantSearch's menu widget for category filtering
    const { refine: refineCategory } = useMenu({
        attribute: "top_level_category",
        limit: 100,
    })

    // Use InstantSearch's menu widget for language filtering
    const { items: languageItems, refine: refineLanguage } = useMenu({
        attribute: "language",
        limit: 10,
    })

    // Use a single clear refinements hook
    const { refine: clearRefinementsBase } = useClearRefinements()

    // Use current refinements to reliably detect active filters
    const { items: currentRefinements } = useCurrentRefinements()

    // Get active language from current refinements
    const activeLanguageRefinement = currentRefinements.find(
        (item) => item.attribute === "language"
    )
    const activeLanguage =
        (activeLanguageRefinement?.refinements[0]?.value as string) || ""

    // Wrapper functions to clear specific refinements
    const clearLanguageRefinement = useCallback(() => {
        if (activeLanguage) {
            refineLanguage(activeLanguage) // Toggle off the current language
        }
    }, [activeLanguage, refineLanguage])

    const clearAllRefinements = useCallback(() => {
        clearRefinementsBase()
    }, [clearRefinementsBase])

    // Persistent language preference - defaults to "en"
    const [persistedLanguage, setPersistedLanguage] = usePersistentState(
        "discover-language",
        "en"
    )

    // AI search state
    const [aiSearchEnabled, setAiSearchEnabled] = usePersistentState(
        "discover-ai-search",
        "false"
    )
    const isAiEnabled = aiSearchEnabled === "true"

    // Get active category from current refinements
    const activeCategoryRefinement = currentRefinements.find(
        (item) => item.attribute === "top_level_category"
    )
    const activeCategory = activeCategoryRefinement?.refinements[0]?.value || ""

    // Apply persisted language filter when no language is active
    // This runs on mount and whenever the filter gets cleared
    useEffect(() => {
        if (
            !activeLanguage &&
            languageItems.length > 0 &&
            persistedLanguage !== "all"
        ) {
            const targetLang = persistedLanguage || "en"
            // Apply the filter
            refineLanguage(targetLang)
        }
    }, [activeLanguage, languageItems.length, persistedLanguage, refineLanguage])

    // Determine display language (show "all" if no language filter is active)
    const displayLanguage =
        activeLanguage ||
        (persistedLanguage === "all" ? "all" : persistedLanguage)

    const handleCategoryClick = (categoryName: string) => {
        refineCategory(categoryName)
    }

    const handleLanguageChange = (newLanguage: string) => {
        setPersistedLanguage(newLanguage)

        if (newLanguage === "all") {
            // Clear language filter completely
            clearLanguageRefinement()
        } else {
            // First clear any language filter, then apply the new one
            clearLanguageRefinement()
            // Use setTimeout to ensure the clear completes first
            setTimeout(() => {
                refineLanguage(newLanguage)
            }, 0)
        }
    }

    const clearSearch = useCallback(() => {
        // Clear the search query
        refineQuery("")
        // Clear all refinements (category and language)
        clearAllRefinements()
    }, [refineQuery, clearAllRefinements])

    const handleAiToggle = (enabled: boolean) => {
        setAiSearchEnabled(enabled ? "true" : "false")
        onAiSettingsChange?.(enabled)
    }

    // Determine if we should show search results or categories
    // Show search results if there's a query OR active category, but NOT if it's a URL query (show preview instead)
    const hasActiveSearch = Boolean((query && !isUrlQuery) || activeCategory)

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
                            <h1 className="pt-4 mb-6 text-2xl md:text-4xl font-semibold text-black dark:text-foreground tracking-tight">
                                {activeCategory || "Search Feeds"}
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
                                    className="text-3xl md:text-5xl font-semibold text-black dark:text-foreground tracking-tight"
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
