# Meilisearch AI-Powered Search Setup

This document explains how AI-powered semantic search is configured in Readspace using Meilisearch with Gemini embeddings.

## Overview

Readspace uses Meilisearch's REST embedder feature to automatically generate embeddings for feed documents using Google's Gemini API. This enables hybrid search that combines traditional keyword matching with semantic similarity.

## Configuration

### Embedder Setup

The Meilisearch index is configured with a REST embedder that calls Gemini's `text-embedding-004` model:

```python
"embedders": {
    "default": {
        "source": "rest",
        "url": "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent",
        "apiKey": GEMINI_API_KEY,
        "dimensions": 768,
        "documentTemplate": "{{doc.title}} {{doc.description}}",
        "request": {
            "content": {
                "parts": [
                    {"text": "{{text}}"}
                ]
            },
            "taskType": "RETRIEVAL_DOCUMENT",
            "outputDimensionality": 768
        },
        "response": {
            "embedding": "{{embedding.values}}"
        },
        "headers": {
            "x-goog-api-key": GEMINI_API_KEY
        }
    }
}
```

### Key Features

1. **Automatic Embedding Generation**: Meilisearch automatically generates embeddings when documents are indexed
2. **Document Template**: Combines feed title and description for embedding generation
3. **Task Type**: Uses `RETRIEVAL_DOCUMENT` for optimal document indexing
4. **Dimensions**: 768-dimensional embeddings (recommended by Gemini for good quality/performance balance)

## How It Works

### Document Indexing

When a feed is indexed in Meilisearch:

1. Meilisearch extracts the `title` and `description` fields based on the `documentTemplate`
2. It sends a request to Gemini's API with the combined text
3. Gemini returns a 768-dimensional embedding vector
4. Meilisearch stores the embedding internally for vector search

### Search Queries

The frontend can perform two types of searches:

#### 1. Keyword Search (Traditional)

```javascript
const results = await searchClient.search({
  indexName: 'feeds',
  query: 'javascript tutorials'
});
```

#### 2. Hybrid Search (Keyword + Semantic)

```javascript
const results = await searchClient.search({
  indexName: 'feeds',
  query: 'javascript tutorials',
  hybrid: {
    semanticRatio: 0.5,  // 50% semantic, 50% keyword
    embedder: 'default'
  }
});
```

The `semanticRatio` parameter controls the balance:
- `0.0` = Pure keyword search
- `0.5` = Balanced hybrid search (recommended)
- `1.0` = Pure semantic search

## Frontend Integration

### Using React InstantSearch

The discover page uses React InstantSearch with hybrid search:

```typescript
import { InstantSearch, Configure } from 'react-instantsearch';
import { searchClient } from '@/lib/meilisearch-client';

function DiscoverPage() {
  return (
    <InstantSearch
      searchClient={searchClient}
      indexName="feeds"
    >
      <Configure
        hybrid={{
          semanticRatio: 0.5,
          embedder: 'default'
        }}
      />
      {/* Search components */}
    </InstantSearch>
  );
}
```

### Direct Meilisearch Client

For custom searches (like similar documents):

```typescript
import { meilisearchClient } from '@/lib/meilisearch-client';

const results = await meilisearchClient
  .index('feeds')
  .search('machine learning', {
    hybrid: {
      semanticRatio: 0.8,  // More semantic for similarity
      embedder: 'default'
    },
    limit: 20
  });
```

## Benefits

1. **Better Search Results**: Understands semantic meaning, not just keywords
2. **Typo Tolerance**: Semantic search helps find relevant results even with typos
3. **Synonym Handling**: Finds "ML" when searching for "machine learning"
4. **Context Awareness**: Understands related concepts and topics
5. **No Backend Overhead**: Meilisearch handles embedding generation automatically

## Environment Variables

Required environment variables:

```bash
# Gemini API Key (used by Meilisearch for embeddings)
GEMINI_API_KEY=your_gemini_api_key

# Meilisearch Configuration
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_MASTER_KEY=your_master_key
MEILISEARCH_INDEX_NAME=feeds

# Frontend (for direct Meilisearch access)
NEXT_PUBLIC_MEILISEARCH_URL=http://localhost:7700
NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY=your_search_key
```

## Performance Considerations

1. **Embedding Generation**: Happens asynchronously during indexing
2. **Search Speed**: Hybrid search is fast (typically <100ms)
3. **API Costs**: Gemini charges per embedding generated (only during indexing)
4. **Caching**: Embeddings are cached in Meilisearch, no re-generation needed

## Troubleshooting

### Embeddings Not Generated

Check Meilisearch logs for API errors:
```bash
docker logs meilisearch
```

Common issues:
- Invalid Gemini API key
- API rate limits exceeded
- Network connectivity issues

### Search Not Using Embeddings

Verify the embedder is configured:
```bash
curl -X GET 'http://localhost:7700/indexes/feeds/settings/embedders' \
  -H 'Authorization: Bearer YOUR_MASTER_KEY'
```

### Hybrid Search Not Working

Ensure you're passing the `hybrid` parameter in search requests and that the frontend has the correct Meilisearch search key.

## References

- [Meilisearch REST Embedder Documentation](https://www.meilisearch.com/docs/learn/ai_powered_search/configure_rest_embedder)
- [Gemini Embeddings API](https://ai.google.dev/gemini-api/docs/embeddings)
- [Meilisearch Hybrid Search](https://www.meilisearch.com/docs/learn/ai_powered_search/hybrid_search)
