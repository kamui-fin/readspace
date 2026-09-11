import { ArticlePriority, type ArticleSummary } from '../types/articles';
import {
  CodexDigestPhase,
  CodexDigestStatus,
  type CodexDigestResponse,
  type CodexNotEntitledResponse,
} from '../types/codex';

// A representative "busy day" Codex digest, typed as the real GET /codex/today response so
// the mock UIs can't drift from the backend. Used by web `/codex/preview` and the mobile
// preview screen — render it with zero network.

function article(
  id: string,
  overrides: Partial<ArticleSummary> & Pick<ArticleSummary, 'title' | 'link' | 'feed_title'>
): ArticleSummary {
  return {
    id,
    source_domain: null,
    created_at: '2026-09-09T06:00:00Z',
    article_type: 'feed',
    description: null,
    image_url: null,
    author: null,
    tags: null,
    is_read: false,
    is_saved: false,
    priority: ArticlePriority.MEDIUM,
    user_note: null,
    read_at: null,
    feed_id: null,
    feed_icon: null,
    published_at: '2026-09-09T04:30:00Z',
    ...overrides,
  };
}

// Unsplash source images — stand in for real article hero/OG images. In a real digest the
// pipeline probes these and picks the hero + strip; the fixtures set `hero_image_url` /
// `strip_image_urls` directly to mirror that decision without a network probe.
const IMG = {
  chips: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&q=70',
  datacenter: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1600&q=70',
  code: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1600&q=70',
  office: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=70',
  server: 'https://images.unsplash.com/photo-1591405351990-4726e331f141?w=1600&q=70',
  finance: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1600&q=70',
  circuit: 'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=1600&q=70',
  boardroom: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&q=70',
} as const;

const opusArticles: ArticleSummary[] = [
  article('a1', {
    title: 'Anthropic ships Claude Opus 4.5 with a 1M-token context window',
    link: 'https://stratechery.com/2026/claude-opus-4-5',
    feed_title: 'Stratechery',
    image_url: IMG.chips,
    description:
      'Opus 4.5 lands with a 1M-token window and lower per-token pricing than 4.1 — a direct answer to Gemini’s long-context lead.',
    published_at: '2026-09-09T05:10:00Z',
  }),
  article('a2', {
    title: 'Claude Opus 4.5 hands-on: recall past 400K tokens is still uneven',
    link: 'https://simonwillison.net/2026/Sep/9/opus-4-5/',
    feed_title: 'Simon Willison’s Weblog',
    image_url: IMG.code,
    description:
      'A first-day teardown: the window is real but retrieval quality degrades noticeably in the back half of a long prompt.',
    published_at: '2026-09-09T05:40:00Z',
  }),
  article('a3', {
    title: 'Anthropic’s new model undercuts OpenAI on price for the first time',
    link: 'https://www.theinformation.com/articles/anthropic-opus-4-5-pricing',
    feed_title: 'The Information',
    image_url: IMG.office,
    description:
      'Per-token pricing lands below GPT-5.1 for the comparable tier — a shift from Anthropic’s usual premium positioning.',
    published_at: '2026-09-09T06:05:00Z',
  }),
  article('a4', {
    title: 'What a 1M-token context actually changes for RAG pipelines',
    link: 'https://newsletter.pragmaticengineer.com/p/1m-token-context',
    feed_title: 'The Pragmatic Engineer',
    image_url: IMG.server,
    published_at: '2026-09-09T07:20:00Z',
  }),
  article('a5', {
    title: 'Opus 4.5 benchmarks: no independent numbers yet, here’s what we know',
    link: 'https://news.ycombinator.com/item?id=45000001',
    feed_title: 'Hacker News',
    published_at: '2026-09-09T08:00:00Z',
  }),
];

