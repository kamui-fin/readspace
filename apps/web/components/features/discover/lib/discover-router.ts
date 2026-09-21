import { history as historyRouter } from "instantsearch.js/es/lib/routers"
import { simple as simpleStateMapping } from "instantsearch.js/es/lib/stateMappings"
import type { Router, StateMapping, UiState } from "instantsearch.js/es/types"

import { FEEDS_INDEX_NAME } from "@/lib/meilisearch-client"

/** Clean, stable URL param names for the InstantSearch-native refinements. */
const ROUTE_STATE_KEYS = {
    query: "q",
    category: "category",
    contentType: "type",
} as const

type RouteState = {
    q?: string
    category?: string
    type?: string
}

/**
 * InstantSearch `routing` config for Discover.
 *
 * Syncs the three InstantSearch-native refinements (search query, active
 * category, and content_type filter) to the URL via `?q=`, `?category=`, and
 * `?type=`, so back/forward and shareable/bookmarkable search links work.
 *
 * The AI-search toggle and language preference are applied outside
 * routed refinements (via `<Configure>` parameters) and are synced separately in
 * DiscoverView/useDiscoverController via URL search params, which `createURL`
 * here preserves.
 */
export function createDiscoverRouting(): {
    router: Router<RouteState>
    stateMapping: StateMapping<UiState, RouteState>
} {
    return {
        router: historyRouter<RouteState>({
            writeDelay: 400,
            createURL({ qsModule, routeState, location }) {
                const { origin, pathname, hash, search } = location
                const currentParams = qsModule.parse(search.replace(/^\?/, ""))

                delete currentParams[ROUTE_STATE_KEYS.query]
                delete currentParams[ROUTE_STATE_KEYS.category]
                delete currentParams[ROUTE_STATE_KEYS.contentType]

                const merged = { ...currentParams, ...routeState }
                const queryString = qsModule.stringify(merged, {
                    addQueryPrefix: true,
                    arrayFormat: "repeat",
                    skipNulls: true,
                })
                return `${origin}${pathname}${queryString}${hash}`
            },
        }),
        stateMapping: {
            ...simpleStateMapping(),
            routeToState(routeState: RouteState): UiState {
                const indexState: UiState[string] = {}
                const query = routeState[ROUTE_STATE_KEYS.query]
                const category = routeState[ROUTE_STATE_KEYS.category]
                const contentType = routeState[ROUTE_STATE_KEYS.contentType]

                if (query) {
                    indexState.query = query
                }
                if (category) {
                    indexState.menu = { top_level_category: category }
                }
                if (contentType) {
                    const types = Array.isArray(contentType)
                        ? contentType
                        : String(contentType)
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean)
                    if (types.length > 0) {
                        indexState.refinementList = {
                            content_type: types,
                        }
                    }
                }
                return { [FEEDS_INDEX_NAME]: indexState }
            },
            stateToRoute(uiState: UiState): RouteState {
                const indexState = uiState[FEEDS_INDEX_NAME] || {}
                const routeState: RouteState = {}
                if (indexState.query) {
                    routeState[ROUTE_STATE_KEYS.query] = indexState.query
                }
                const category = indexState.menu?.top_level_category
                if (category) {
                    routeState[ROUTE_STATE_KEYS.category] = category
                }
                const contentTypes = indexState.refinementList?.content_type
                if (contentTypes && contentTypes.length > 0) {
                    routeState[ROUTE_STATE_KEYS.contentType] =
                        contentTypes.join(",")
                }
                return routeState
            },
        },
    }
}
