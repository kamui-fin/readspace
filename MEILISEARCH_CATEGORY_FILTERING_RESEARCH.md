# Meilisearch Category Filtering Research

## Overview

This document explains how the discover components work with Meilisearch and how to replace `getRecommendationsByCategories` with Meilisearch filtering.

## Current Architecture

### Discover Page Implementation

The discover page uses **React InstantSearch** with direct browser-to-Meilisearch communication:

**File**: `apps/web/app/(protected)/discover/discover-client.tsx`
- Wraps the entire discover page with `<InstantSearch>` provider
- Creates a search client using `createSearchClient()` from `@/lib/meilisearch-client`
- Supports AI-powered hybrid search (semantic + keyword)
- Index name: `"feeds"`

### Key Components

1. **DiscoverContent** (`apps/web/components/discover/DiscoverContent.tsx`)
   - Main component managing search state
   - Uses InstantSearch hooks:
     - `useSearchBox()` - for query input
     - `useMenu()` - for category filtering (attribute: `'top_level_category'`)
     - `useMenu()` - for language filtering (attribute: `'language'`)
     - `useClearRefinements()` - to clear filters
     - `useCurrentRefinements()` - to track active filters

2. **CategoryGrid** (`apps/web/components/discover/CategoryGrid.tsx`)
   - Displays category badges
   - Calls `onCategoryClick(category)` which triggers `refineCategory(categoryName)`

3. **SearchResults** (`apps/web/components/discover/SearchResults.tsx`)
   - Uses `useHits<FeedDiscoveryResult>()` to get search results
   - Uses `usePagination()` for pagination
   - Displays feed cards with results

## Meilisearch Index Structure

### Index Name
```typescript
const FEEDS_INDEX_NAME = "feeds"
```

### Document Schema
```typescript
{
  id: string
  url: string
  title: string | null
  description: string | null
  link: string | null
  language: string | null
  image_url: string | null
  tags: string[] | null
  top_level_category: string | null  // ← Category field
  popularity_score: number | null
  // ... other fields
}
```

### Filterable Attributes
- `top_level_category` - Used for category filtering
- `language` - Used for language filtering

## Available Categories

From `packages/shared/src/constants/categories.ts`:

```typescript
export const FEED_CATEGORIES = [
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
] as const
```

## How Category Filtering Works

### Using InstantSearch Hooks

The discover page uses the `useMenu` hook for category filtering:

```typescript
const { items: categoryItems, refine: refineCategory } = useMenu({
    attribute: 'top_level_category',
    limit: 100,
})

// To filter by category:
refineCategory("Technology & Programming")
```

### Behind the Scenes

When you call `refineCategory()`, InstantSearch:
1. Adds a facet filter to the Meilisearch query
2. Sends a request like:
```json
{
  "q": "",
  "facetFilters": [
    ["top_level_category:Technology & Programming"]
  ]
}
```

### Getting Active Category

```typescript
const { items: currentRefinements } = useCurrentRefinements()

const activeCategoryRefinement = currentRefinements.find(
    (item) => item.attribute === 'top_level_category'
)
const activeCategory = activeCategoryRefinement?.refinements[0]?.value || ""
```

## Replacing getRecommendationsByCategories

### Current Implementation (Commented Out)

In `apps/web/components/onboarding/steps/StepTwo.tsx`:

```typescript
const { data: feedsData } = useQuery({
    queryKey: ["onboarding-feeds", onboardingData.selectedCategories],
    queryFn: async () => {
        // const response = await ApiClient.rss.getRecommendationsByCategories(
        //     onboardingData.selectedCategories,
        //     { limit: 20 }
        // )
        // return response.results
        return []
    },
    enabled: onboardingData.selectedCategories.length > 0,
})
```

### Solution: Direct Meilisearch Query

Replace with a direct Meilisearch query using the `meilisearchClient`:

```typescript
import { meilisearchClient, FEEDS_INDEX_NAME } from "@/lib/meilisearch-client"

const { data: feedsData } = useQuery({
    queryKey: ["onboarding-feeds", onboardingData.selectedCategories],
    queryFn: async () => {
        const index = meilisearchClient.index(FEEDS_INDEX_NAME)
        
        // Build filter for multiple categories
        const categoryFilters = onboardingData.selectedCategories.map(
            category => `top_level_category = "${category}"`
        )
        
        // Search with category filter (OR logic)
        const results = await index.search("", {
            filter: categoryFilters.join(" OR "),
            limit: 20,
            sort: ["popularity_score:desc"]
        })
        
        // Transform results to match expected format
        return results.hits.map((hit: any) => ({
            id: hit.id,
            title: hit.title,
            description: hit.description,
            url: hit.url,
            link: hit.link,
            image_url: hit.image_url,
            category: hit.top_level_category,
            popularity_score: hit.popularity_score,
        }))
    },
    enabled: onboardingData.selectedCategories.length > 0,
})
```

### Alternative: Using InstantSearch in Onboarding

For a more consistent approach, you could wrap the onboarding step with InstantSearch:

