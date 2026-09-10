# design-sync notes — Readspace

## Repo shape (read before every re-sync)

- **There is no distributable design-system package.** The synced "package" is `@readspace/web`
  (`apps/web`), a Next.js app. The components are Tailwind-v4 + shadcn/ui primitives living in
  `apps/web/components/ui/*.tsx`, consumed directly by the app — no build, no library entry.
  So the converter runs in **synth-entry mode** from `srcDir: components/ui`.
- **Scope is intentionally narrow** (first sync): 5 core components pinned in `componentSrcMap` —
  Button, Card, Input, Badge, Tabs. `apps/extension` is a byte-identical mirror of these; nothing
  extension-specific was synced. `apps/mobile` is a separate uniwind/RN implementation and is
  **out of scope** for Claude Design (non-web).

## Shims (`apps/web/.design-sync-shims/`) — why they exist and why they live there

This dir is **committed** (not gitignored). `cfg.cssEntry` is bounded by the converter to
`pkgRoot` (= `apps/web`), so the compiled CSS **must** live inside `apps/web`; the other shims
sit beside it for cohesion. `cfg.entry` / `cfg.tsconfig` / `cfg.cssEntry` in the config point
here (repo-relative for `entry`, package-relative for the other two).

- `entry.ts` — `export * from` all 5 `components/ui/*` files. This is the bundle entry
  (`cfg.entry`); without it the converter has nothing to bind onto `window.ReadspaceUI`.
- `utils.ts` — the real `apps/web/lib/utils.ts` re-exports `cn` but also imports `@/env`.
- `env.ts` — the real `@/env` is `@t3-oss/env-nextjs` `createEnv({...})` with a **required**
  `NEXT_PUBLIC_SUPABASE_URL: z.string().url()` — it **throws at import** outside a Next build,
  which would kill the bundle. The 5 scoped components only need `cn`, which never reads env.
- `tsconfig.json` — a scoped tsconfig whose `paths` remap `@/lib/utils` → `.design-sync-shims/utils.ts`
  and `@/env` → `.design-sync-shims/env.ts`, with `@/*` → `apps/web/*` for everything else.
  Pointed at by `cfg.tsconfig`. Non-wild rules match before the `@/*` wildcard in the
  converter's tsconfig-paths plugin, so the remaps win.
- `build-css.mjs` + `readspace-tokens.css` — `packages/design-tokens/src/theme.css` is **not**
  browser CSS (it's `@import 'tailwindcss'` + `@plugin` + `@theme` directives). `build-css.mjs`
  runs `@tailwindcss/postcss` (from `apps/web/node_modules`) over `theme.css` with the 5
  component files as `@source` scan targets, emitting a **static** `readspace-tokens.css`
  (~272 KB) with real `:root` custom properties and the utility classes those components use.
  `cfg.cssEntry` points at that compiled file. **Re-run
  `node apps/web/.design-sync-shims/build-css.mjs` before any re-sync** if `theme.css` or the
  scoped component classNames changed — the compiled file is committed but goes stale.

## Build / run

- Package manager: **bun** (`bun@1.3.0`, `bun.lock`). Node `>=18`.
- `--node-modules` → `apps/web/node_modules` (that's where `react` / `react-dom` / `@types/react`
  resolve; repo root `node_modules` does not have them).
- No `buildCmd` — nothing to build; the entry is `cfg.entry` (`apps/web/.design-sync-shims/entry.ts`),
  synth-style over source. `--entry` is NOT needed on the CLI (`cfg.entry` covers it); if you
  do pass `--entry`, use `./apps/web/.design-sync-shims/entry.ts`.
- Re-sync command (from repo root):
  `node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules apps/web/node_modules --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json`

## Known render warns (checked every re-sync — an unlisted warn is new)

- **`[TOKENS_MISSING]` — 16–17 custom properties**: all `--radix-*` (select/dropdown trigger
  dims), `--width-var` / `--skeleton-width` (Skeleton runtime), `--color-bg` / `--color-from`
  (gradient utilities), and sometimes `--font-garamond-serif` (the reader serif var, referenced
  by `--font-serif` in `@theme` but never resolved because no scoped component uses a serif
  utility). Every one is set at runtime by Radix / an inline style / `next/font` — none belong
  in a shipped stylesheet. Non-blocking; confirmed against rendered previews. The count varies
  by ±1 depending on the exact `readspace-tokens.css` regen; not a regression.

## Config decisions

- `dtsPropsFor` for all 5 components is **hand-written** (no built `.d.ts` tree exists;
  ts-morph on `.tsx` extracted nothing). Bodies were derived from the `cva` variant configs in
  the source. If a component's variant list changes upstream, update `dtsPropsFor` by hand.
- `overrides.Tabs.cardMode = "column"` — the default Tabs story is 420px wide and cropped in
  the product's multi-column grid; column mode gives it a full-width row.

## Re-sync risks / watch-list

- **`readspace-tokens.css` is a generated snapshot.** If Readspace bumps Tailwind, changes
  `theme.css` tokens, or the scoped components gain new utility classes, the committed CSS is
  stale until `build-css.mjs` is re-run. A design built against stale CSS renders with missing
  utilities and no error.
- **The `@/env` shim silently stubs env access.** If a future scoped component actually reads
  `env.*` at module scope (not just `cn`), it'll get `undefined` and may misbehave. Only Button/
  Card/Input/Badge/Tabs were checked to be `cn`-only.
- **Expanding scope** means re-checking every newly-added component for `@/`-alias imports that
  pull in app singletons (supabase client, stores, `env`, query hooks). Each such import needs a
  shim entry or the component must be excluded.
- Extension parity is assumed, not verified per-sync — if `apps/extension/src/components/ui`
  diverges from `apps/web/components/ui`, this sync would no longer represent it.
