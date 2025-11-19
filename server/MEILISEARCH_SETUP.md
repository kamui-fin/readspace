# Meilisearch Migration Guide

This document provides comprehensive instructions for setting up and using the Meilisearch integration for feed search in Readspace.

## Overview

Readspace has migrated from PostgreSQL-based search (FTS + pgvector) to **Meilisearch** for improved:
- **Performance**: Sub-100ms search latency
- **Typo Tolerance**: Built-in fuzzy matching
- **Scalability**: Dedicated search infrastructure
- **Developer Experience**: Direct frontend integration
- **AI Search**: Hybrid search combining keywords + semantic embeddings

## Architecture

### Backend
- **Meilisearch Service** (`server/app/services/feeds/search/meilisearch_service.py`)
  - Index management and configuration
  - Document synchronization
  - Vector embedding support for AI search

- **Sync Hooks** - Automatic Meilisearch updates on:
  - Feed creation (`feed_queries.py`)
  - Feed metadata updates (`feed_enrichment.py`)
  - URL migrations (redirect handling)

### Frontend
- **React InstantSearch** integration
- Direct browser-to-Meilisearch communication (no backend proxy)
- AI search toggle with semantic ratio control
- Category and language filtering
- Real-time search as you type

## Setup Instructions

### 1. Start Meilisearch

The Meilisearch service is already configured in `docker-compose.yml`:

```bash
# Start all services including Meilisearch
./docker/launch.sh

# Or start Meilisearch individually
docker compose -f docker/docker-compose.yml up -d meilisearch
```

Verify Meilisearch is running:
```bash
curl http://localhost:7700/health
# Should return: {"status":"available"}
```

### 2. Run the Migration Script

The migration script syncs all existing feeds from PostgreSQL to Meilisearch.

#### Dry Run (recommended first)
```bash
cd server
poetry run python scripts/migrate_feeds_to_meilisearch.py --dry-run
```

This will count feeds without indexing them.

#### Full Migration
```bash
poetry run python scripts/migrate_feeds_to_meilisearch.py
```

**Options:**
- `--dry-run`: Count feeds without indexing
- `--batch-size N`: Process N feeds per batch (default: 1000)

**Example output:**
```
migration_started dry_run=False batch_size=1000
feeds_counted total=15234
processing_batch batch_num=1 total_batches=16 progress=1000/15234
...
migration_completed total_feeds=15234 meilisearch_docs=15234
migration_verified count=15234
```

### 3. Verify the Index

Check index statistics:
```bash
curl -H "Authorization: Bearer readspace_master_key_change_in_production" \
  http://localhost:7700/indexes/feeds/stats
```

Search test:
```bash
curl -X POST http://localhost:7700/indexes/feeds/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer readspace_search_key_change_in_production" \
  --data '{"q": "technology"}'
```

### 4. Configure API Keys (Production)

For production, generate secure API keys:

```bash
# Generate a secure master key
openssl rand -base64 32

# Update docker/.env
MEILISEARCH_MASTER_KEY=<your_secure_master_key>

# Generate a search-only key (read-only)
curl -X POST http://localhost:7700/keys \
  -H "Authorization: Bearer YOUR_MASTER_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "description": "Public search key",
    "actions": ["search"],
    "indexes": ["feeds"],
    "expiresAt": null
  }'
```

Update environment files with the keys:
- `server/.env`: `MEILISEARCH_MASTER_KEY`
- `apps/web/.env`: `NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY`
- `docker/.env`: Both keys

## Features

### Standard Search
- **Keyword search**: Title, description, tags, URL
- **Typo tolerance**: Automatic fuzzy matching
- **Filters**: Category, language
- **Sorting**: By popularity score

### AI-Powered Hybrid Search
When AI search is enabled in the UI:
- **Semantic search**: Uses feed embeddings (768-dim vectors)
- **Hybrid mode**: Combines keyword + semantic search
- **Semantic ratio**: Adjustable balance (0 = keyword only, 1 = semantic only)

### Category Filtering
Predefined categories:
- Technology & Programming
- Artificial Intelligence
- Design & Creativity
- Business & Finance
- News & Politics
- Gaming & Entertainment
- Science & Research
- Lifestyle & Personal
- Culture & Arts
- Security & Privacy
- Education & Learning
- Miscellaneous

### Language Filtering
Supported languages:
- English (en)
- Chinese (zh)
- Japanese (ja)

## Data Synchronization

Feeds are automatically synced to Meilisearch when:

