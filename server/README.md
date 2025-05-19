# Readspace Backend API Documentation

## 1. Introduction

Welcome to the Readspace Backend API documentation. This document provides an overview of the API, its architecture, setup instructions, and detailed endpoint references. It is intended for frontend developers integrating with the API and new backend developers joining the project.

The backend is built using FastAPI (Python) and provides a robust set of features for an RSS feed reader application.

## 2. Project Setup

### 2.1. Prerequisites

*   Python 3.10+
*   Poetry (for dependency management - recommended) or pip
*   PostgreSQL database
*   Redis server (for caching and Celery message broker/result backend)
*   Access to environment variables (see `server/app/core/config.py` and `.env.example`)

### 2.2. Installation

1.  **Clone the repository.**
2.  **Navigate to the `server/` directory.**
3.  **Set up environment variables:**
    *   Copy `.env.example` to `.env`.
    *   Fill in the required values in `.env` (DATABASE_URL, REDIS_URL, CELERY_BROKER_URL, CELERY_RESULT_BACKEND, SECRET_KEY, etc.).
    *   Ensure your PostgreSQL database URL is correctly configured (e.g., `postgresql+asyncpg://user:password@host:port/dbname`).
    *   Ensure your Redis URL is correctly configured (e.g., `redis://host:port/0`).
4.  **Install dependencies:**
    *   Using Poetry: `poetry install`
    *   Using pip: `pip install -r requirements.txt` (You may need to generate `requirements.txt` from `pyproject.toml` first: `poetry export -f requirements.txt --output requirements.txt --without-hashes`)
5.  **Run database migrations:**
    *   Ensure Alembic is configured correctly (see `server/alembic.ini` and `server/app/db/base.py`).
    *   From the `server/` directory, run: `alembic upgrade head`

### 2.3. Running the Server

From the `server/` directory:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.

### 2.4. Running Celery Workers

Celery is used for background tasks, primarily for fetching and refreshing RSS feeds.

1.  **Run the Celery worker:**
    From the `server/` directory:
    ```bash
    celery -A app.core.celery_app.celery worker -l info -P gevent # Or -P solo for local dev without gevent
    ```

2.  **Run Celery Beat (for scheduled tasks):**
    From the `server/` directory:
    ```bash
    celery -A app.core.celery_app.celery beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler # If using DB scheduler
    # OR, if using the schedule defined in celery_app.py:
    celery -A app.core.celery_app.celery beat -l info
    ```
    The `celery_app.py` is configured to schedule `schedule_all_feed_refreshes_task` every 15 minutes.

## 3. Backend Architecture

### 3.1. FastAPI

*   **Framework:** FastAPI is used for building the RESTful API endpoints. It provides high performance, automatic data validation (via Pydantic), and interactive API documentation (Swagger UI/ReDoc).
*   **Routing:** API routes are organized into modules within `server/app/routers/`. The main router in `server/app/routers/__init__.py` aggregates these specific routers. All API routes are prefixed with `/api`. RSS-specific routes are further prefixed with `/rss`.
*   **Services:** Business logic is encapsulated in service classes, primarily `server/app/services/rss_service.py`. Services use CRUD modules for database interactions.
*   **CRUD Layer:** Database operations (Create, Read, Update, Delete) are handled by functions in `server/app/crud/`. These functions interact directly with SQLAlchemy models.
*   **Schemas (Pydantic):** Request and response data models are defined using Pydantic in `server/app/schemas/`. This ensures data validation and serialization.

### 3.2. SQLAlchemy

*   **ORM:** SQLAlchemy is used as the Object-Relational Mapper for interacting with the PostgreSQL database.
*   **Asynchronous Operations:** The database sessions and CRUD operations are asynchronous, using `asyncpg` and `AsyncSession`.
*   **Models:** Database table structures are defined as SQLAlchemy models in `server/app/models/`. Key RSS models include `Folder`, `Tag`, `Feed`, and `Article`.
*   **Migrations:** Alembic is used for database schema migrations. Migration scripts are located in `server/alembic/versions/`.

### 3.3. Celery

*   **Background Tasks:** Celery is used for handling long-running or periodic background tasks, such as fetching new feed data and refreshing existing feeds.
*   **Tasks:** Task definitions are in `server/app/workers/tasks.py`.
    *   `refresh_single_feed_task`: Refreshes a specific feed.
    *   `schedule_all_feed_refreshes_task`: Periodically checks for feeds needing a refresh and dispatches individual refresh tasks.
