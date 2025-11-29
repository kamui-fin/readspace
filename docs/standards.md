# Readspace Code Standards

This document outlines the coding standards and file structure for the Readspace project.

## File Structure

### `apps/web`

- **`app/`**: Next.js App Router pages and layouts.
- **`components/features/`**: Feature-specific components. Each feature should have its own directory (e.g., `articles`, `feeds`, `navigation`).
  - **`components/features/[feature]/hooks/`**: Hooks specific to a feature.
- **`components/ui/`**: Reusable UI components (shadcn/ui).
- **`design-tokens/`**: Design tokens (colors, animations) and Tailwind configuration.
- **`hooks/`**: Global or cross-feature hooks.
- **`lib/`**: Utility functions and libraries.
- **`stores/`**: Global state stores (Zustand).

### `packages/shared`

- **`src/api/`**: API clients and hooks.
- **`src/utils/`**: Shared utility functions.
- **`src/types/`**: Shared TypeScript types.

## Naming Conventions

- **Files**: `kebab-case` for utilities and hooks (`use-hook.ts`), `PascalCase` for components (`ComponentName.tsx`).
- **Directories**: `kebab-case`.
- **Components**: `PascalCase`.
- **Hooks**: `useCamelCase`.

## Component Structure

- Colocate related components within feature directories.
- Use `export default` for pages, named exports for components.
- Keep components small and focused.

## Hook Placement

- **Feature-specific hooks**: Place in `components/features/[feature]/hooks/`.
- **Shared hooks**: Place in `apps/web/hooks/` or `packages/shared/src/api/hooks/` if API-related.

## State Management

- **Local State**: Use `useState` or `useReducer`.
- **Global State**: Use Zustand stores in `apps/web/stores/`.
- **Server State**: Use React Query (TanStack Query) via custom hooks.

## Testing

- **Unit Tests**: Place test files alongside code or in `tests/` directory.
- **Naming**: `[filename].test.ts` or `[filename].test.tsx`.
- **Runner**: `bun test`.