const coreweaveArticles: ArticleSummary[] = [
  article('b1', {
    title: 'CoreWeave raises a $9B debt facility for GPU buildout',
    link: 'https://www.bloomberg.com/news/articles/coreweave-9b-facility',
    feed_title: 'Bloomberg Technology',
    description:
      'The financing is earmarked for datacenter expansion through 2027, secured against existing GPU inventory.',
    published_at: '2026-09-09T03:15:00Z',
  }),
  article('b2', {
    title: 'The debt math behind the AI datacenter boom',
    link: 'https://www.ft.com/content/coreweave-debt-math',
    feed_title: 'Financial Times',
    published_at: '2026-09-09T04:50:00Z',
  }),
  article('b3', {
    title: 'CoreWeave’s financing signals a shift from equity to leverage',
    link: 'https://www.theinformation.com/articles/coreweave-leverage',
    feed_title: 'The Information',
    published_at: '2026-09-09T05:25:00Z',
  }),
];

const worthReading: ArticleSummary[] = [
  article('w1', {
    title: 'A careful teardown of the new inference-cost pricing math',
    link: 'https://blog.character.ai/inference-cost-teardown',
    feed_title: 'Character.AI Blog',
    image_url: IMG.finance,
    description:
      'The only source on this — walks through the amortized cost per million tokens under the new pricing.',
    published_at: '2026-09-09T02:40:00Z',
  }),
  article('w2', {
    title: 'Postgres 18 ships with async I/O and a faster planner',
    link: 'https://www.postgresql.org/about/news/postgresql-18-released',
    feed_title: 'PostgreSQL News',
    image_url: IMG.code,
    published_at: '2026-09-09T01:10:00Z',
  }),
  article('w3', {
    title: 'The quiet return of the personal website',
    link: 'https://www.theverge.com/2026/9/9/personal-websites',
    feed_title: 'The Verge',
    published_at: '2026-09-08T22:30:00Z',
  }),
];

export const SAMPLE_CODEX_DIGEST: CodexDigestResponse = {
  id: '00000000-0000-4000-8000-000000000001',
  digest_date: '2026-09-09',
  edition: 1,
  status: CodexDigestStatus.COMPLETED,
  progress_phase: CodexDigestPhase.SYNTHESIZING,
  requested_at: '2026-09-09T08:30:00Z',
  generated_at: '2026-09-09T08:31:12Z',
  model: 'gemini-2.5-flash',
  window_hours: 24,
  input_article_count: 143,
  input_source_count: 31,
  clusters_found: 7,
  error: null,
  payload: {
    // headline = the short <h1>; gist = the longer standfirst sentence under it. scale_setter
    // = magnitude only; the UI now builds the "This issue" colophon from the digest row counts
    // and only falls back to parsing this string on older digests.
    headline: 'A model release and a datacenter mega-raise',
    gist: 'A major model release and a $9B datacenter raise pulled in nearly all the coverage; little else moved.',
    scale_setter: '143 pieces · 31 sources · 7 developments',
    themes: ['Claude Opus 4.5', 'AI datacenter financing', '1M-token context', 'Postgres 18'],
    stats: {
      minutes_condensed: 34,
      articles_condensed: 11,
      minutes_capped: false,
    },
    developments: [
      {
        title: 'Anthropic ships Claude Opus 4.5',
        synthesis: [
          '- Anthropic’s new flagship lands with a **1M-token** context window, roughly 8× the previous model.',
          '- Per-token pricing undercuts the **comparable OpenAI tier** for the first time — a break from Anthropic’s premium.',
          '- **Stratechery** and **The Information** read it as a direct answer to Gemini’s long-context lead.',
          '- **Simon Willison**’s hands-on flags uneven recall past ~400K tokens.',
          '- No independent benchmarks yet; early takes lean on Anthropic’s own numbers.',
        ].join('\n'),
        source_count: 8,
        article_count: 12,
        articles: opusArticles,
        // Pipeline probed the Opus write-ups and picked the widest usable image for the band.
        hero_image_url: IMG.chips,
        strip_image_urls: [IMG.code, IMG.office],
      },
      {
        title: 'CoreWeave raises $9B for GPU buildout',
        synthesis: [
          '- **CoreWeave** secured a **$9B debt facility**, collateralised against its existing GPU inventory.',
          '- The financing funds datacenter expansion through **2027**, not near-term operations.',
          '- **Bloomberg** and the **FT** call it AI infra shifting from equity to leverage.',
          '- **The Information** notes unusually favourable terms given where rates sit.',
        ].join('\n'),
        source_count: 5,
        article_count: 6,
        articles: coreweaveArticles,
        // No article on this development had an image the pipeline could use — text-first card.
        hero_image_url: null,
        strip_image_urls: [],
      },
    ],
    worth_reading: [
      {
        article: worthReading[0]!,
        reason:
          'The only source covering the new pricing math in depth, with a clean amortized cost breakdown.',
      },
      {
        article: worthReading[1]!,
        reason: 'A major release that nothing else in your feeds picked up today.',
      },
      {
        article: worthReading[2]!,
        reason:
          'A standalone essay — no news hook, but the strongest thing outside the two big stories.',
      },
    ],
    closing_line: '7 developments found, 2 shown above — 143 pieces total, still in your reader.',
  },
};

