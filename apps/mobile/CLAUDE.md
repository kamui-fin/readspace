# CLAUDE.md — Readspace Mobile

**Scope:** rules and conventions for AI-driven code changes in the Readspace Expo / React Native mobile app located in `apps/mobile` (monorepo root). This file is intended to guide automated coding assistants and humans working with them.

---

## 1. Quick links (reference docs)

- Expo docs (fonts, assets, config): [https://docs.expo.dev](https://docs.expo.dev)
- NativeWind: [https://www.nativewind.dev](https://www.nativewind.dev)
- Legend List: [https://www.legendapp.com/open-source/list/v2/getting-started/](https://www.legendapp.com/open-source/list/v2/getting-started/)
- Monicons + Solar: [https://github.com/mikaeljorhult/monicons](https://github.com/mikaeljorhult/monicons) and [https://icones.js.org/collection/solar](https://icones.js.org/collection/solar)
- React Native Reanimated: [https://docs.swmansion.com/react-native-reanimated](https://docs.swmansion.com/react-native-reanimated)
- TanStack Query: [https://tanstack.com/query](https://tanstack.com/query)
- Sonner Native: [https://github.com/sonner-toast/sonner-native](https://github.com/sonner-toast/sonner-native)
- Expo Router: [https://expo.github.io/router](https://expo.github.io/router)

Include these links when giving the model follow-up instructions that require deeper reading.

---

## 2. What this applies to

- Code under `apps/mobile`;
- Shared packages referenced by the mobile app (e.g. `packages/shared`);
- Any Auto-generated commits or patches produced by the assistant for this app.

This file does _not_ authorize any automated pushes to remote repositories. Humans must review and push.

---

## 3. Code discovery & navigation

- Use repository-level search tools first (e.g. `rg`, `git grep`) to find relevant files. Prefer structural search by folder (`apps/mobile`, `packages/shared`, `apps/web`).
- Before editing any file, trace the call graph or usage in the repo: open the component, then scan siblings and parent routes.
- When referencing web app behavior for parity, inspect `apps/web` for feature flow and API usage patterns.

---

## 4. Editing rules

- **One component per file.** If a file grows > 250 lines, split it into smaller components.
- Keep components small: prefer composition over large `if/else` rendering logic.
- Name folders with `snake-case` (note the hyphen, not underscore) for components (each component should have `index.tsx` file with implementation of component), `camelCase` for hooks/utils.
- Exports: prefer named exports for components and hooks, default export only for `pages`/route components when required by router conventions.
- For any API call, use hooks in `packages/shared` — do not create new fetch hooks unless strictly necessary and agreed by reviewer.
- Imports should follow the format designated by the paths in `apps/universal/tsconfig.json` for concision and consistency, i.e., `@components/button`.

---

## 5. Styling conventions

- Use `nativewind` + `clsx` + `class-variance-authority (cva)` for reusable primitives.
- Avoid inline style objects unless animated with Reanimated worklets.
- Extract style variants with `cva` for shared components (button, chip, toast).
- Dark mode: follow NativeWind's `dark` strategy. Ensure both `light` and `dark` variants are present for UI-critical components.

**Tailwind config snippet** (already present in repo) should be used as the single source of truth for colors and fonts. Do not duplicate the palette elsewhere — import from a central file when needed.

---

## 6. Color palette

Consolidate colors under a single module that re-exports the Tailwind tokens. Use Tailwind tokens in JSX with `className`/`class` whenever possible. Note that colors used for this app are in `lib/constants/colors.ts`. And the tailwind config is at the root of `universal/` at `tailwind.config.js` for styling reference.

Primary colors (examples):

- `primary: #386641`
- `secondary: #6A994E`
- `red: #EA4335`
- `green-grey: #D1DBCD`
- `grey6: "rgb(247, 247, 247)"`,
- `grey5: "rgb(237, 237, 237)"`,
- `grey4: "rgb(226, 227, 227)"`,
- `grey3: "rgb(211, 212, 211)"`,
- `grey2: "rgb(180, 182, 180)"`,
- `grey: "rgb(159, 162, 160)"`,
- `white: #FFFFFF`
- `black: #232222`

When making palette changes, update the Tailwind config and run a quick scan for usages.

---

## 7. Fonts & typography

- Main: Geist Sans (via `@expo-google-fonts/geist`)
- Headings: letterSpacing `-0.02em` (Tailwind `heading` token)
- Logo: Figtree
- Reading: EB Garamond

Load fonts via Expo recommended pattern (`expo-font` + `useFonts`) at app entry. Keep font tokens in the central `tailwind.config`.

---

## 8. Lists & performance

- Use `@legendapp/list` for article lists and other high-throughput lists. Prefer virtualization and `keyExtractor` usage.
- Keep renderItem lean: avoid anonymous closures allocating heavy logic per render.

---

## 9. State & storage

- Persisted key/value storage: use `react-native-mmkv` or the designated key-value helper in `packages/shared`.
- Local UI/global app state: use `zustand` per existing patterns.
- Keep transient UI state in component-level `useState`, global data in zustand or TanStack Query cache.

---

## 10. Data fetching

- Use TanStack Query (`@tanstack/react-query`) and the hooks already in `packages/shared`. Do **not** implement new data fetching hooks that duplicate shared functionality.
- Query keys must be deterministic and named clearly (e.g. `['articles', { feedId }]`).

---

## 11. Animations

- Use `react-native-reanimated` for primary interactive animations. Keep worklets pure and small.
- For micro-interactions, `moti` is acceptable (already in deps). Coordinate with Reanimated when mixing.

---

## 12. Routing

- Use `expo-router`. Route files go under `src/app` following the router conventions used in `apps/web` where applicable.
- Avoid complicated per-route logic in layout files. Keep route-specific UI in route components.

---

## 13. Icons & images

- Use `@monicon/native` + solar icons. Centralize icon mappings in `src/components/Icon/index.tsx`.
- Logo is `readspace.svg` — wrap in a small `Logo` component that selects the correct font family (Figtree) when rendering text-based variants.

---

## 14. Toasts & feedback

- Use `components/toast` for toasts and ephemeral messages.

---

## 15. Tests, lint, format

- Run `yo lint`, `yo format`, `yo test` locally before creating patches.
- Unit tests should live next to implementation files (e.g. `formatDate.test.ts`).
- Keep test scope focused: mock network calls and keep deterministic results.

---

## 16. Git & commit rules

- Do not perform git operations automatically. Create patches/PRs only when requested.
- Commit title format: `<area>: <short-description>` (e.g. `ui: add article card skeleton`).
- Include concise description and link to related Asana/Slack threads if available.
- Run `yo proofread` against commit message.

---

## 17. When to ask for human input

Ask a human reviewer if any of the following apply:

- The change touches auth, payments, or core data migration behavior.
- You need to add or upgrade a native dependency (pod changes / native build changes).
- The component or change will affect performance-critical code paths (lists, rendering loops).

---

## 18. Dependency & environment notes

The mobile app relies on the following notable packages (partial list):
`nativewind`, `cva`, `clsx`, `react-native-reanimated`, `@legendapp/list`, `zustand`, `react-native-mmkv`, `@tanstack/react-query`, `expo-router`, `sonner-native`, `@monicon/native`.

If a dependency needs upgrading, provide a short migration plan and a human must approve.

---

## 19. Failure cases & remediation (short)

- If fonts fail to load: fall back to system font and create an issue linking to Expo fonts docs.
- If list jank appears: audit renderItem allocations and use Legend List virtualization.
- If TanStack Query key collisions occur: make keys more specific (include type + id objects).

---

## 20. Appendix: example commands

- Local run (dev): `bun <command>` or `expo start` (follow repo README)
- Lint & format: `yo lint`, `yo format`
- Tests: `yo test`

---

_This CLAUDE.md is intentionally concise. When in doubt, prefer small, testable changes and ask a human reviewer._
