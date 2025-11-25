# Deduplication Strategy Explained

## Three Levels of Deduplication

### 1. Feed-Level (Prevent Duplicate Feed Subscriptions)
**Hash**: Normalized URL
**Purpose**: Ensure users don't subscribe to the same feed twice

```python
# These are all the SAME feed:
"http://example.com/feed"
"https://example.com/feed/"
"HTTPS://EXAMPLE.COM/feed?utm_source=twitter"

# All normalize to:
"https://example.com/feed"
```

**Implementation**: `normalize_feed_url()` before storing in `feeds` table

---

### 2. Article-Level Within Feed (Prevent Duplicate Articles in Same Feed)
**Hash**: `guid_hash` (SHA-256 of RSS GUID)
**Purpose**: Deduplicate articles within a single feed

**Why GUID instead of URL?**
RSS GUID is the official unique identifier. It can be:
- A URL: `<guid>https://example.com/article-1</guid>`
- A URN: `<guid>urn:uuid:1234-5678-90ab-cdef</guid>`
- Any string: `<guid>article-1-2024-11-25</guid>`

**Example**:
```xml
<item>
  <guid>urn:uuid:1234-5678</guid>  <!-- Not a URL! -->
  <link>https://example.com/article</link>
</item>
```

**Implementation**: 
- `get_guid_hash()` in `app/utils/text.py`
- Stored in `feed_articles.guid_hash`
- Unique constraint: `(feed_id, guid_hash)`

---

### 3. Content-Level Across Feeds (Detect Same Article in Multiple Feeds)
**Hash**: `content_hash` (SHA-256 of article URL)
**Purpose**: Detect when the same article appears in multiple feeds

**Example**:
```
Feed A (TechCrunch) → Article: https://example.com/post-1
Feed B (HackerNews) → Article: https://example.com/post-1

Both have same content_hash → Can detect duplicate
```

**Implementation**:
- `get_content_hash()` in `app/utils/text.py`
- Stored in `article_contents.content_hash`
- Unique constraint on `content_hash`

---

## Why Not Just Use Article URL for Everything?

1. **RSS GUID is the spec**: RSS standard defines GUID as the unique identifier
2. **GUIDs aren't always URLs**: Can be URNs, UUIDs, or arbitrary strings
3. **URLs can change**: Article might move, but GUID stays the same
4. **Cross-feed detection**: Need separate hash for URL-based deduplication

---

## Database Schema

```sql
-- Feed-level deduplication
CREATE TABLE feeds (
    url TEXT UNIQUE  -- Normalized URL
);

-- Article-level within feed
CREATE TABLE feed_articles (
    feed_id UUID,
    guid_hash TEXT,
    UNIQUE(feed_id, guid_hash)  -- Dedupe within feed
);

-- Content-level across feeds
CREATE TABLE article_contents (
    content_hash TEXT UNIQUE  -- Dedupe across feeds
);
```

---

## Best Practices from RSS Readers

✅ **Feedly, Inoreader, NewsBlur all**:
1. Normalize feed URLs (prevent duplicate subscriptions)
2. Use GUID for article deduplication (RSS spec)
3. Strip tracking parameters (privacy + deduplication)
4. Follow redirects to canonical URLs

✅ **We do all of the above, plus**:
- RSShub URL support (`rsshub://` scheme)
- Content hash for cross-feed deduplication
- SSRF protection for feed URLs