1. **New feed created** → Indexed immediately
2. **Feed metadata updated** → Document updated in Meilisearch
3. **Feed enrichment** (tags, category, embedding) → Document updated
4. **URL migration** (redirect handling) → Document updated with new URL

All sync operations use **fire-and-forget** pattern - failures are logged but don't break the main flow.

## Monitoring

### Index Statistics
```python
from app.services.feeds.search.meilisearch_service import get_meilisearch_service
from app.core.config import Settings

settings = Settings()
meili_service = get_meilisearch_service(settings)
stats = await meili_service.get_index_stats()

print(f"Documents: {stats['number_of_documents']}")
print(f"Indexing: {stats['is_indexing']}")
```

### Health Check
```python
is_healthy = await meili_service.health_check()
```

### Logs
Meilisearch operations are logged with structured logging:
- `meilisearch_index_configured`
- `meilisearch_feed_indexed`
- `meilisearch_batch_indexed`
- `meilisearch_sync_failed` (warnings)

## Troubleshooting

### Issue: Search returns no results
**Solution:**
1. Verify Meilisearch is running: `curl http://localhost:7700/health`
2. Check index exists: `curl http://localhost:7700/indexes/feeds/stats`
3. Re-run migration script if needed

### Issue: Migration script fails
**Possible causes:**
- Meilisearch not running → Start with `docker compose up -d meilisearch`
- Database connection issue → Check `SUPABASE_DB_CONNECTION` in `.env`
- Memory limit → Reduce `--batch-size`

### Issue: Sync hooks failing
Check logs for `meilisearch_sync_failed` warnings. Common causes:
- Meilisearch service down
- Network connectivity
- API key mismatch

## Performance Tuning

### Batch Size
For large migrations, adjust batch size based on available memory:
```bash
# Smaller batches for limited memory
poetry run python scripts/migrate_feeds_to_meilisearch.py --batch-size 500

# Larger batches for faster processing (if memory allows)
poetry run python scripts/migrate_feeds_to_meilisearch.py --batch-size 2000
```

### Index Settings
The index is configured for optimal feed search:
- **Ranking rules**: Words > Typo > Proximity > Attribute > Popularity
- **Typo tolerance**: 1 typo for 4+ chars, 2 typos for 8+ chars
- **Max results**: 1000 (pagination limit)

To modify settings, edit `MeilisearchService.initialize_index()` in `meilisearch_service.py`.

## Frontend Usage

The discover page (`apps/web/app/(protected)/discover/`) now uses React InstantSearch:

```tsx
import { searchClient, FEEDS_INDEX_NAME } from "@/lib/meilisearch-client"
import { InstantSearch, SearchBox, Hits } from "react-instantsearch"

<InstantSearch
  searchClient={searchClient}
  indexName={FEEDS_INDEX_NAME}
>
  <SearchBox />
  <Hits />
</InstantSearch>
```

### AI Search Example
```tsx
<Configure
  hitsPerPage={50}
  hybrid={{
    semanticRatio: 0.5,  // 50% semantic, 50% keyword
    embedder: "default"
  }}
/>
```

## Rollback Plan

If you need to rollback to PostgreSQL search:

1. Restore the old discover client:
```bash
cd apps/web/app/(protected)/discover
mv discover-client.tsx discover-client-meilisearch.tsx
mv discover-client-old.tsx.bak discover-client.tsx
```

2. Restore search endpoints in `server/app/routers/discover.py` from git history

3. Stop Meilisearch (optional):
```bash
docker compose stop meilisearch
```

## Production Checklist

Before deploying to production:

- [ ] Generate secure API keys (not default values)
- [ ] Update all environment files with production keys
- [ ] Run migration script successfully
- [ ] Verify search works in staging environment
- [ ] Set up monitoring for Meilisearch service
- [ ] Configure backup strategy for Meilisearch data volume
- [ ] Test AI search with embeddings
- [ ] Verify all category filters work
- [ ] Test mobile responsive design
- [ ] Load test with expected traffic

## Additional Resources

- [Meilisearch Documentation](https://www.meilisearch.com/docs)
- [React InstantSearch Guide](https://www.meilisearch.com/docs/guides/front_end/react_quick_start)
- [Hybrid Search Documentation](https://www.meilisearch.com/docs/learn/ai_powered_search/getting_started_with_ai_search)
- [Meilisearch Cloud](https://www.meilisearch.com/cloud) - Managed hosting option

## Support

For issues or questions:
1. Check Meilisearch logs: `docker compose logs meilisearch`
2. Check application logs for `meilisearch_*` events
3. Refer to the [troubleshooting section](#troubleshooting)