/** An in-flight digest, for exercising the loading UI keyed off progress_phase. */
export const SAMPLE_CODEX_DIGEST_IN_PROGRESS: CodexDigestResponse = {
  ...SAMPLE_CODEX_DIGEST,
  status: CodexDigestStatus.IN_PROGRESS,
  progress_phase: CodexDigestPhase.TRIAGING,
  requested_at: new Date(Date.now() - 18_000).toISOString(),
  generated_at: null,
  payload: null,
  clusters_found: null,
};

/** A quiet day — zero clusters, everything routed to Worth Reading. */
export const SAMPLE_CODEX_DIGEST_QUIET: CodexDigestResponse = {
  ...SAMPLE_CODEX_DIGEST,
  input_article_count: 9,
  input_source_count: 5,
  clusters_found: 0,
  payload: {
    headline: 'A quiet news day',
    gist: 'A quiet day — nothing your sources covered crossed more than one of them.',
    scale_setter: '9 pieces · 5 sources · 0 developments',
    themes: ['Postgres 18'],
    // Quiet day: no developments, so nothing was condensed.
    stats: null,
    developments: [],
    worth_reading: SAMPLE_CODEX_DIGEST.payload!.worth_reading,
    closing_line: 'No developments today — 9 pieces total, still in your reader.',
  },
};

/** Zero candidate articles — the SKIPPED terminal state. */
export const SAMPLE_CODEX_DIGEST_SKIPPED: CodexDigestResponse = {
  ...SAMPLE_CODEX_DIGEST,
  status: CodexDigestStatus.SKIPPED,
  progress_phase: CodexDigestPhase.GATHERING,
  input_article_count: 0,
  input_source_count: 0,
  clusters_found: 0,
  generated_at: '2026-09-09T08:30:05Z',
  payload: null,
};

// ── Not-entitled ("paywall") responses ──────────────────────────────────────
// POST /codex/generate returns a 202 with this shape instead of a digest when the user can't
// generate. Copy mirrors server/app/routers/codex.py + resource_limits.py so the preview and
// the real state can't drift.

/** Basic tier, monthly allowance spent — CodexNotEntitledState opens the upgrade dialog. */
export const SAMPLE_CODEX_NOT_ENTITLED_QUOTA: CodexNotEntitledResponse = {
  entitled: false,
  reason: "You've used all 3 Codex digests for this month. Upgrade to Pro for one per day.",
  error_code: 'CODEX_LIMIT_EXCEEDED',
};

/** Self-hosted instance with AI providers unset — points at the self-hosting docs, no upsell. */
export const SAMPLE_CODEX_NOT_ENTITLED_AI_DISABLED: CodexNotEntitledResponse = {
  entitled: false,
  reason: 'AI features are disabled on this instance.',
  error_code: 'AI_DISABLED',
};

/** Pro tier, window-cap pacing limit — CodexNotEntitledState shows a plain "come back later"
 *  explainer, no upgrade dialog (Pro has no higher tier to sell against here). */
