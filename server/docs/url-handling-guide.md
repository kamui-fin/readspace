# URL Handling & Deduplication Guide

## Overview

This document explains how URLs are handled throughout the feed system, including normalization, transformation, and deduplication strategies.

## URL Flow

### 1. User Input → Storage
```
User enters: rsshub://twitter/user/elonmusk
              ↓
resolve_feed_url() → rsshub://twitter/user/elonmusk (no HTTP resolution)
              ↓
normalize_feed_url() → rsshub://twitter/user/elonmusk (normalized)
              ↓
Stored in DB: rsshub://twitter/user/elonmusk
```

### 2. Storage → Fetching
```
DB URL: rsshub://twitter/user/elonmusk
              ↓
fetch_feed_content() calls transform_rsshub_url()
              ↓
Actual HTTP request: http://localhost:1200/twitter/user/elonmusk
```

### 3. Regular HTTP URLs
```
User enters: http://example.com/feed?utm_source=twitter
              ↓
resolve_feed_url() → https://example.com/feed (follows redirects)
              ↓
normalize_feed_url() → https://example.com/feed (strips tracking params)
              ↓
Stored in DB: https://example.com/feed
```

## Key Functions

### `normalize_feed_url(url: str) -> str`
**Purpose**: Standardize URLs for deduplication BEFORE storing in database

**What it does**:
- Preserves `rsshub://` scheme as-is
- Forces HTTPS for `http://` URLs
- Lowercases domain names
- Strips tracking parameters (utm_*, fbclid, etc.)
- Removes trailing slashes

**When to use**: Before storing feed URLs in database

**Example**:
```python
normalize_feed_url("HTTP://Example.COM/feed/?utm_source=twitter")
# Returns: "https://example.com/feed"

normalize_feed_url("rsshub://twitter/user/elonmusk/")
# Returns: "rsshub://twitter/user/elonmusk"
```

### `transform_rsshub_url(url: str) -> str`
**Purpose**: Convert `rsshub://` URLs to actual HTTP URLs for fetching

**What it does**:
- Replaces `rsshub://` with configured RSShub base URL
- Leaves regular HTTP/HTTPS URLs unchanged

**When to use**: In `fetch_feed_content()` before making HTTP request

**Example**:
```python
# With RSSHUB_URL=http://localhost:1200
transform_rsshub_url("rsshub://twitter/user/elonmusk")
# Returns: "http://localhost:1200/twitter/user/elonmusk"

transform_rsshub_url("https://example.com/feed")
# Returns: "https://example.com/feed" (unchanged)
```

### `resolve_feed_url(url: str) -> str`
**Purpose**: Follow HTTP redirects to find canonical URL

**What it does**:
- For `rsshub://` URLs: returns normalized URL (no HTTP resolution)
- For HTTP URLs: follows redirects and returns final URL
- Normalizes the result

**When to use**: When adding new feeds (before checking if feed exists)

**Example**:
```python
await resolve_feed_url("http://feedproxy.google.com/example")
# Returns: "https://example.com/feed" (after following redirects)

await resolve_feed_url("rsshub://twitter/user/elonmusk")
# Returns: "rsshub://twitter/user/elonmusk" (no HTTP resolution)
```

## Deduplication Strategy

### Feed-Level Deduplication
**Goal**: Prevent duplicate feeds with slightly different URLs

**Method**: Normalize URLs before storing
```python
# These all become the same feed:
"http://example.com/feed"
"https://example.com/feed/"
"HTTPS://EXAMPLE.COM/feed?utm_source=twitter"
# All normalize to: "https://example.com/feed"
```

### Article-Level Deduplication
**Goal**: Prevent duplicate articles within a feed

**Method**: Use `guid_hash` (hash of RSS GUID field)

**Why not just use article URL?**
- RSS GUID can be anything (URL, URN, random string)
- Same article might have different GUIDs across different feeds
- GUID is the official RSS deduplication mechanism

**Example**:
```xml
<!-- RSS Feed -->
<item>
  <guid>urn:uuid:1234-5678-90ab-cdef</guid>  <!-- Not a URL! -->
  <link>https://example.com/article-1</link>
</item>
```

We hash the GUID to create `guid_hash` for deduplication within the feed.

### Content-Level Deduplication
**Goal**: Detect if the same article appears across multiple feeds

**Method**: Use `content_hash` (hash of article URL)

**Example**:
```python
# Feed A and Feed B both link to same article
content_hash = hash("https://example.com/article-1")
# Can detect cross-feed duplicates
```

## Best Practices

### RSS Feed Readers Typically:
1. ✅ Normalize URLs before storage (prevent duplicates)
2. ✅ Use GUID for article deduplication (RSS spec)
3. ✅ Strip tracking parameters (privacy + deduplication)
4. ✅ Follow redirects to find canonical URLs
5. ✅ Force HTTPS when possible (security)

### Our Implementation:
- ✅ All of the above
- ✅ Plus: RSShub URL support with `rsshub://` scheme
- ✅ Plus: Content hash for cross-feed deduplication

## Security Validation

The `validate_feed_url_security()` function prevents:
- Private IP addresses (SSRF protection)
- Localhost access (SSRF protection)
- Invalid schemes (only http/https/rsshub allowed)

**Note**: RSShub URLs bypass security checks since they're internal routing.
