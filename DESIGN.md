---
name: Readspace
description: A calm, borderless reading room — forest green on a faintly green-tinted canvas, serif for the writing, sans for the tools.
colors:
  primary: 'hsl(131.74 29.11% 30.98%)'
  primary-foreground: 'hsl(0 0% 100%)'
  secondary: 'hsl(97.6 32.47% 45.29%)'
  secondary-foreground: 'hsl(132 33.33% 97.06%)'
  accent: 'hsl(96.92 26.53% 90.39%)'
  accent-foreground: 'hsl(210 25% 23%)'
  destructive: 'hsl(8 93% 44%)'
  destructive-foreground: 'hsl(0 0% 100%)'
  background: 'hsl(120 100% 99.41%)'
  foreground: 'hsl(200 4.76% 24.71%)'
  card: 'hsl(132 33.33% 97.06%)'
  card-foreground: 'hsl(240 3% 7%)'
  popover: 'hsl(132 33.33% 97.06%)'
  muted: 'hsl(132 33.3% 97.1%)'
  muted-foreground: 'hsl(97 6% 57%)'
  border: 'hsl(210 15% 93%)'
  input: 'hsl(130 9.86% 86.35%)'
  ring: 'hsl(131.74 29.11% 30.98%)'
  sidebar: 'hsl(108 28.3% 97.1%)'
  dark-background: 'hsl(0 0% 7%)'
  dark-foreground: 'hsl(0 0% 83%)'
  dark-card: 'hsl(200 0% 10.77%)'
  dark-muted: 'hsl(240 2.47% 13.51%)'
  dark-muted-foreground: 'hsl(240 2% 60%)'
  dark-border: 'hsl(210 0% 13.03%)'
  dark-destructive: 'hsl(359.18 58.76% 46%)'
  mobile-primary: '#386641'
  mobile-primary-dark: '#6A994E'
  mobile-secondary: '#6A994E'
  mobile-background: 'rgb(255, 255, 255)'
  mobile-foreground: '#232222'
  mobile-root: 'rgb(245, 246, 245)'
  mobile-card: 'rgb(245, 246, 245)'
  mobile-muted: 'rgb(228, 236, 223)'
  mobile-muted-foreground: 'rgb(72, 96, 57)'
  mobile-muted-green: '#D1DBCD'
  mobile-grey: 'rgb(159, 162, 160)'
  mobile-grey4: 'rgb(226, 227, 227)'
  mobile-grey6: 'rgb(243, 243, 243)'
  mobile-tab-border: '#E0E0E0'
  mobile-dark-background: 'rgb(25, 25, 25)'
  mobile-dark-card: 'rgb(32, 32, 32)'
  mobile-dark-surface: 'rgb(46, 46, 46)'
  mobile-dark-border: 'rgb(60, 60, 60)'
typography:
  display:
    fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif'
    fontSize: '2.25rem'
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: '-0.02em'
  headline:
    fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.75rem'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '-0.01em'
  title:
    fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 'normal'
  reading:
    fontFamily: 'EB Garamond, var(--font-noto-serif-sc), var(--font-noto-serif-jp), var(--font-noto-serif-tc), ui-serif, Georgia, serif'
    fontSize: '1.25rem'
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: 'normal'
  body:
    fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  label:
    fontFamily: 'Geist Mono, ui-monospace, SFMono-Regular, monospace'
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: '0.02em'
  logo:
    fontFamily: 'Figtree, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 'normal'
rounded:
  sm: '4px'
  md: '6px'
  lg: '8px'
  full: '9999px'
  mobile-base: '8px'
  mobile-md: '10px'
  mobile-lg: '12px'
  mobile-2xl: '16px'
  mobile-button: '9999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '40px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '40px'
    typography: '{typography.body}'
  button-primary-hover:
    backgroundColor: 'hsl(131.74 29.11% 30.98% / 0.9)'
    textColor: '{colors.primary-foreground}'
  button-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.secondary-foreground}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '40px'
  button-outline:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '40px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '40px'
  button-ghost-hover:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.accent-foreground}'
  card:
    backgroundColor: '{colors.card}'
    textColor: '{colors.card-foreground}'
    rounded: '{rounded.lg}'
    padding: '24px'
  input:
    backgroundColor: 'transparent'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    padding: '4px 12px'
    height: '36px'
    typography: '{typography.body}'
  badge-default:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    rounded: '{rounded.full}'
    padding: '2px 10px'
    typography: '{typography.label}'
  badge-accent:
    backgroundColor: '{colors.sidebar}'
    textColor: '{colors.muted-foreground}'
    rounded: '{rounded.full}'
    padding: '2px 10px'
  tabs-list:
    backgroundColor: '{colors.muted}'
    textColor: '{colors.muted-foreground}'
    rounded: '{rounded.md}'
    padding: '4px'
    height: '40px'
  tab-active:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.sm}'
    padding: '6px 12px'
---

# Design System: Readspace

## Overview

