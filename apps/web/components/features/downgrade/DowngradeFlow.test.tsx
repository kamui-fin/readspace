import { describe, expect, test } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { queryKeys, type OverLimitState } from "@readspace/shared"
import { renderToStaticMarkup } from "react-dom/server"
import { DowngradeFlow } from "./DowngradeFlow"

const overLimit: OverLimitState = {
    downgrade_required: true,
    subscriptions: { usage: 15, limit: 10, over: true },
    newsletters: { usage: 0, limit: 0, over: false },
    saved_articles: { usage: 0, limit: 50, over: false },
}

describe("downgrade feed loading", () => {
    test("a failed feed request shows retry instead of the destructive flow", () => {
        const client = new QueryClient({
            defaultOptions: { queries: { retryOnMount: false, retry: false } },
        })
        const query = client
            .getQueryCache()
            .build(client, { queryKey: queryKeys.feeds() })
        query.setState({
            status: "error",
            error: new Error("Feed request failed"),
            fetchStatus: "idle",
        })
        const html = renderToStaticMarkup(
            <QueryClientProvider client={client}>
                <DowngradeFlow overLimit={overLimit} />
            </QueryClientProvider>
        )
        expect(html).toContain("Retry")
        expect(html).not.toContain("Continue on Free")
        expect(html).not.toContain("All of them fit")
        client.clear()
    })
})
