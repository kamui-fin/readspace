# Readspace UI — build conventions

These components are Readspace's shadcn/ui primitives (Radix + `class-variance-authority` +
Tailwind v4). This sync scopes the five core ones: **Button, Card, Input, Badge, Tabs**
(`Card` and `Tabs` are compounds — see below). They are the same primitives the Readspace web
app and browser extension ship.

## Setup

- **No provider or theme wrapper is required.** Tokens are plain CSS custom properties on
  `:root` in the bundled stylesheet; the components read them through Tailwind utility
  classes. Just render the component.
- **Dark mode** is a `.dark` class on an ancestor (usually `<html>`). Every token has a light
  and dark value; add or remove `.dark` on a wrapper to switch. There is no JS theme toggle in
  these primitives.
- **Fonts are not bundled.** The design language expects **Geist** (UI/sans), **Geist Mono**
  (metadata/timestamps), and **EB Garamond** (long-form article reading text) — Readspace loads
  these via `next/font` at runtime. Load them yourself (e.g. Google Fonts). The bundled CSS
  reads `--font-sans` and `--font-mono` (both present, with `ui-sans-serif` / `ui-monospace`
  fallbacks); set them to `"Geist"` and `"Geist Mono"`. For reading text, apply
  `font-family: "EB Garamond", ui-serif, Georgia, serif` directly on your article container —
  the scoped primitives don't use a serif utility, so there is no `--font-serif` token in this
  bundle. Without Geist loaded, UI text falls back to the system sans.

## Styling idiom — Tailwind v4 utilities against Readspace tokens

Style your own layout glue with Tailwind utility classes bound to the **semantic token
classes** below. Do **not** invent hex values or use raw Tailwind color classes
(`bg-green-700`) for brand color — always the semantic name.

| Purpose | Classes |
|---|---|
| Brand action / identity | `bg-primary` `text-primary-foreground` `border-primary` `text-primary` (forest green — ration to ONE primary action per view, plus active nav, links) |
| Secondary green | `bg-secondary` `text-secondary-foreground` `text-secondary` (meadow green) |
| Hover / rest surface | `bg-accent` `text-accent-foreground` (pale sage in light, neutral in dark — it is "the hover surface", not "a green") |
| Page / canvas | `bg-background` `text-foreground` |
| Raised surface (cards, popovers) | `bg-card` `text-card-foreground` `bg-muted` |
| Secondary text / metadata | `text-muted-foreground` |
| Hairline separators | `border-border` (1px — this carries structure; do not reach for shadows) |
| Field strokes | `border-input` |
| Errors / destructive | `bg-destructive` `text-destructive-foreground` `text-destructive` `border-destructive` |
| Nav column tint | `bg-sidebar` |
| Radius | `rounded-sm` (4px) · `rounded-md` (6px, controls) · `rounded-lg` (8px, cards) · `rounded-full` (badges, avatars) — all derive from `--radius: 0.5rem` |

Depth: surfaces are **flat with a 1px `border-border`**. Reserve shadows (`shadow-xs` on cards,
`shadow-md` on menus) for genuinely floating layers. Never a colored `border-left`/`-right`
above 1px except the 4px `border-l-primary` on article blockquotes.

## Where the truth lives

- **`_ds/<folder>/styles.css`** → `@import`s `_ds_bundle.css`, which holds every token
  definition (`:root` and `.dark`) plus the compiled utility classes. Read it before styling.
- **`components/general/<Name>/<Name>.d.ts`** — the prop API for each component.
- **`components/general/<Name>/<Name>.prompt.md`** — per-component usage notes.
- `Card` exports `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`,
  `CardFooter`. `Tabs` exports `Tabs` (root), `TabsList`, `TabsTrigger`, `TabsContent`. All are
  on `window.ReadspaceUI`.

## One idiomatic snippet

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button } from "@readspace/web"

function SimilarFeeds() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Similar feeds</CardTitle>
        <CardDescription>Three sources cover topics close to this feed.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Following a feed adds its articles to your inbox in chronological order.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm">Follow all</Button>
      </CardFooter>
    </Card>
  )
}
```

The import specifier is rewritten to `window.ReadspaceUI` at build time — treat
`@readspace/web` as the package name for these five components.