```typescript
import { InstantSearch, Configure, useHits } from "react-instantsearch"
import { searchClient, FEEDS_INDEX_NAME } from "@/lib/meilisearch-client"

function StepTwoContent() {
    const { items } = useHits<FeedDiscoveryResult>()
    // Use items directly
}

function StepTwo() {
    const { onboardingData } = useOnboardingStore()
    
    // Build filter string
    const categoryFilter = onboardingData.selectedCategories
        .map(cat => `top_level_category = "${cat}"`)
        .join(" OR ")
    
    return (
        <InstantSearch
            searchClient={searchClient as any}
            indexName={FEEDS_INDEX_NAME}
        >
            <Configure
                hitsPerPage={20}
                filters={categoryFilter}
            />
            <StepTwoContent />
        </InstantSearch>
    )
}
```

## Filter Syntax Reference

### Single Category
```typescript
filter: 'top_level_category = "Technology & Programming"'
```

### Multiple Categories (OR)
```typescript
filter: 'top_level_category = "Technology & Programming" OR top_level_category = "Artificial Intelligence"'
```

### Multiple Categories (Array syntax)
```typescript
filter: [
    ['top_level_category = "Technology & Programming"', 'top_level_category = "Artificial Intelligence"']
]
```

### Category + Language
```typescript
filter: '(top_level_category = "Technology & Programming" OR top_level_category = "AI") AND language = "en"'
```

### With Sorting
```typescript
{
    filter: 'top_level_category = "Technology & Programming"',
    sort: ['popularity_score:desc']
}
```

## Key Differences from Old API

| Aspect | Old API (`getRecommendationsByCategories`) | Meilisearch |
|--------|-------------------------------------------|-------------|
| **Location** | Backend API call | Direct browser query |
| **Performance** | Slower (backend roundtrip) | Faster (direct connection) |
| **Filtering** | Server-side SQL | Client-side facets |
| **Real-time** | No | Yes (instant search) |
| **Typo tolerance** | No | Yes (built-in) |
| **AI Search** | No | Yes (hybrid search) |

## Best Practices

1. **Use InstantSearch hooks when possible** - They handle state management automatically
2. **Use direct meilisearchClient for custom queries** - When you need more control
3. **Always filter by category using `top_level_category`** - This is the indexed field
4. **Sort by `popularity_score:desc`** - For best recommendations
5. **Limit results appropriately** - Default is 20, max is 1000
6. **Handle empty results gracefully** - Show appropriate UI feedback

## Example: Complete Onboarding Implementation

```typescript
import { useQuery } from "@tanstack/react-query"
import { meilisearchClient, FEEDS_INDEX_NAME } from "@/lib/meilisearch-client"

const { data: feedsData, isLoading, error } = useQuery({
    queryKey: ["onboarding-feeds", onboardingData.selectedCategories],
    queryFn: async () => {
        if (onboardingData.selectedCategories.length === 0) {
            return []
        }
        
        const index = meilisearchClient.index(FEEDS_INDEX_NAME)
        
        // Build OR filter for selected categories
        const categoryFilters = onboardingData.selectedCategories.map(
            category => `top_level_category = "${category}"`
        )
        
        const results = await index.search("", {
            filter: categoryFilters.join(" OR "),
            limit: 20,
            sort: ["popularity_score:desc"],
            attributesToRetrieve: [
                "id",
                "title", 
                "description",
                "url",
                "link",
                "image_url",
                "top_level_category",
                "popularity_score"
            ]
        })
        
        return results.hits.map((hit: any) => ({
            id: hit.id,
            title: hit.title,
            description: hit.description,
            url: hit.url,
            link: hit.link,
            image_url: hit.image_url,
            category: hit.top_level_category,
            popularity_score: hit.popularity_score,
        }))
    },
    enabled: onboardingData.selectedCategories.length > 0,
})
```

## Testing

To test category filtering:

```typescript
// In browser console or test file
import { meilisearchClient, FEEDS_INDEX_NAME } from "@/lib/meilisearch-client"

const index = meilisearchClient.index(FEEDS_INDEX_NAME)

// Test single category
const results = await index.search("", {
    filter: 'top_level_category = "Technology & Programming"',
    limit: 5
})
console.log(results.hits)

// Test multiple categories
const multiResults = await index.search("", {
    filter: 'top_level_category = "Technology & Programming" OR top_level_category = "Artificial Intelligence"',
    limit: 10
})
console.log(multiResults.hits)
```

## Resources

- **Meilisearch Filter Documentation**: https://www.meilisearch.com/docs/learn/filtering_and_sorting/filter_search_results
- **React InstantSearch Hooks**: https://www.algolia.com/doc/api-reference/widgets/react-hooks/
- **Meilisearch Client Setup**: `apps/web/lib/meilisearch-client.ts`
- **Category Constants**: `packages/shared/src/constants/categories.ts`

## Summary

To replace `getRecommendationsByCategories` with Meilisearch:

1. Import `meilisearchClient` and `FEEDS_INDEX_NAME`
2. Use `index.search()` with a filter on `top_level_category`
3. Join multiple categories with ` OR `
4. Sort by `popularity_score:desc` for best results
5. Transform the results to match your expected format

The key advantage is **direct browser-to-Meilisearch communication** with no backend API needed, resulting in faster searches and better user experience.