export const SAMPLE_CODEX_NOT_ENTITLED_PRO_RATE_LIMITED: CodexNotEntitledResponse = {
  entitled: false,
  reason: "You've built 2 Daily Digests in the last 22 hours. Try again later.",
  error_code: 'CODEX_PRO_RATE_LIMITED',
};

// ── Development-card imagery fixtures ────────────────────────────────────────
// The pipeline chooses `hero_image_url` + `strip_image_urls` per development; these fixtures
// set those fields directly to exercise each DevelopmentCard layout branch.

const pg18Articles: ArticleSummary[] = [
  article('p1', {
    title: 'Postgres 18 lands async I/O and a rewritten planner',
    link: 'https://www.postgresql.org/about/news/postgresql-18-released',
    feed_title: 'PostgreSQL News',
    published_at: '2026-09-09T01:10:00Z',
  }),
  article('p2', {
    title: 'Benchmarking PG18 async I/O on NVMe',
    link: 'https://vondra.me/pg18-async-io',
    feed_title: 'Tomas Vondra',
    published_at: '2026-09-09T02:00:00Z',
  }),
  article('p3', {
    title: 'Upgrade notes: what breaks going to 18',
    link: 'https://www.crunchydata.com/blog/pg18-upgrade',
    feed_title: 'Crunchy Data',
    published_at: '2026-09-09T02:30:00Z',
  }),
];

/** Image-rich day — a featured hero, a normal-card hero, a 2×2 mosaic, and a text-first card,
 *  so every DevelopmentCard branch is on one screen. */
export const SAMPLE_CODEX_DIGEST_HERO_HEAVY: CodexDigestResponse = {
  ...SAMPLE_CODEX_DIGEST,
  id: '00000000-0000-4000-8000-000000000002',
  payload: {
    ...SAMPLE_CODEX_DIGEST.payload!,
    headline: 'Three big stories, plenty of art',
    gist: 'Three developments carried the day, each with enough coverage across sources to lead with a strong image.',
    developments: [
      {
        ...SAMPLE_CODEX_DIGEST.payload!.developments[0]!,
        source_count: 9,
        article_count: 14,
        hero_image_url: IMG.chips,
        // 4 → the 2×2 mosaic branch.
        strip_image_urls: [IMG.datacenter, IMG.circuit, IMG.code, IMG.boardroom],
      },
      {
        ...SAMPLE_CODEX_DIGEST.payload!.developments[1]!,
        source_count: 6,
        article_count: 8,
        // A non-featured card that still earned a (shorter) hero band.
        hero_image_url: IMG.finance,
        strip_image_urls: [IMG.office, IMG.server],
      },
      {
        title: 'Postgres 18 ships async I/O',
        synthesis: [
          '- **Postgres 18** adds async I/O and a rewritten query planner — a low-risk upgrade for most.',
          '- **Async I/O** cuts NVMe read latency by a reported 2–3×.',
          '- Skip-scan and smarter partition pruning are the planner’s headline wins.',
          '- **Crunchy Data** and **Tomas Vondra** both flag it as safe for most workloads.',
        ].join('\n'),
        source_count: 4,
        article_count: 5,
        articles: pg18Articles,
        // Nothing usable → text-first card.
        hero_image_url: null,
        strip_image_urls: [],
      },
    ],
  },
};

/** The pipeline found no usable image on any development — every card is text-first. */
export const SAMPLE_CODEX_DIGEST_TEXT_ONLY: CodexDigestResponse = {
  ...SAMPLE_CODEX_DIGEST,
  id: '00000000-0000-4000-8000-000000000003',
  payload: {
    ...SAMPLE_CODEX_DIGEST.payload!,
    headline: 'A busy day with no art',
    gist: 'A busy day, but nothing came with usable art — the digest stays text-first.',
    developments: SAMPLE_CODEX_DIGEST.payload!.developments.map((dev) => ({
      ...dev,
      hero_image_url: null,
      strip_image_urls: [],
    })),
  },
};