**Creative North Star: "The Quiet Reading Room"** — a room built for sustained reading that also
happens to be a modern newsstand and an honest field notebook. It has the newsstand's
structure (mastheads, source provenance, columns) and the notebook's plainness (serif body,
mono metadata, nothing decorative), all inside a room whose walls are a barely-perceptible
green.

Readspace is an anti-engagement product, and the design has to _look_ like one. Every screen
is mostly calm neutral space. The single warm color is a muted forest green, and it is
structural in two senses: it tints the entire canvas to a faint green-warm white
(`hsl(120 100% 99.41%)` — not a pure white anywhere), and in its saturated form it is
rationed to the things that genuinely matter — the one primary action, the active nav item,
links, and the Daily Digest identity mark. Depth is nearly absent: surfaces sit flat and a single
hairline border does the separating. The interface is furniture — you notice it for a second
when you sit down, then it disappears and the writing is all that's left.

The type system carries most of the brand. **Serif reads, sans operates, mono labels.**
Article bodies and long-form reading are EB Garamond (with Noto Serif SC/JP/TC picking up CJK
runs in the same slot); everything you click or navigate is Geist sans; timestamps, feed
slugs, and byline metadata are Geist Mono. A reader can tell at a glance which text is _the
writing_ and which is _the app_.

Components are quiet but tactile: the same restraint everywhere, but hovers and focus states
have real life — a soft accent-green wash on hover, a 3px focus ring in the brand green, a
gentle transition — so the room responds to you without ever raising its voice.

### Three surfaces, one identity

The tokens above are the **web + extension** system: `apps/web` and `apps/extension` both
import `@readspace/design-tokens/theme.css` unchanged and share byte-identical shadcn/ui
primitives (the extension only adds a fixed ~450px popup width and skips the reading serif,
since it is a capture popup, not a reader). Treat "web" below as covering both.

**`apps/mobile` (Expo / React Native, uniwind) holds the same identity but is not the same
implementation, and the differences are deliberate — do not "fix" mobile to match web:**

| Axis             | Web / Extension                                                    | Mobile                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Neutral base     | Green-warm white (`hsl(120 100% 99.41%)`), faint-cool ink          | **Plain** near-white `rgb(255 255 255)` / `rgb(252 255 252)` and ink `#232222` — no green tint on the canvas in either theme                                                                                                                     |
| Dark theme       | Near-black `hsl(0 0% 7%)`, green cast dropped                      | **Notion greys** — page `#191919`, panel/card `#202020`, hover `#2E2E2E`                                                                                                                                                                         |
| Color tokens     | shadcn semantic set (`--card`, `--muted`, `--accent`, `--border`…) | A `grey`→`grey6` numeric ramp plus `primary` / `secondary` / `root` / `card` / `unified` / `muted-green`; **primary swaps to `secondary` (`#6A994E`) in dark mode** for text and primary buttons                                                 |
| Button radius    | 6px (`rounded-md`)                                                 | **Fully round** (`rounded-full`) for every filled/ghost/icon variant; `text` variant is unstyled                                                                                                                                                 |
| Button sizes     | 40 / 36 / 44px (`h-10` / `h-9` / `h-11`)                           | 40 / 48 / 56px (`h-10` / `h-12` / `h-14`), full-width by default                                                                                                                                                                                 |
| Container radius | 8px cards                                                          | `rounded-2xl` (16px) on cards like the Daily Digest development card; `rounded-lg`/`xl` common                                                                                                                                                   |
| Focus ring       | 3px brand-green ring on every control                              | No focus rings — touch, not keyboard; press feedback is opacity / `Pressable` + haptics                                                                                                                                                          |
| Elevation        | Flat + hairline border everywhere                                  | Same flat intent, but the **bottom tab bar floats**: `expo-blur` `BlurView`, an animated `borderRadius`, and a real shadow (`shadowRadius: 20`, Android `elevation: 15`) — the one lifted chrome element                                         |
| Type in UI       | Geist sans; serif reserved for the reader                          | Geist sans; **Garamond is wired as a `Text` `fontFamily` option** (`garamond`, `-medium`, `-semibold`, `-bold`) but in practice used only inside the WebView reader — no `-webkit`/Noto CJK stack, just `'EB Garamond', Georgia, Cambria, serif` |
| Heading tracking | `-0.02em` via per-role tokens                                      | Global `--tracking-heading: -0.02em` + a `tracking-heading` utility; header titles `text-3xl font-geist-bold`                                                                                                                                    |
| Tabs             | shadcn pill `TabsList`                                             | Native `@react-native-segmented-control` + a custom animated bottom tab bar                                                                                                                                                                      |
| Toasts           | Radix `Toast`, `shadow-lg`                                         | `burnt` (native) with themed bg/border/text helpers                                                                                                                                                                                              |