*   **Broker & Backend:** Redis is used as both the message broker and the result backend for Celery.
*   **Scheduling (Celery Beat):** Celery Beat is used to run `schedule_all_feed_refreshes_task` periodically (configured in `server/app/core/celery_app.py`).

### 3.4. Redis

*   **Caching:** Redis is used for caching feed content to reduce redundant network requests and improve performance. The `RedisCache` utility is in `server/app/core/redis_cache.py`.
    *   `_fetch_feed_content` in `RssService` uses Redis to cache raw feed responses.
    *   It supports conditional GETs using ETag and Last-Modified headers.
*   **Celery:** As mentioned above, Redis also serves as the broker and result backend for Celery.

### 3.5. Authentication

*   **Method:** Bearer Token Authentication.
*   **Token Data:** After successful authentication, the backend expects a JWT Bearer token in the `Authorization` header. The decoded token (conforming to `TokenData` schema in `server/app/schemas/auth.py`) provides user information, specifically `user.sub` (user ID as UUID) and `user.email`.
*   **Dependencies:** The `get_current_user` dependency (in `server/app/services/auth.py`) is used in API endpoints to protect routes and retrieve authenticated user data.

## 4. API Endpoint Reference

All API endpoints are prefixed with `/api`. All RSS-related endpoints under this are further prefixed with `/rss`.

**Authentication:** Unless otherwise specified, all endpoints require a valid JWT Bearer token in the `Authorization` header.
`Authorization: Bearer <your_jwt_token>`

---

### 4.1. RSS Folders

Base Path: `/api/rss/folders/`

*   **POST `/`**
    *   **Description:** Create a new folder.
    *   **Request Body:** `FolderCreate`
        ```json
        {
          "name": "Tech News"
        }
        ```
    *   **Response Body:** `FolderResponse`
    *   **Status Codes:** 201 (Created), 400 (Bad Request - e.g., duplicate name), 401 (Unauthorized)

*   **GET `/`**
    *   **Description:** List all folders for the current user.
    *   **Query Parameters:**
        *   `skip` (int, optional, default: 0): Number of folders to skip.
        *   `limit` (int, optional, default: 100): Maximum number of folders to return.
    *   **Response Body:** `List[FolderResponse]`
    *   **Status Codes:** 200 (OK), 401 (Unauthorized)

*   **GET `/{folder_id}`**
    *   **Description:** Get a specific folder by its ID.
    *   **Path Parameters:** `folder_id` (UUID)
    *   **Response Body:** `FolderResponse`
    *   **Status Codes:** 200 (OK), 401 (Unauthorized), 404 (Not Found)

*   **PUT `/{folder_id}`**
    *   **Description:** Update a folder's details.
    *   **Path Parameters:** `folder_id` (UUID)
    *   **Request Body:** `FolderUpdate`
        ```json
        {
          "name": "Technology Updates"
        }
        ```
    *   **Response Body:** `FolderResponse`
    *   **Status Codes:** 200 (OK), 400 (Bad Request - e.g., duplicate name), 401 (Unauthorized), 404 (Not Found)

*   **DELETE `/{folder_id}`**
    *   **Description:** Delete a folder. The folder must not contain any feeds.
    *   **Path Parameters:** `folder_id` (UUID)
    *   **Response Body:** None
    *   **Status Codes:** 204 (No Content), 400 (Bad Request - e.g., folder not empty), 401 (Unauthorized), 404 (Not Found)

---

### 4.2. RSS Tags

Base Path: `/api/rss/tags/`

*   **POST `/`**
    *   **Description:** Create a new tag. Tag names are case-insensitive and normalized to lowercase.
    *   **Request Body:** `TagCreate`
        ```json
        {
          "name": "python"
        }
        ```
    *   **Response Body:** `TagResponse`
    *   **Status Codes:** 201 (Created), 400 (Bad Request - e.g., duplicate name), 401 (Unauthorized)

*   **GET `/`**
    *   **Description:** List all tags for the current user.
    *   **Query Parameters:**
        *   `skip` (int, optional, default: 0): Number of tags to skip.
        *   `limit` (int, optional, default: 100): Maximum number of tags to return.
    *   **Response Body:** `List[TagResponse]`
    *   **Status Codes:** 200 (OK), 401 (Unauthorized)

