/**
 * Shared logic for onboarding feed queries.
 *
 * Extracts the duplicated query construction, hit mapping, and round-robin
 * interleave logic from web and mobile onboarding hooks into reusable functions.
 * Avoids dependency on the `meilisearch` package — works with plain objects
 * that conform to Meilisearch query/response shapes.
 */

export type OnboardingFeed = {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  link: string | null;
  image_url: string | null;
  category?: string | null;
  popularity_score?: number;
  frontend_rank_override?: number;
};

type MeilisearchQuery = {
  indexUid: string;
  q: string;
  filter?: string;
  limit: number;
  sort: string[];
  attributesToRetrieve: string[];
};

/**
 * Build Meilisearch multiSearch queries for onboarding feed fetching.
 *
 * Creates one query per selected category, filtered to English-language feeds,
 * sorted by curated rank (frontend_rank_override:asc) with popularity as tiebreaker.
 *
 * @param indexUid - The Meilisearch feeds index name
 * @param categories - List of category codes to query
 * @param limit - Number of feeds to fetch per category (default: 20)
 * @returns Array of Meilisearch query objects
 */
export function buildOnboardingFeedQueries(
  indexUid: string,
  categories: string[],
  limit = 20
): MeilisearchQuery[] {
  return categories.map((category) => ({
    indexUid,
    q: "",
    filter: `top_level_category = "${category}" AND language = "en"`,
    limit,
    sort: ["frontend_rank_override:asc", "popularity_score:desc"],
    attributesToRetrieve: [
      "id",
      "title",
      "description",
      "url",
      "link",
      "image_url",
      "top_level_category",
      "popularity_score",
      "frontend_rank_override",
    ],
  }));
}

/**
 * Map a Meilisearch hit object to an OnboardingFeed.
 *
 * Extracts relevant fields and handles null/undefined defaults.
 *
 * @param hit - Raw Meilisearch hit object
 * @returns OnboardingFeed with normalized fields
 */
export function mapHitToOnboardingFeed(hit: any): OnboardingFeed {
  return {
    id: hit.id,
    title: hit.title,
    description: hit.description,
    url: hit.url,
    link: hit.link,
    image_url: hit.image_url,
    category: hit.top_level_category,
    popularity_score: hit.popularity_score,
    frontend_rank_override: hit.frontend_rank_override,
  };
}

/**
 * Interleave results from multiple category queries.
 *
 * Round-robin merge: if category A has [feed1, feed2], category B has [feed3, feed4],
 * result is [feed1, feed3, feed2, feed4]. Useful for displaying a balanced mix
 * of feeds across categories without overwhelming users with one category at a time.
 *
 * @param categoryResults - Array of arrays, one per category
 * @returns Single interleaved array
 */
export function interleaveOnboardingFeeds(categoryResults: OnboardingFeed[][]): OnboardingFeed[] {
  const interleavedFeeds: OnboardingFeed[] = [];
  const maxLength = Math.max(...categoryResults.map((r) => r.length), 0);

  for (let i = 0; i < maxLength; i++) {
    for (const categoryFeeds of categoryResults) {
      if (i < categoryFeeds.length) {
        interleavedFeeds.push(categoryFeeds[i]!);
      }
    }
  }

  return interleavedFeeds;
}