**What is identical across all three:** the two greens (`#386641` primary, `#6A994E`
secondary), the 8px base radius as the _starting_ step, EB Garamond as the reading face,
Geist for UI, Geist Mono for metadata, Figtree for the wordmark, dark mode as a first-class
theme, the "rationed green / anti-engagement / finite lists" doctrine, and the Daily Digest
newspaper metaphor (masthead → Developments → Worth Reading → closing line). ("Codex" is the
internal codename for this feature — routes, component names, and code identifiers keep it,
but it never appears in the UI.)

**Confirmed anti-references** (what this must never look like):

- **Algorithmic social feeds** — no engagement-bait density, no infinite-scroll affordances,
  no badges / streaks / unread-count dots used as hooks, no "for you" surfaces.
- **Feedly / enterprise-SaaS dashboards** — not busy, not chart-heavy, no dense toolbars or
  power-user control panels crowding the reading.
- **AI-app neon / gradient maximalism** — no purple "AI" gradients, glow effects, or sci-fi
  treatment, _including on the Daily Digest_, which is the AI feature and still uses the plain green
  identity.
- **An untouched shadcn starter** — the primitives are shadcn, but the green identity and the
  serif/sans/mono split must always carry through.

**Key Characteristics:**

- The two greens (`#386641` / `#6A994E`), the reading serif, and the anti-engagement doctrine
  are constant across web, extension, and mobile.