*   **GET `/{tag_id}`**
    *   **Description:** Get a specific tag by its ID.
    *   **Path Parameters:** `tag_id` (UUID)
    *   **Response Body:** `TagResponse`
    *   **Status Codes:** 200 (OK), 401 (Unauthorized), 404 (Not Found)

*   **PUT `/{tag_id}`**
    *   **Description:** Update a tag's details. Name is normalized.
    *   **Path Parameters:** `tag_id` (UUID)
    *   **Request Body:** `TagUpdate`
        ```json
        {
          "name": "Python Programming"
        }
        ```
    *   **Response Body:** `TagResponse`
    *   **Status Codes:** 200 (OK), 400 (Bad Request - e.g., duplicate name), 401 (Unauthorized), 404 (Not Found)

*   **DELETE `/{tag_id}`**
    *   **Description:** Delete a tag.
    *   **Path Parameters:** `tag_id` (UUID)
    *   **Response Body:** None
    *   **Status Codes:** 204 (No Content), 401 (Unauthorized), 404 (Not Found)

---

### 4.3. RSS Feeds

Base Path: `/api/rss/feeds/`

*   **POST `/`**
    *   **Description:** Add a new RSS feed by URL. The backend will attempt to fetch and parse the feed to store initial metadata and articles.
    *   **Request Body:** `FeedCreate`
        ```json
        {
          "url": "http://example.com/rss",
          "folder_id": "uuid-of-folder",
          "tag_ids": ["uuid-of-tag1", "uuid-of-tag2"] // Optional
        }
        ```
    *   **Response Body:** `FeedResponse`
    *   **Status Codes:** 201 (Created), 400 (Bad Request - e.g., invalid URL, folder/tag not found, duplicate feed URL for user), 401 (Unauthorized), 503 (Service Unavailable - if feed URL is unreachable)

*   **GET `/`**
    *   **Description:** List feeds for the current user with optional filtering.
    *   **Query Parameters:**
        *   `folder_id` (UUID, optional): Filter by folder ID.
        *   `tag_names` (List[str], optional): Filter by a list of tag names (case-insensitive, matches all provided tags).
        *   `is_favorite` (bool, optional): Filter by favorite status.
        *   `search_query` (str, optional): Search query for feed titles.
        *   `skip` (int, optional, default: 0)
        *   `limit` (int, optional, default: 100)
    *   **Response Body:** `List[FeedResponse]`
    *   **Status Codes:** 200 (OK), 401 (Unauthorized)

*   **GET `/{feed_id}`**
    *   **Description:** Get a specific feed by its ID.
    *   **Path Parameters:** `feed_id` (UUID)
    *   **Response Body:** `FeedResponse`
    *   **Status Codes:** 200 (OK), 401 (Unauthorized), 404 (Not Found)

*   **PUT `/{feed_id}`**
    *   **Description:** Update a feed's user-configurable settings (folder, tags, favorite status, title override).
    *   **Path Parameters:** `feed_id` (UUID)
    *   **Request Body:** `FeedUpdate`
        ```json
        {
          "folder_id": "new-uuid-of-folder", // Optional
          "tag_ids": ["new-uuid-of-tag1"],   // Optional, replaces existing tags
          "is_favorite": true,               // Optional
          "title": "My Custom Feed Title"    // Optional
        }
        ```
    *   **Response Body:** `FeedResponse`
    *   **Status Codes:** 200 (OK), 400 (Bad Request), 401 (Unauthorized), 404 (Not Found)

*   **POST `/{feed_id}/refresh`**
    *   **Description:** Manually trigger a refresh of a specific feed.
    *   **Path Parameters:** `feed_id` (UUID)
    *   **Query Parameters:**
        *   `force_refetch` (bool, optional, default: false): Force refetch even if not modified based on ETag/Last-Modified.
    *   **Response Body:** `FeedResponse`
    *   **Status Codes:** 200 (OK), 401 (Unauthorized), 404 (Not Found), 503 (Service Unavailable)

*   **DELETE `/{feed_id}`**
    *   **Description:** Delete a feed. Associated articles will also be deleted.
    *   **Path Parameters:** `feed_id` (UUID)
    *   **Response Body:** None
    *   **Status Codes:** 204 (No Content), 401 (Unauthorized), 404 (Not Found)

---

### 4.4. RSS Articles

Base Path: `/api/rss/articles/`

