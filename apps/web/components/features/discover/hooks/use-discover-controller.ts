import { useCallback, useEffect } from "react"
import {
    useClearRefinements,
    useCurrentRefinements,
    useMenu,
    useSearchBox,
} from "react-instantsearch"
import { usePersistentState } from "@/hooks/use-persistent-state"
import { useFeedPreview } from "@/components/features/discover/hooks/use-feed-preview"

export interface UseDiscoverControllerProps {
    initialLanguage?: string
    onAiSettingsChange?: (enabled: boolean) => void
}

export function useDiscoverController({
    onAiSettingsChange,
}: UseDiscoverControllerProps) {
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
    }, [
        activeLanguage,
        languageItems.length,
        persistedLanguage,
        refineLanguage,
    ])

    // Determine display language (show "all" if no language filter is active)
    const displayLanguage =
        activeLanguage ||
        (persistedLanguage === "all" ? "all" : persistedLanguage)

    const handleCategoryClick = useCallback(
        (categoryName: string) => {
            refineCategory(categoryName)
        },
        [refineCategory]
    )

    const handleLanguageChange = useCallback(
        (newLanguage: string) => {
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
        },
        [setPersistedLanguage, clearLanguageRefinement, refineLanguage]
    )

    const clearSearch = useCallback(() => {
        // Clear the search query
        refineQuery("")
        // Clear all refinements (category and language)
        clearAllRefinements()
    }, [refineQuery, clearAllRefinements])

    const handleAiToggle = useCallback(
        (enabled: boolean) => {
            setAiSearchEnabled(enabled ? "true" : "false")
            onAiSettingsChange?.(enabled)
        },
        [setAiSearchEnabled, onAiSettingsChange]
    )

    // Determine if we should show search results or categories
    // Show search results if there's a query OR active category, but NOT if it's a URL query (show preview instead)
    const hasActiveSearch = Boolean((query && !isUrlQuery) || activeCategory)

    return {
        // Search State
        query,
        activeCategory,
        hasActiveSearch,
        isUrlQuery,

        // Preview State
        previewFeed,
        isPreviewLoading,
        previewError,
        isPreviewError,

        // Settings State
        displayLanguage,
        isAiEnabled,

        // Actions
        handleCategoryClick,
        handleLanguageChange,
        handleAiToggle,
        clearSearch,
    }
}
