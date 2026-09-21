import { createHybridSearchParams } from "@readspace/shared"

/** Keep mode in InstantSearch state so requests and cached pages share an identity. */
export function getDiscoverSearchParameters(smart: boolean) {
    const config = createHybridSearchParams()
    return {
        meiliSearchParams: smart
            ? {
                  hybrid: {
                      semanticRatio: config.semanticRatio,
                      embedder: config.embedder,
                  },
                  rankingScoreThreshold: config.rankingScoreThreshold,
                  showRankingScore: true,
              }
            : {},
    }
}
