import { afterEach, expect, it, mock } from "bun:test"
import instantsearch from "instantsearch.js"
import {
    connectConfigure,
    connectInfiniteHits,
} from "instantsearch.js/es/connectors"
import { instantMeiliSearch } from "@meilisearch/instant-meilisearch"
import { getDiscoverSearchParameters } from "./discover-search-parameters"

const originalFetch = globalThis.fetch
let dispose: (() => void) | undefined

afterEach(() => {
    dispose?.()
    globalThis.fetch = originalFetch
})

async function waitFor(assertion: () => void) {
    for (let attempt = 0; attempt < 100; attempt++) {
        try {
            assertion()
            return
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 5))
        }
    }
    assertion()
}

it("reruns on mode changes and keeps cached hits and totals together after reset", async () => {
    type Query = {
        q: string
        hybrid?: unknown
        page: number
        hitsPerPage: number
    }
    const requests: Query[] = []
    globalThis.fetch = mock(async (_url: unknown, init?: RequestInit) => {
        const { queries } = JSON.parse(String(init?.body)) as {
            queries: Query[]
        }
        requests.push(...queries)
        return Response.json({
            results: queries.map((query) => {
                const hits =
                    query.q === "missing" ||
                    (query.q === "keyword-only" && query.hybrid)
                        ? []
                        : [{ id: query.hybrid ? "smart-feed" : "keyword-feed" }]
                return {
                    indexUid: "feeds",
                    query: query.q,
                    hits,
                    totalHits: hits.length,
                    totalPages: hits.length ? 1 : 0,
                    page: query.page,
                    hitsPerPage: query.hitsPerPage,
                    processingTimeMs: 1,
                }
            }),
        })
    }) as unknown as typeof fetch
    const { searchClient } = instantMeiliSearch(
        "http://localhost:7700",
        "test",
        {
            primaryKey: "id",
            finitePagination: true,
        }
    )
    const search = instantsearch({ indexName: "feeds", searchClient })
    dispose = () => search.dispose()
    let refine!: (nextParameters: ReturnType<typeof parameters>) => void
    let latest: { ids: string[]; total: number } | undefined
    const configure = connectConfigure((state) => {
        refine = state.refine
    })
    const results = connectInfiniteHits((state) => {
        if (state.results && search.status === "idle") {
            latest = {
                ids: state.items.map((hit) => hit.objectID),
                total: state.results.nbHits,
            }
        }
    })
    const parameters = (smart: boolean, query = "science") => ({
        query,
        hitsPerPage: 20,
        ...getDiscoverSearchParameters(smart),
    })
    search.addWidgets([
        configure({ searchParameters: parameters(false) }),
        results({}),
    ])
    search.start()
    await waitFor(() =>
        expect(latest).toEqual({ ids: ["keyword-feed"], total: 1 })
    )
    refine(parameters(true))
    await waitFor(() =>
        expect(latest).toEqual({ ids: ["smart-feed"], total: 1 })
    )
    expect(
        requests.some((request) => request.q === "science" && request.hybrid)
    ).toBe(true)
    refine(parameters(false, "keyword-only"))
    await waitFor(() =>
        expect(latest).toEqual({ ids: ["keyword-feed"], total: 1 })
    )
    refine(parameters(true, "keyword-only"))
    await waitFor(() => expect(latest).toEqual({ ids: [], total: 0 }))
    refine(parameters(true, "missing"))
    await waitFor(() => expect(latest).toEqual({ ids: [], total: 0 }))
    refine(parameters(true, ""))
    await waitFor(() => expect(latest?.total).toBe(1))
    refine(parameters(true))
    await waitFor(() =>
        expect(latest).toEqual({ ids: ["smart-feed"], total: 1 })
    )
    refine(parameters(false))
    await waitFor(() =>
        expect(latest).toEqual({ ids: ["keyword-feed"], total: 1 })
    )
    expect(
        requests.filter((request) => request.q === "science" && request.hybrid)
    ).toHaveLength(1)
})
