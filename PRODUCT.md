# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

<!-- Readspace ships three design surfaces from one monorepo: a Next.js web app (apps/web,
     the primary hosted product at app.readspace.ai), an Expo iOS + Android app (apps/mobile),
     and a Manifest V3 Chrome/Firefox extension (apps/extension). Web and extension share the
     same shadcn/ui + Tailwind v4 token system from packages/design-tokens; mobile re-implements
     the same palette natively via uniwind. They hold to one shared standard of craft and one
     identity, but each honors its own platform's affordances. apps/landing (marketing site) is
     a separate surface not covered by this record. -->

## Users

Two audiences, served equally as one product — the design must not favor either:

- **RSS loyalists.** Readers who followed blogs, writers, and publications directly before
  algorithmic feeds took over, and want that back: a chronological, ad-free stream from
  sources they chose, checked on their own schedule. Many miss Google Reader specifically and
  distrust the commercial successors that pivoted to enterprise AI. They read deliberately,
  not by reflex.
- **Newsletter and save-for-later readers.** People with a pile of unread newsletters and a
  browser full of "read later" tabs, who want one calm inbox where all of it lands and can
  actually be worked through — instead of five apps and a guilty conscience.

Both use Readspace across web, mobile, and (for capture) the browser extension. A subset are
privacy-conscious self-hosters who run the full stack via Docker to own their data; the hosted
app is the convenience tier for everyone else.

## Product Purpose

Readspace is a privacy-first, open-source reading hub that brings RSS feeds, newsletters, and
saved articles into one distraction-free inbox — no algorithm, no ads, no tracking. It exists
because the tools people used to find and read content stopped serving readers and started
serving advertisers and engagement metrics; Readspace reclaims the user-controlled web reading
experience that fractured when Google Reader shut down.

Success is the reader getting in, reading what matters to them, and getting out — with the
confidence they didn't miss anything important. The product measures itself by minimizing time
on platform, not maximizing it.

## Positioning

The combination is the position; no neighboring product holds all of it at once:

1. **Anti-engagement by design.** Explicitly built to reduce time-on-platform — no algorithmic
   feed, no recommendations, no engagement metrics, no VC growth mandate. "Get in, read, get
   out. Go build something."
2. **One hub for feeds, newsletters, and saved articles** — unified in a single chronological
   inbox, fully open-source and self-hostable, with no tracking or ads. Your reading habits
   belong to you, not a company.
3. **Efficient consumption of what you follow.** Beyond the raw stream, Readspace helps readers
   who follow more sources than any feed view can still make sense of — via summaries,
   translations, and the **Daily Digest** (see below), which answers "what did I miss?" by
   clustering the day's articles across sources into synthesized developments plus a short
   worth-reading strip.

(Note: broader multi-source ambitions mentioned in some older docs — Twitter threads, Reddit
posts, books — are **not** part of the confirmed current scope. Scope is feeds, newsletters,
and saved articles.)

## Operating Context

- **Reading is the ritual.** The core scene is a person sitting down to catch up on their
  chosen sources — on a laptop, a phone in a spare moment, or an e-ink-adjacent calm mode of
  attention. The interface should recede and let the writing lead.
- **Capture happens elsewhere.** The browser extension is used mid-browse: one click to save
  a page to "Read Later," and a built-in RSS radar that detects feeds on any site (including
  ones that hide them) to follow directly from the browser.
- **Newsletters arrive by email.** Inbound newsletters route through a Cloudflare Worker to
  the backend; the user forwards or subscribes with a Readspace address and the newsletter
  shows up in the same inbox as everything else.
- **Organization is folder-based and manual** — the user arranges feeds into folders; no
  algorithm reorders anything.
- **Self-hosting is a first-class path.** Docker Compose, `setup.sh` / `launch.sh`, custom
  domains, secret rotation. Self-hosted deployments must work with AI features disabled.
- **Feed discovery** runs against a Meilisearch index of 10,000+ feeds; "view similar feeds"
  uses embeddings.

## Capabilities and Constraints

Confirmed functionality across surfaces:

- Follow RSS/Atom feeds; fetch + full-content extraction of articles in the background.
- Unified inbox with read/unread state, chronological (no algorithmic reordering).
- Save articles to "Read Later" (web, mobile, and via the extension).
- Folder-based organization of feeds.
- Feed discovery search (10k+ feeds via Meilisearch), "similar feeds," read the original
  article.
- AI features (optional, disable-able for self-host): article summaries, translations,
  content/feed similarity.
- **Daily Digest** — on-demand only (no cron). Answers "what did I miss?" over a fixed 24h
  window: clusters articles covering the same event across ≥2 sources into synthesized
  "Developments" (each expands to the 5 best write-ups, strongest first, with provenance like
  "12 articles · 8 sources") — or, when nothing clusters, promotes the single
  highest-priority story of the day as a lone Development (`1 source · 1 article`). Plus a
  "Worth Reading" strip of 2–6 standalone runner-up reads — the next most valuable pieces
  after the Developments. The digest is editorial, not wire-news-only: a landmark essay or
  analysis can lead on a quiet news day. Metered access: Basic 3 / calendar month, Pro 1 /
  day, Admin unlimited. A story has exactly one home — Development or Worth Reading, never
  both. Continuity (day-over-day memory) is a future phase. Web surfaces: `/codex` and `/codex/preview`; mobile: a bottom-tab Digest screen and
  `/codex-preview` (routes keep the internal `codex` codename). Full spec:
  `server/docs/codex-digest-design.md`, tracker: `server/docs/CODEX_TODO.md`.
