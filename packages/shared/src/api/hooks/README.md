# API Hooks

This directory contains React Query hooks for interacting with the ReadSpace API.

## Structure

- `use-articles.ts`: Hooks for fetching and modifying articles (infinite lists, updates, etc.).
- `use-feeds.ts`: Hooks for feed management (subscribe, unsubscribe, update).
- `use-folders.ts`: Hooks for folder management.
- `use-opml.ts`: Hooks for OPML import/export.
- `index.ts`: Exports all hooks.

## Key Concepts

### Query Keys
All query keys are generated using helper functions in `../query-keys.ts`. This ensures consistency and type safety.
**Always** use `queryKeys.something(...)` instead of manually creating arrays.

### Optimistic Updates
Mutations use optimistic updates to provide immediate UI feedback.
- **Single Item Updates**: `queryClient.setQueryData` is used to update individual items.
- **List Updates**: `queryClient.getQueriesData` is used to iterate over relevant lists (e.g., infinite feeds) and update items within them.
- **Rollback**: `onMutate` returns a context with previous data, which is used in `onError` to rollback changes.

### Invalidation
We use targeted invalidation to minimize network requests.
- Only invalidate what truly changes.
- Use `predicate` functions for complex invalidation logic (e.g., invalidating all "check" queries).

## Usage Example

```typescript
import { useInfiniteArticles, useUpdateArticle } from "@readspace/shared";

// Fetch articles
const { data, fetchNextPage } = useInfiniteArticles({ folderId: "123" });

// Update article
const { mutate } = useUpdateArticle();
mutate({ 
  articleId: "abc", 
  data: { is_read: true } 
});
```