*   **GET `/`**
    *   **Description:** List articles with filtering, sorting, and pagination.
    *   **Query Parameters:**
        *   `feed_ids` (List[UUID], optional): Filter by specific feed IDs.
        *   `folder_id` (UUID, optional): Filter by folder ID.
        *   `is_read` (bool, optional): Filter by read status.
        *   `is_read_later` (bool, optional): Filter by read later status.
        *   `is_favorite` (bool, optional): Filter by article favorite status.
        *   `feed_is_favorite` (bool, optional): Filter by parent feed's favorite status.
        *   `published_since` (datetime, optional, ISO format): Filter articles published since this UTC datetime.
        *   `published_until` (datetime, optional, ISO format): Filter articles published until this UTC datetime.
        *   `search_query` (str, optional): Search query for article title and description.
        *   `sort_by` (str, optional, default: "published_at"): Sort by "published_at", "created_at", "read_at", "title".
        *   `sort_order` (str, optional, default: "desc"): Sort order "asc" or "desc".
        *   `page` (int, optional, default: 1): Page number for pagination.
        *   `size` (int, optional, default: 20): Number of items per page (max 100).
    *   **Response Body:** `PaginatedResponse[ArticleResponse]`
    *   **Status Codes:** 200 (OK), 400 (Bad Request - e.g., invalid sort parameters), 401 (Unauthorized)

*   **GET `/recently_read`**
    *   **Description:** Get recently read articles.
    *   **Query Parameters:** `page` (int), `size` (int)
    *   **Response Body:** `PaginatedResponse[ArticleResponse]`
    *   **Status Codes:** 200 (OK), 401 (Unauthorized)

*   **GET `/read_later`**
    *   **Description:** Get articles marked for "read later".
    *   **Query Parameters:** `page` (int), `size` (int)
    *   **Response Body:** `PaginatedResponse[ArticleResponse]`
    *   **Status Codes:** 200 (OK), 401 (Unauthorized)

*   **GET `/unread_counts`**
    *   **Description:** Get unread article counts (total, and by folder if `folder_id` is not specified).
    *   **Query Parameters:** `folder_id` (UUID, optional)
    *   **Response Body:** `Dict[str, Any]`
        ```json
        // Example without folder_id
        {
          "total_unread": 150,
          "unread_by_folder": [
            {"folder_id": "uuid1", "name": "Tech", "unread_count": 70},
            {"folder_id": "uuid2", "name": "News", "unread_count": 80}
          ]
        }
        // Example with folder_id
        {
          "total_unread": 150, // Overall total still provided
          "folder_unread": {"folder_id": "uuid1", "name": "Tech", "count": 70}
        }
        ```
    *   **Status Codes:** 200 (OK), 401 (Unauthorized)

*   **GET `/{article_id}`**
    *   **Description:** Get a specific article by its ID.
    *   **Path Parameters:** `article_id` (UUID)
    *   **Response Body:** `ArticleResponse`
    *   **Status Codes:** 200 (OK), 401 (Unauthorized), 404 (Not Found)

*   **PUT `/{article_id}`**
    *   **Description:** Update an article's status (e.g., `is_read`, `is_read_later`, `is_favorite`).
    *   **Path Parameters:** `article_id` (UUID)
    *   **Request Body:** `ArticleUpdate`
        ```json
        {
          "is_read": true,
          "read_at": "2023-01-01T12:00:00Z", // Optional, set automatically if is_read becomes true
          "is_read_later": false,
          "is_favorite": true
        }
        ```
    *   **Response Body:** `ArticleResponse`
    *   **Status Codes:** 200 (OK), 401 (Unauthorized), 404 (Not Found)

*   **POST `/bulk_update`**
    *   **Description:** Bulk update status of multiple articles.
    *   **Request Body:** `ArticleBulkUpdateRequest`
        ```json
        {
          "article_ids": ["uuid1", "uuid2"],
          "action": "mark_as_read" // e.g., "mark_as_read", "mark_as_unread", "mark_as_read_later", "unmark_as_read_later", "mark_as_favorite", "unmark_as_favorite"
        }
        ```
    *   **Response Body:** `Dict[str, int]` (e.g., `{"affected_articles": 2}`)
    *   **Status Codes:** 200 (OK), 400 (Bad Request - e.g. invalid action), 401 (Unauthorized)

---

### 4.5. RSS OPML

Base Path: `/api/rss/opml/`