- Saturated green rationed to actions, active state, links, and the Daily Digest mark.
- Flat surfaces + hairline border + tonal fill everywhere; the only shadow is a genuinely
  floating layer (web menus/dialogs; mobile's blurred bottom tab bar).
- Serif for reading, sans for chrome, mono for metadata — a legible three-way split.
- **Web/extension:** green-tinted neutral canvas, no pure white/black, 8px base radius, 6px
  buttons, 3px brand-green focus rings.
- **Mobile:** plain white/`#232222` neutrals with a `grey`→`grey6` ramp, Notion-grey dark
  mode, `rounded-full` buttons, `rounded-2xl` cards, no focus rings, and the dark-mode
  primary→secondary green swap.
- Light and dark are equal citizens; every component is defined for both, on every surface.

## Colors

A muted forest-green identity on green-warm neutrals — warm enough to feel like paper, quiet
enough to disappear behind text.

### Primary

- **Forest Green** (`hsl(131.74 29.11% 30.98%)` / `#386641`): The identity color and
  `--ring`. Used on the one primary button per view, the active navigation item, focus rings,
  in-content links (`prose-a`), and the Daily Digest identity mark. It is deliberately dark and
  desaturated — it reads as ink, not as a highlight. Unchanged between light and dark themes
  **on web/extension**. **Mobile exception:** in dark mode, mobile promotes Meadow Green to
  the primary role — `text-primary` and primary buttons resolve to `#6A994E` — because
  `#386641` on `#191919` is too low-contrast for a phone screen. Match that behavior on
  mobile; do not carry it to web.

### Secondary

- **Meadow Green** (`hsl(97.6 32.47% 45.29%)` / ~`#6A994E`): The lighter, brighter green.
  Carries the browser theme-color meta, secondary buttons, the Daily Digest's "Building your
  Daily Digest" progress affordances, and article-title hover in digest rows. Where primary is ink,
  secondary is the one place a little brightness is allowed.

### Tertiary

- **Pale Sage** (`accent`, `hsl(96.92 26.53% 90.39%)`): Not a text color — a hover/rest
  surface. Ghost buttons, outline buttons, and menu items wash to this on hover. In dark mode
  `accent` collapses to a near-neutral `hsl(240 1.45% 13.53%)`, so treat it as "the hover
  surface," not "a green."

### Neutral

- **Green-warm White** (`background`, `hsl(120 100% 99.41%)`): The canvas. A white with a
  whisper of green — never `#fff`. `--sidebar` (`hsl(108 28.3% 97.1%)`) is a half-step deeper
  for the nav column.
- **Paper** (`card` / `popover` / `muted`, ~`hsl(132 33% 97%)`): Raised surfaces — cards,
  popovers, the tab-list track. Barely lighter/greener than the canvas; the border does the
  real separating.
- **Ink** (`foreground`, `hsl(200 4.76% 24.71%)`): Primary text. A soft near-black with a
  faint cool cast, not `#000`.
- **Quiet Ink** (`muted-foreground`, `hsl(97 6% 57%)`): Metadata, timestamps, secondary
  captions. Note the hue (`97`) — even the gray is tinted toward the green, never a pure
  neutral gray.
- **Hairline** (`border`, `hsl(210 15% 93%)`): The 1px separator that carries structure
  everywhere. `--input` (`hsl(130 9.86% 86%)`) is a touch darker for field strokes.
- **Signal Red** (`destructive`, `hsl(8 93% 44%)` light / `hsl(359 59% 46%)` dark): Errors and
  destructive confirmation only. Never decorative.

### Dark theme

**Web/extension:** near-black canvas (`hsl(0 0% 7%)`), 83%-white text, `hsl(210 0% 13%)`
hairlines, `hsl(200 0% 10.77%)` cards. The two greens hold their light-mode values; the
tinted-neutral trick inverts to plain dark neutrals (there is no green cast in dark — the
greens stand alone against black).

**Mobile:** a Notion-style dark palette — page background `rgb(25 25 25)` (`#191919`),
panel/card `rgb(32 32 32)` (`#202020`), softer surface / hover `rgb(46 46 46)` (`#2E2E2E`),
high-contrast border `rgb(60 60 60)`. Dividers drop to `rgba(255 255 255 / 0.05)`. This is a
warmer, layered dark than web's flat near-black; keep it.

### Mobile neutral base

Mobile does **not** use the green-warm canvas. Its light mode is a plain `rgb(255 255 255)`
screen / `rgb(252 255 252)` white with a `rgb(245 246 245)` `root`/`card` surface and
`#232222` ink — the green-tint trick is web/extension only. Mobile's greys are a numeric
`grey` (`rgb(159 162 160)`) → `grey6` (`rgb(243 243 243)` light / `rgb(32 32 32)` dark) ramp
rather than shadcn semantic tokens, plus `muted-green` `#D1DBCD` as a soft fill and
`muted` / `muted-foreground` (`rgb(228 236 223)` / `rgb(72 96 57)`) for green-tinted chips.

### Named Rules

**The Rationed Green Rule.** Saturated Forest Green appears on at most one primary action per
view, plus active nav, links, and the Daily Digest mark. If a second green button competes for
attention on the same screen, one of them is wrong. Its scarcity is what makes it read as
"this matters." (Applies to all three surfaces.)

**The No-Pure-Neutral Rule.** **Web/extension only.** No `#ffffff`, no `#000000`, no pure
gray — the canvas is green-warm white, ink is faint-cool near-black, `muted-foreground` sits
at hue 97. On web a pure neutral is a bug. Mobile deliberately uses near-pure white/black
neutrals and its own grey ramp; do not apply this rule there.

**The Border-Not-Shadow Rule.** Separation is a 1px `--border`, not a shadow. Shadows are
reserved for genuinely floating layers (popover, dropdown, dialog) and stay soft and small.

## Typography

**Reading Font:** EB Garamond — with `--font-noto-serif-sc`, `--font-noto-serif-jp`,
`--font-noto-serif-tc` in the same stack so CJK content renders in a matched serif.
**UI Font:** Geist (sans) — with `Geist Mono` for metadata.
**Logo Font:** Figtree — the wordmark only (`font-logo`); never body or UI text.

**Character:** A working newspaper's pairing. Garamond gives article text an unhurried,
old-print calm that signals "sit and read"; Geist keeps the surrounding controls modern,
neutral, and quiet; Geist Mono on timestamps and feed slugs reads like a wire-service
dateline. The three are visually distinct enough that a reader never confuses the app's
voice with an author's.

**Mobile note:** the same four families load via `@expo-google-fonts` (Geist, Geist Mono,
Figtree, EB Garamond, each as discrete weight files — RN has no font fallback stacks). The
reader serif runs in a WebView as `'EB Garamond', Georgia, Cambria, serif` (no Noto CJK
stack). Garamond is exposed as a `Text` `fontFamily` option (`garamond` / `-medium` /
`-semibold` / `-bold`) but is used only inside the reader in practice — the native UI is all
Geist, with `font-geist-mono` for metadata, matching the web roles.

### Hierarchy

- **Display** (Geist, 700, ~2.25rem / `text-4xl`, line-height 1.1, tracking -0.02em): Article
  `<h1>` in the reader, page titles. The largest type in the product; it does not go bigger.
- **Headline** (Geist, 600, ~1.75rem / `text-2xl`–`text-[28px]`): section headers, `CardTitle`.
- **Standfirst** (EB Garamond, 700, `text-[28px]`, `leading-[1.15]`, tracking-tight): the
  Daily Digest masthead `<h1>` — the through-line sentence, reading serif per the Serif-Reads Rule,
  bold and tight like the article `<h1>` but a step smaller. Flat size, no breakpoint. Under
  the One-Ceiling.
- **Title** (Geist, 600, ~1.125rem / `text-lg`): Development card headlines, dialog titles,
  list-group headings.
- **Reading** (EB Garamond, 400, ~1.25rem / `prose-xl`–`prose-2xl`, line-height ~1.65):
  Article body, blockquotes. User-adjustable via the reader font-size slider. Measure held to
  a comfortable column, not full width.
- **Body** (Geist, 400, ~0.875rem / `text-sm`): All UI text — buttons, form fields, menus,
  descriptions, Daily Digest synthesis bullets.
- **Label** (Geist Mono, 500, ~0.75rem / `text-xs`, often `uppercase` with `tracking-wider`):
  Feed source names in article headers, timestamps, byline metadata, badges, kbd hints.

### Named Rules

**The Serif-Reads Rule.** If the text is something a person wrote to be read (article body,
pull quote, the synthesized Daily Digest through-line), it is serif. If it is something the app is
telling you (labels, buttons, counts, nav), it is sans. Mono is only for machine metadata —
times, slugs, keys. Don't mix the roles.

**The One-Ceiling Rule.** Display type stops at `text-4xl` (~2.25rem). Readspace has no hero
headline; the biggest words on any screen are an article title, and they stay modest.

## Layout

A centered single-column reading measure is the default; multi-column appears only where the
content is genuinely parallel (the Daily Digest "busy day" layout: a `minmax(0,1fr)` main column
with a fixed `320px` right rail, collapsing to one column below `lg`). Content containers cap
around `max-w-2xl` for pure reading and `max-w-6xl` for the widest dashboard-style views;
horizontal padding steps `px-4 → sm:px-6 → lg:px-8`.

Spacing rhythm is an 8px base (Tailwind's scale). Groups are tight (`gap-1.5`–`gap-3`),
sections are generously separated (`space-y-5`–`space-y-8`, `mt-8`–`mt-10`), and headings
carry more space above than below. Density is low by intent — whitespace is doing
anti-engagement work, so never compress a list to fit more items on screen.

**Web/extension navigation** is a persistent left sidebar (`17rem` expanded, `3rem`
icon-collapsed, `18rem` as a mobile-web sheet) plus an optional `23rem` right sidebar for
context; below the mobile-web breakpoint the left nav becomes a slide-in `Sheet`. The
**extension** is a fixed ~450px popup — single column, no sidebar.

**Mobile navigation** is a custom animated bottom tab bar (`@react-navigation/bottom-tabs`)
plus native stack screens and `@react-native-segmented-control` for in-screen tab switching.
Screen padding is a flat `16px`; content respects safe-area insets and the tab-bar height.

Lists are finite by construction on every surface — hard caps upstream, a visible end, no
infinite scroll.

## Elevation & Depth

**Flat by default, borders for structure.** Surfaces rest on the same plane as the canvas and
are distinguished by a 1px `--border` and a marginally lighter fill (`card`/`muted`). This is
the whole depth model for cards, list rows, panels, and the sidebar — on all three surfaces.

**Web/extension:** shadows exist only for layers that genuinely float above the page —
popovers, dropdown menus, dialogs, toasts. They are soft and small — never a hard offset,
never a colored halo.

**Mobile:** same flat intent, with one sanctioned floating element — the **bottom tab bar**,
which uses an `expo-blur` `BlurView`, an animated `borderRadius`, and a genuine drop shadow
(`shadowRadius: 20`, `shadowOpacity` ~0.08 light / ~0.45 dark, Android `elevation: 15`). It
is the only place mobile spends a real shadow; everything else is border + tonal fill.

### Shadow Vocabulary

- **Resting card** (`shadow-xs`): A near-invisible lift on `Card` and `Input`. Present mostly
  so the border doesn't feel completely inert; you should not consciously see it.
- **Menu / popover** (`shadow-md`): Dropdowns, selects, popovers. A soft ambient shadow that
  says "this is above the page."
- **Dialog / overlay** (`shadow-lg`): Modals and the largest floating surfaces, over a dim
  backdrop.
- **Toast** (`shadow-lg` + `rounded-lg`): Transient notifications.

### Named Rules

**The Flat-Room Rule.** If a surface is part of the page (card, row, panel, nav), it is flat
with a hairline border. Only things that pop _over_ the page (menu, dialog, toast) get a
shadow, and that shadow is always soft, offset-down, and uncolored.

## Shapes

**Web/extension:** one radius family off `--radius: 0.5rem` (8px): `lg` = 8px (cards, article
images, primary containers), `md` = 6px (buttons, inputs, selects, tab track), `sm` = 4px
(active tab pill, small inset controls). Badges and avatars are fully round (`rounded-full`).
Feed favicons and small thumbnails use `rounded` / `rounded-md`.

**Mobile** starts from the same 8px `--radius` but its scale runs larger and softer:
`sm` 4px, base 8px, `md` 10px, `lg`/`xl` 12px, `2xl` 16px, `3xl` 20px. In practice mobile
containers favor `rounded-2xl` (16px) — e.g. the Daily Digest development card — and **every filled,
ghost and icon button is `rounded-full`**, not `rounded-md`. Read mobile as "pill buttons,
generously-rounded cards"; read web as "6px buttons, 8px cards."

Borders are universally 1px (`--border` on web; the `grey4`/`tab-border` greys on mobile).
The one intentional heavier accent is a **4px `border-l-primary` on blockquotes inside
article content** — the single place a colored left border is allowed, because it's a
typographic quotation mark, not a card decoration. Dashed borders (`border-dashed`) mark
empty/quiet states (e.g. the Daily Digest's "nothing converged today" panel). No clipping, no bespoke
silhouettes — the form language is plain rectangles with rounded corners.

## Components

### Buttons

**Web / extension**

- **Shape:** 6px radius (`rounded-md`). Heights: `default` 40px (`h-10`), `sm` 36px,
  `lg` 44px, `icon` 40×40. Body type, `font-medium`, `text-sm`, `gap-2` to an icon; icons are
  16px (`[&_svg]:size-4`).
- **Primary** (`default`): Forest Green fill, white text, `px-4 py-2`. Hover drops to
  `bg-primary/90`. One per view (see the Rationed Green Rule).
- **Secondary:** Meadow Green fill, pale text, hover `bg-secondary/80`.
- **Outline:** 1px `--input` border, canvas background, text `foreground`. Hover washes to
  `accent` surface with `accent-foreground` text.
- **Ghost:** transparent; hover washes to `accent` surface. The default for low-emphasis
  toolbar and menu actions.
- **Link:** Forest Green text, no underline at rest, underline on hover, `underline-offset-4`.
- **Destructive:** Signal Red fill, white text, hover `bg-destructive/90`.
- **Focus (all):** `focus-visible:ring-2 ring-ring` (Forest Green) with `ring-offset-2`.
- **Disabled:** `opacity-50`, `pointer-events-none`.

**Mobile**

- **Shape:** `rounded-full` on `primary`, `secondary`, `ghost`, and `icon`; the `text`
  variant is unstyled inline text. Heights: `small` 40px (`h-10`), `medium` 48px (`h-12`),
  `large` 56px (`h-14`); `fullWidth` is the default. Icon buttons are square at each height
  (40/48/56).
- **Primary:** Forest Green fill (`#386641`), white text — **flips to Meadow Green (`#6A994E`)
  fill in dark mode**. `medium` = `text-base font-geist-medium`, `large` = `text-lg
font-geist-semibold`.
- **Secondary:** `grey6` fill (light `rgb(243 243 243)` / dark `rgb(32 32 32)`), `grey` text.
- **Ghost:** transparent with a 1px `grey4` border, `primary-foreground` text.
- **Icon:** `grey5` fill, no border.
- **Feedback:** no focus ring — `Pressable` opacity + `expo-haptics`. Loading shows an
  animated dot row / `ActivityIndicator` in the variant's text color.

### Chips / Badges

**Web/extension:** fully round (`rounded-full`), `px-2.5 py-0.5`, `text-xs font-semibold`,
1px transparent border in the filled variants. Variants: `default` (Forest Green fill),
`secondary` (Meadow Green fill), `accent` (sidebar-tint fill, `muted-foreground` text — the
quiet informational chip), `success` (green-500), `destructive`, `outline` (foreground text,
visible border only). Hover on filled variants steps the fill opacity down (`/80`).

**Mobile:** same fully-round pill language; uses `muted` / `muted-green` fills with
`muted-foreground` text for the quiet informational chip, `primary` for emphasis.

### Cards / Containers

**Web/extension**

- **Corner Style:** 8px (`rounded-lg`).
- **Background:** `card` (paper) on `card-foreground` text.
- **Shadow Strategy:** `shadow-xs` only — effectively flat; the 1px `--border` is the
  separator (see Elevation).
- **Border:** 1px `--border`, always.
- **Internal Padding:** 24px (`p-6`) standard; header/content/footer each `p-6`, content
  pulls its top padding (`pt-0`). Daily Digest development cards run tighter: `p-4 sm:p-5`, featured
  `sm:p-6`.

**Mobile**

- **Corner Style:** `rounded-2xl` (16px) for primary cards (e.g. the Daily Digest development card);
  `rounded-lg`/`xl` for smaller surfaces.
- **Background:** `root` / `card` (`rgb(245 246 245)` light / `#202020` dark). No shadow —
  border + tonal fill only.
- **Internal Padding:** ~16px; screen gutters a flat `16px`.

### Inputs / Fields

**Web/extension**

- **Style:** 36px tall (`h-9`), 6px radius, 1px `--input` border, **transparent** background
  (they sit on whatever surface holds them), `px-3 py-1`, `text-sm`, `shadow-2xs`. Placeholder
  is `muted-foreground/70`.
- **Focus:** border shifts to `--ring` and a 3px `ring-ring/50` halo appears
  (`focus-visible:ring-[3px]`) — soft, brand-green, no offset. Transition is scoped to
  `[color,box-shadow]`.
- **Error:** `aria-invalid` adds `ring-destructive/20` (dark `/40`) and a `border-destructive`.
- **Disabled:** `opacity-50`, `cursor-not-allowed`.
- **Select trigger** matches the input spec exactly; menu uses `shadow-md`.

**Mobile:** fields sit on the `root`/`card` surface with a `grey4` border; focus is a border
color shift (no ring — touch input). Selection uses native pickers, `@gorhom/bottom-sheet`,
or `@react-native-menu/menu`, not a custom dropdown.

### Navigation

- **Web left sidebar:** persistent, `17rem` expanded / `3rem` icon-only, on `--sidebar` (a
  green-tinted near-white a half-step off the canvas). Items are `text-sm`; the active item
  carries Forest Green; hover uses a dedicated `--nav-hover` token (`hsl(0 0% 90%)` light,
  `hsl(0 0% 18%)` dark) rather than the accent wash. Toggle with `Cmd/Ctrl-B`. On
  mobile-web the left nav becomes an `18rem` slide-in `Sheet` and the right context sidebar
  reflows inline.
- **Web tabs:** a `muted`-track pill group (`h-10`, `p-1`, `rounded-md`); the active tab is a
  `background`-filled `rounded-sm` pill with `shadow-xs` and `foreground` text.
- **Extension:** no sidebar — a single-column ~450px popup with a compact header.
- **Mobile bottom tab bar:** custom, animated (`react-native-reanimated`), floating — see
  Elevation. Header titles are `text-3xl font-geist-bold tracking-tight` (`leading-8`),
  subtitles `text-lg font-geist-medium text-grey2` at `opacity-80`. In-screen switching uses
  `@react-native-segmented-control`, not a pill `TabsList`. Active tint is near-black
  (`#E5E5E5` in dark), inactive is `grey` / `#888` — the tab bar is the one place the active
  marker is neutral rather than green.

### Article Reader (signature)

The product's reason to exist. **Web:** `ProseContainer` wraps content in Tailwind Typography
at `prose-2xl` (`prose-slate dark:prose-invert`): body and list text `text-xl`
`leading-relaxed` in **EB Garamond** (with the Noto Serif CJK stack), headings `font-semibold
text-foreground` in sans, links Forest Green with underline-on-hover only, images `rounded-lg`
with a faint `shadow-sm`, blockquotes with the 4px `border-l-primary` and a `bg-muted/30`
wash. The `ArticleHeader` above it is `not-prose`: feed name in `uppercase tracking-wider`
mono, an `h1` at `text-4xl font-bold tracking-tight`, byline row in mono
`text-sm text-muted-foreground` under a 1px bottom border. Reading size is user-controlled via
`ReaderSlider`. Content is width-constrained, never full-bleed.

**Mobile:** the reader renders in a WebView with hand-authored CSS mirroring the same intent
— body/headings in `'EB Garamond', Georgia, Cambria, serif` (Georgia fallback, no Noto CJK
stack), `font-size: 18px`, `line-height: 1.65`, `h1` 32px / `h2` 28px / `h3` 24px, 24px side
padding, code in `secondary`/`primary`. Newsletters bypass the serif and keep their own
styles inside the WebView. Same reason-to-exist, different rendering path.

### Daily Digest (signature)

The digest surface. (Internally codenamed "Codex" — routes and component names keep that.)
Newspaper metaphor executed literally: a **masthead** — a mono nameplate
(`Stars` mark + "Daily Digest" · date, `font-mono text-xs uppercase tracking-wider` secondary), then
the **standfirst** (`<h1>`, the through-line sentence, `font-serif text-[28px] font-bold
tracking-tight` — the one line here a person _reads_), then, only when it adds something the
standfirst didn't, a mono magnitude line (`font-mono text-xs` — `"143 pieces · 31 sources · 7
developments"`), then a once-shown serif first-run line explaining what the digest did. Section
heads are mono (`text-xs uppercase tracking-wider text-muted-foreground`), not sans — they
read as rules on the page, not panel titles. A **main column of Developments** and a **320px
right rail** (the issue colophon + "Worth Reading") collapse to one column below `lg`, where
the colophon renders inline so the counts never vanish. A **quiet day** (no clusters) is just
the standfirst + the Worth Reading list in a `max-w-2xl` column — no panel restating the
quiet. The **issue colophon** ("This issue") is a tight justified `<dl>` ledger — Pieces /
Sources / Developments (`"2 of 7"` when found ≠ shown), label left, mono value right — under a
mono head; no feed icons. `DevelopmentCard`: **serif synthesis** (`CodexSynthesis` —
`text-[15px]` EB Garamond applied via an explicit inline `fontFamily` (CJK serif fallbacks
included), matching `ArticleContent`; a real hanging `list-disc` marker in
`marker:text-muted-foreground/50`; `**bold**` source anchors in secondary matching the shared
markdown renderer), a `font-semibold tracking-tight` sans headline, and an **adaptive image
layout** from `(imageCount, widest
usable image)` — a capped `16/9`–`2/1` hero only when the lead image measures ≥ the ~620px
render width, else a side-by-side pair, a 4-up mosaic, or text only; images never upscale
(hero and strip both `onLoad`-guard). Source provenance via `SourceAvatarGroup` (the `+N` chip
names its hidden sources), an `ml-auto` mono article count, an `aria-controls`/`useId`
disclosure with a focus ring, and a strongest-first list of `CodexArticleRow`s (mono dateline,
lead row heavier with a 64px thumbnail). Each digest ends with the honest "shown vs. total"
`closing_line`, its trailing "…in your reader" linked (`text-primary`) to the raw day
(`/today`) — woven into the sentence, not a separate CTA. The **generating** state is the
`Stars` mark holding steady (one `motion-safe`
`thin-pulse` breath) above a `w-fit` centered numbered 4-phase checklist whose active row
carries a single greyscale `shimmer` sweep on the label (`motion-safe` only, static
`text-foreground` under reduced motion) plus elapsed seconds from the persisted `requested_at`
— no spinner, no concentric rings. The **not-entitled** state branches on `error_code`: an
exhausted monthly allowance names the tier and opens the upgrade dialog; `AI_DISABLED` points
at the self-hosting docs. A lost poll connection is its own state ("Lost the connection"),
distinct from a true `FAILED` build.

**Mobile Daily Digest** keeps the same structure in one scrolling column (`ScrollView`, 16px
gutters): the masthead is `Daily Digest · {date}` in `text-xs geist-semibold uppercase` Meadow
Green, then `scale_setter` at `size="lg" geist-medium`, then `gist` in `text-sm text-grey`;
Developments render as `rounded-2xl` `DevelopmentCard`s with `gap-3`; the Worth Reading strip
and centered `text-xs text-grey` closing line follow. No right rail — mobile is always the
single-column layout. Same "no gradients / no glow / plain green" restraint.

## Do's and Don'ts

Rules marked **[web/ext]** are the web + extension system; **[mobile]** notes where
`apps/mobile` deliberately differs; unmarked rules hold everywhere.

### Do:

- **Do** keep every screen mostly neutral space and ration saturated Forest Green to one
  primary action plus active nav, links, and the Daily Digest mark (the Rationed Green Rule).
- **Do** keep the two greens exact — `#386641` primary, `#6A994E` secondary — across all
  three surfaces. **[mobile]** it is correct for `text-primary` and primary buttons to
  resolve to the _secondary_ green in dark mode.
- **[web/ext] Do** use the green-warm canvas (`hsl(120 100% 99.41%)`) and faint-cool ink —
  never `#fff`, `#000`, or a pure gray (the No-Pure-Neutral Rule). **[mobile] Do** use the
  plain white/`#232222` base and the `grey`→`grey6` ramp, with the Notion-grey dark palette
  (`#191919` / `#202020` / `#2E2E2E`).
- **Do** separate surfaces with a 1px border and a tonal fill (the Flat-Room Rule).
  **[web/ext]** reserve soft offset-down shadows for floating layers only (menu, dialog,
  toast). **[mobile]** the only shadowed element is the floating bottom tab bar.
- **Do** set reading content in EB Garamond, UI chrome in Geist, and machine metadata in
  Geist Mono (the Serif-Reads Rule). **[web]** include the Noto Serif CJK stack; **[mobile]**
  the reader serif is `'EB Garamond', Georgia, Cambria, serif` inside a WebView.
- **Do** cap display type at `text-4xl` / ~32px; the largest words on a screen are an article
  title (the One-Ceiling Rule).
- **[web/ext] Do** derive corners from `--radius: 0.5rem` — 8px cards, 6px controls, 4px
  inset bits, full-round badges. **[mobile] Do** use `rounded-full` buttons and `rounded-2xl`
  cards.
- **[web/ext] Do** give hover and focus real life: an `accent` wash on hover, a 3px
  brand-green focus ring, a scoped `[color,box-shadow]` transition. **[mobile] Do** use
  `Pressable` opacity + haptics; no focus rings.
- **Do** design and verify light and dark for every component; both are first-class on all
  three surfaces.
- **Do** keep lists finite — a visible end, hard caps, no infinite scroll.

### Don't:

- **Don't** add a second competing green button, or use green as a decorative fill.
- **Don't** introduce gradients, glow, neon, or "AI" sci-fi styling — not even on the Daily
  Digest, on any surface.
- **Don't** let it read as an untouched shadcn starter (**[web/ext]**) or a default RN
  component kit (**[mobile]**): the green identity and the serif/sans/mono split must always
  show.
- **Don't** borrow engagement patterns — infinite scroll, streak/badge hooks, unread-count
  dots as bait, "for you" surfaces, density that crams more items on screen.
- **Don't** float page-level cards on drop shadows, or use a colored
  `border-left`/`border-right` above 1px — the only exception is the 4px `border-l-primary`
  on article blockquotes.
- **[mobile] Don't** "correct" mobile toward the web tokens — the pill buttons, plain
  neutrals, Notion-grey dark mode, dark-mode green swap, and blurred floating tab bar are
  intentional platform choices, not drift.
- **Don't** set body reading text in a sans font, or UI labels in the reading serif.
- **Don't** push any headline past `text-4xl` or add a kicker/eyebrow above it.
- **Don't** use pure `#fff` / `#000` / neutral-gray, or an untinted gray for secondary text
  (tint it from the green or the foreground).
- **Don't** crowd the reading column — content stays width-constrained and never full-bleed.