- OPML import / export; RSSHub support.
- Chrome + Firefox extension: save-to-read-later, feed detection/subscribe.
- Auth via Supabase, shared across web/mobile/extension.

Constraints:

- **Payments differ by platform:** web uses Polar, mobile uses RevenueCat. Tier names in
  product copy: Basic (free), Pro (paid), Admin.
- **`url` vs `link`:** for a feed, `url` is the RSS XML endpoint; `link` is the human-readable
  website. This distinction is load-bearing in schemas and UI copy — never conflate them.
- Self-host builds must degrade gracefully with AI providers unset (no broken UI, features
  hidden or clearly disabled).
- Dark mode is required on every surface — not optional.

Terminology: "feeds" (not "subscriptions" in UI), "Read Later," "inbox," "folders," "Daily
Digest," "Developments," "Worth Reading," "Discover." ("Codex" remains the internal codename
for the digest feature — code, routes, component names — but never appears in the UI.)

## Brand Commitments

- **Name:** Readspace. Hosted at `app.readspace.ai`. Open-source (repo `kamui-fin/readspace`).
- **Wordmark & logo:** `apps/web/public/wordmark.png` is a fixed identity asset; `--font-logo`
  is the reserved logo typeface. Do not substitute or restyle the wordmark.
- **Palette & tokens are locked.** `packages/design-tokens` (shadcn/ui-style CSS variables,
  Tailwind v4 `theme.css`) is the single source of truth for color across web and extension;
  mobile mirrors the same values via `apps/mobile/.../colors.ts` + its Tailwind config. The
  identity color is a muted forest green (`--primary`, ~`hsl(131.74 29.11% 30.98%)` /
  `#386641`-family) with a lighter green secondary. New work uses these tokens; it does not
  introduce a parallel palette.
- **Dark theme is a first-class variant everywhere**, with light and dark defined for every
  UI-critical component.
- **The minimalist reader is a product promise, not a style preference.** "A quiet,
  dependable place for the writing you actually want to read." The reading view and the "calm
  inbox" feel are sacred — design work protects distraction-free reading above expression.
- **Voice** (from `MANIFESTO.md` / `README.md`): calm, direct, quietly principled, a little
  contrarian about the attention economy. Not hype-y, not cute. "One feed. Your feed. Nothing
  more, nothing less."

## Evidence on Hand

- `MANIFESTO.md` — the full product philosophy statement (voice reference).
- `README.md` — feature list, self-hosting steps, positioning against Feedly / post-Google
  Reader landscape.
- `server/docs/codex-digest-design.md` — complete Daily Digest pipeline spec (v1 / MLP).
- `server/docs/CODEX_TODO.md` — Daily Digest build tracker; status "build-complete, now iterating on
  owner UI + output feedback."
- `docs/screenshots/` — existing web + mobile product screenshots (desktop, mobile feeds,
  discover, mobile article, extension).
- `packages/design-tokens/` — committed palette + `theme.css` (light + dark).
- **Absent / do not fabricate:** no published user counts, testimonials, revenue figures,
  benchmarks, or press quotes. Discord and X exist but engagement numbers are not established
  here. Do not invent customer names or usage statistics.

## Product Principles

1. **Minimize time on platform.** Every design decision is judged by whether it gets the
   reader to what matters and out again. Never borrow engagement patterns (infinite scroll
   for its own sake, badges, streaks, "you might also like" as a hook).
2. **The reader chose their sources; the product never second-guesses them.** No algorithmic
   reordering, no injected recommendations in the stream. Chronological and honest.
3. **Reading is sacred, the interface is furniture.** In any reading context the writing
   leads and the UI recedes. Protect the distraction-free reader before adding to it.
4. **One identity, three surfaces, native manners.** Web, mobile, and extension share palette,
   voice, and craft standard, but each respects its platform's conventions rather than
   cloning another's layout.
5. **Self-hostable and honest about it.** Features that depend on external AI or paid tiers
   degrade cleanly; the open-source build is a real product, not a teaser.

## Accessibility & Inclusion

- Dark mode is a hard requirement on all surfaces (light + dark for every UI-critical
  component).
- Reading views must support translation of article content (multi-language readers) and
  render CJK text correctly (dedicated Noto Serif SC / JP / TC font stacks are wired into the
  token system).
- Article content must stay within its container (no horizontal overflow) and reflow at phone
  width — the reader is frequently on a small screen.
- No product-specific formal standard (e.g. WCAG level) has been established; treat solid
  contrast, keyboard operability, and readable type as the working baseline.