*   **POST `/import/`**
    *   **Description:** Import feeds from an OPML file.
    *   **Request Body:** `multipart/form-data`
        *   `opml_file` (File): The OPML file (.opml, .xml).
        *   `default_folder_name` (str, optional, default: "Imported Feeds"): Name for the default folder for feeds.
    *   **Response Body:** `Dict[str, Any]` (Import summary)
        ```json
        {
          "imported_count": 10,
          "failed_count": 2,
          "errors": [
            {"url": "http://badfeed.com/rss", "title": "Bad Feed", "error": "Could not fetch feed content."}
          ]
        }
        ```
    *   **Status Codes:** 200 (OK), 400 (Bad Request - e.g. invalid file, parse error), 401 (Unauthorized)

*   **GET `/export/`**
    *   **Description:** Export all user feeds to an OPML file.
    *   **Response Body:** `PlainTextResponse` (XML content with `application/xml` media type and `Content-Disposition` header for download).
    *   **Status Codes:** 200 (OK), 401 (Unauthorized)

---

### 4.6. Other Endpoints

Base Path: `/api/`

*   **GET `/health`**
    *   **Description:** Health check endpoint. Does not require authentication.
    *   **Response Body:** `{"status": "ok"}`
    *   **Status Codes:** 200 (OK)

*   **GET `/user-info`**
    *   **Description:** Returns information about the currently authenticated user.
    *   **Response Body:** `{"user_id": "uuid", "email": "user@example.com", "metadata": {}}`
    *   **Status Codes:** 200 (OK), 401 (Unauthorized)

*   **POST `/upload/...`**
    *   **Description:** Endpoints related to file uploads (if any, further defined in `upload.router`). This documentation focuses on RSS. The base path is `/api/upload`. (Details TBD based on `upload.router` specifics).

## 5. Key Functionality Details

### 5.1. Feed Fetching and Parsing

*   The `RssService` handles fetching feed content using `httpx` (asynchronously).
*   It supports conditional GET requests using ETag and Last-Modified headers to save bandwidth and processing.
*   Fetched content is parsed using the `feedparser` library.
*   Feed metadata (title, description, language, image) and article data are extracted.
*   **Caching:** Raw feed responses (content text and headers) are cached in Redis to reduce network requests. Stale data might be served if network errors occur while fresh data is unavailable.

### 5.2. Article Processing

*   **Image Extraction (`_find_best_article_image`):** The service attempts to find a representative image for each article by looking at `media_content`, `enclosures`, and parsing the HTML content for `<img>` tags (using BeautifulSoup and a regex fallback). This is a best-effort process.
*   **Estimated Read Time (`_calculate_estimated_read_time`):** Calculated based on word count (words per minute, currently 230 wpm). HTML is stripped from content before counting.

### 5.3. OPML Import/Export

*   **Import:** Supports standard OPML files. Recursively processes outlines, creates folders (handles nesting based on outline structure), and adds feeds. Tags can be extracted from the `category` attribute of feed outlines (comma-separated).
*   **Export:** Generates an OPML 2.0 file containing all the user's feeds, organized by their folders. Tags are included as `category` attributes.

### 5.4. Background Refresh Logic

*   **Celery Beat:** The `schedule_all_feed_refreshes_task` runs periodically (every 15 minutes).
*   **`get_feeds_needing_refresh`:** This CRUD method identifies feeds that should be checked for updates. It prioritizes:
    1.  Feeds never fetched.
    2.  Feeds with fetch errors (with exponential backoff).
    3.  Feeds whose TTL (or a default interval) has expired since `last_fetched_at`.
    4.  It respects `skipHours` and `skipDays` from the feed's metadata.
*   **`refresh_single_feed_task`:** Individual tasks are dispatched to refresh each identified feed. This task updates feed metadata and fetches new articles.

## 6. Directory Structure (Server App)

A brief overview of the `server/app/` directory:

*   `core/`: Core application settings, Celery app, Redis cache utility.
*   `crud/`: Database Create, Read, Update, Delete operations.
*   `db/`: Database session management, base model class.
*   `models/`: SQLAlchemy database models.
*   `routers/`: FastAPI API endpoint definitions (routers).
*   `schemas/`: Pydantic data validation schemas.
*   `services/`: Business logic layer.
*   `workers/`: Celery task definitions.
*   `main.py`: Main FastAPI application instance and startup/shutdown events.

## 7. Contributing

(Placeholder for future contribution guidelines, coding standards, testing procedures, etc.)

---

This document should serve as a good starting point. It can be expanded with more detailed examples or diagrams as needed. 