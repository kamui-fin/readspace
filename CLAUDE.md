# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Readspace is an open-source, privacy-first reading hub that brings RSS feeds, newsletters, saved articles, Twitter threads, Reddit posts, and books into one clean, distraction-free inbox. It's a full-stack application with a Python FastAPI backend, a Next.js web app, an Expo (iOS/Android) mobile app, and a Chrome/Firefox extension. The hosted product is `app.readspace.ai`; the project is designed for self-hosting via Docker.

## Architecture

### Turborepo Monorepo Structure

The JS/TS workspace is a Turborepo (`bun` package manager, workspaces `apps/*` + `packages/*`). The Python `server/` is **not** part of the workspace and is managed separately with Poetry.

- **`apps/web/`**: Next.js 15 (App Router, React 19) web app — TypeScript, Tailwind v4, shadcn/ui
- **`apps/mobile/`**: Expo / React Native app (iOS + Android). Has its own `apps/mobile/CLAUDE.md` — read it before touching mobile code. Uses Biome (not ESLint) for lint/format, `uniwind` (Tailwind for RN), Expo Router, TanStack Query, Zustand
- **`apps/extension/`**: Manifest V3 Chrome/Firefox extension — Vite + React
- **`apps/inbound/`**: Cloudflare Worker that receives inbound newsletter email (`postal-mime`), extracts a routing token from the `To:` address, and POSTs to the backend `/api/intake/webhook`. Has its own `apps/inbound/AGENTS.md`. Deployed with `wrangler`, tested with Vitest
- **`packages/shared/`**: Utilities, types, and API/query hooks shared across web, mobile, and extension. New API hooks go here — don't duplicate them per-app
- **`packages/design-tokens/`**: Shared color tokens + `theme.css` (Tailwind v4), consumed by web and extension
- **`packages/eslint-config/`**, **`packages/typescript-config/`**: Shared configs
- **`server/`**: Python FastAPI backend (Poetry, separate from the Turborepo)
- **`docker/`**: Compose files and orchestration scripts (`setup.sh`, `launch.sh`, `down.sh`, `promote-admin.sh`)

### Backend Architecture (`server/`)

- **FastAPI** (`fastapi[all]`) with async/await throughout; `orjson` responses
- **PostgreSQL** via SQLAlchemy 2.x async + SQLModel, `asyncpg`, Alembic migrations; `pgvector` for embeddings
- **Supabase** for Postgres hosting and auth — the backend validates Supabase JWTs on protected routes
- **Taskiq** (`taskiq` + `taskiq-redis`) for background tasks — feed fetching, article processing, OPML import. Redis is the broker. This replaced Celery; there is no Celery in the codebase despite older references
- **Meilisearch** (`meilisearch-python-sdk`) powers feed discovery / search (the 10k+ feed search engine)
- **AI**: OpenAI + Google GenAI (`google-genai`) for summaries, translations, similarity
- **Content extraction**: `trafilatura`, `feedparser`, `listparser`, `beautifulsoup4`, `nh3` (sanitization)
- **Observability**: `prometheus-fastapi-instrumentator` (metrics) + `structlog` / `python-json-logger` (structured JSON logs). Grafana + Loki + Alloy configs live in `docker/`
- **Analytics**: PostHog (`posthog`)

Key service patterns:

- Service layer for business logic (`app/services/`)
- CRUD operations abstracted (`app/crud/`); DB session/engine wiring in `app/db/`
- Pydantic schemas in `app/schemas/`, SQLAlchemy/SQLModel models in `app/models/`
- Background tasks in `app/workers/` (registered via `app/workers/registry.py`)

### Frontend Architecture (`apps/web/`)

- **Next.js 15** with App Router and Server Components
- **TypeScript** throughout with strict type checking
- **Tailwind CSS** for styling with shadcn/ui components
- **Zustand** for client-side state management
- **TanStack Query** for server state and caching
- **Supabase Auth** integration with session management

### Browser Extension (`apps/extension/`)

- **Manifest V3** Chrome extension with Firefox compatibility
- **React** with TypeScript
- **Vite** for building with separate Chrome/Firefox targets
- Content script for page analysis and RSS feed detection
- Background service worker for API communication

### Mobile App (`apps/mobile/`)

- **Expo / React Native** with **Expo Router** (routes under `src/app/`)
- **Biome** for lint + format (`bun run lint`, `bun run format`, `bun run check`) — not ESLint/Prettier like the rest of the monorepo (a legacy `lint:eslint` script exists but Biome is primary)
- **`uniwind`** (Tailwind-for-RN) + `clsx` + `cva` for styling; `@legendapp/list` for long lists
- **RevenueCat** (`react-native-purchases`) for subscriptions/paywall; **Sentry** for error tracking
- Build variants via `APP_VARIANT` env (`development` / `preview` / production); EAS config in `eas.json`
- Reuses `@readspace/shared` hooks — do not add new fetch hooks in the app

### Cloudflare Worker (`apps/inbound/`)

- Single Worker entry `src/index.ts` implementing the `email()` handler (not `fetch()`)
- Parses raw MIME, pulls `List-Unsubscribe` / `List-Archive` headers for favicon resolution
- Env: `BACKEND_URL`, `WEBHOOK_SECRET`; bindings declared in `wrangler.jsonc` — run `bun run cf-typegen` after changing them

### Shared Packages (`packages/`)

- **`shared/`**: Common utilities, types, and API/query hooks shared across web, mobile, and extension
- **`design-tokens/`**: Color tokens + `theme.css`; the single source of truth for the palette
- **`eslint-config/`**, **`typescript-config/`**: Centralized ESLint / TypeScript configuration

## Development Commands

### Environment Setup

```bash
# One-time: generate .env files for docker/supabase, docker (Meilisearch keys), apps/web,
# apps/mobile, and server. The --dev flag wires localhost loopback URLs and disables AI,
# with no interactive prompts.
./docker/setup.sh --dev

# Recommended dev flow: run infra (Supabase, Redis, Meilisearch, optional RSSHub) in Docker,
# run the app services (web / api / worker / scheduler) locally for hot reload.
# The `app`-profile containers are skipped under --dev.
./docker/launch.sh --dev

# Full stack in Docker (production-like). Self-hosted ports are offset +10000:
#   web localhost:18042, api localhost:18008, Supabase Studio localhost:18000
./docker/setup.sh && ./docker/launch.sh

# Reset the local Supabase DB (wipes all data)
./docker/supabase/reset.sh
```

Dev ports (services run locally): web `8042`, api `8008`.

### Monorepo Development Commands

```bash
# Install dependencies for all workspaces
bun install

# Build all apps and packages
bun run build

# Start all apps in development mode
bun run dev

# Lint all projects
bun run lint

# Format all code
bun run format

# Type check all projects
bun run check-types

# Clean all build artifacts
turbo run clean
```

### Backend Development (`server/`)

All backend commands run from `server/` and are Poe tasks (`poe <task>` = `poetry run poe <task>`).

```bash
cd server
poetry install
poe start                    # FastAPI dev server with reload (0.0.0.0:8008)
poe worker                   # Taskiq worker (broker: app.core.taskiq_app:broker)
poe scheduler                # Taskiq scheduler (periodic tasks)
poe test                     # Run all tests (tests/)
poe test-unit                # Unit tests only (tests/unit/) — pure logic, no DB
poe test-integration         # Integration tests (uses pytest.integration.ini)
poe test-coverage            # Full suite with HTML + term coverage
poe lint                     # ruff check --fix
poe format                   # ruff format
poe type-check               # mypy app/
poe migrate                  # alembic upgrade head
poe trigger                  # Manually enqueue a task (scripts/trigger_task.py)

# Run a single test
poetry run pytest tests/unit/test_feed_service.py::test_parse_feed -m unit

# Create a migration (against a running api container)
docker compose exec api alembic revision --autogenerate -m "Description"

# Background workers in Docker instead of locally
docker compose up -d worker scheduler
```

Pytest markers (`pytest.ini`): `unit`, `integration`, `performance`, `e2e`, `slow`. `--strict-markers` is on, `asyncio_mode = auto`.

### Frontend Development (`apps/web/`)

```bash
cd apps/web
bun install
bun run dev                 # Start Next.js dev server (localhost:8042)
bun run build              # Build for production
bun run lint               # next lint (ESLint)
bun run format             # Format with Prettier
bun run check-types        # tsc --noEmit
bun run knip               # Find unused files/exports/deps

# Or from root using Turborepo (runs all apps)
bun run dev                # Start all apps in development
turbo run dev --filter=web # Start only web app
```

### Extension Development (`apps/extension/`)

Scripts here are `npm run` under the hood (the extension toolchain calls `npm` internally), but install with `bun`.

```bash
cd apps/extension
bun run dev                # Vite dev build for Chrome
bun run build             # Chrome production build (dist/)
bun run build:firefox     # Firefox build (dist-firefox/)
bun run dev:firefox       # Build + launch in Firefox via web-ext
bun run package:all       # Zip both Chrome and Firefox artifacts
bun run lint              # eslint . --max-warnings 100
bun run check-types       # tsc --noEmit
```

### Mobile Development (`apps/mobile/`)

Read `apps/mobile/CLAUDE.md` first. Lint/format use **Biome**, not ESLint.

```bash
cd apps/mobile
bun run start             # Expo dev server (Metro)
bun run ios               # Build + run iOS (expo run:ios)
bun run android           # Build + run Android
bun run start:dev         # Same, with APP_VARIANT=development
bun run check             # biome check --write .
bun run lint              # biome lint .
bun run check-types       # tsc --noEmit
bun run prebuild          # Regenerate native projects (expo prebuild)
```

### Inbound Worker Development (`apps/inbound/`)

Read `apps/inbound/AGENTS.md` first (Cloudflare Workers guidance).

```bash
cd apps/inbound
bun run dev               # wrangler dev (local)
bun run test              # vitest (@cloudflare/vitest-pool-workers)
bun run cf-typegen        # Regenerate binding types after editing wrangler.jsonc
bun run deploy            # wrangler deploy
```

## Key Integration Points

### Authentication Flow

- Supabase Auth handles user authentication across web, mobile, and extension
- JWT tokens are shared between clients; the backend validates the Supabase JWT on protected routes
- `docker/promote-admin.sh <email>` grants admin

### Data Flow

- RSS feeds are fetched and parsed by **Taskiq** workers in the background; articles stored with full content extraction and metadata
- Inbound newsletters arrive via the `apps/inbound` Cloudflare Worker → `POST /api/intake/webhook`
- Feed discovery/search is served by **Meilisearch**; clients query it directly with `@meilisearch/instant-meilisearch` (web/mobile)
- The browser extension detects feeds and saves articles through the backend API

### Payments

- **Web**: Polar (`@polar-sh/nextjs`, `@polar-sh/sdk`)
- **Mobile**: RevenueCat (`react-native-purchases`)

### Database Schema

- User management through Supabase Auth
- RSS feeds, articles, folders, highlights/annotations, and preferences in PostgreSQL
- `pgvector` embeddings for AI features (content/feed similarity, recommendations)
- Remember the `url` (RSS XML endpoint) vs `link` (human website) distinction — see "Important Type Definitions" below

## Testing Strategy

### Backend Testing

- **Prefer integration tests** (`tests/integration/`, run via `pytest.integration.ini`). Unit tests (`tests/unit/`) are for **pure logic only** and must **not** touch a database
- `factory-boy` for test data; `pytest-asyncio` (`asyncio_mode = auto`); `pytest-mock` for mocking
- `ENVIRONMENT=test` is injected by `pytest.ini`

### Frontend Testing

- `apps/inbound` has Vitest tests; web/mobile have no component test framework yet
- Type safety enforced through TypeScript strict mode + `turbo run check-types`

## CI (`.github/workflows/ci.yml`)

Runs on push / PR to `main` and `develop`:

- **Backend**: `ruff check`, `ruff format --check`, `mypy` (non-blocking), and `pytest tests/unit/ -m unit` with coverage (Python 3.13, Poetry 2.1.2)
- **Frontend**: `bun install --frozen-lockfile` then `turbo run check-types lint` (Node 20, Bun latest)

Match CI locally before pushing: `poe lint && poe format && poe test-unit` in `server/`, and `bun run check-types && bun run lint` from the root.

## Common Development Patterns

### Backend Patterns

- Data access via `app/crud/` helpers over SQLAlchemy/SQLModel; sessions from `app/db/`
- Implement services (`app/services/`) for complex business logic
- Background tasks handled through Taskiq (`app/workers/`, registered in `registry.py`)
- Error handling through custom exception classes (`app/core/exceptions.py`)
- Async/await throughout for I/O operations
- Extract shared literals to `app/core/constants.py` and reuse them; avoid nested functions

### Backend Guidelines

- **Test-Driven Development**: Write tests first — integration tests in `tests/integration/`, or unit tests in `tests/unit/` when the logic is pure (no DB)
- **Code Quality Workflow**: After writing code, always:
  1. Run tests (`poe test`)
  2. Format code (`poe format`)
  3. Lint code (`poe lint`)
  4. Type check (`poe type-check`)
- **Documentation**: Generate proper docstrings and comments for all functions and classes
- **Import Organization**: Python `import` statements should always be at the top of the file
  - Exception: Only when there are circular dependency issues
- **Function Signatures**: All new Python functions must have type signatures, even if existing functions lack them

### Frontend Patterns

- Server Components for initial data fetching
- Client Components for interactivity
- Custom hooks for shared logic
- Zustand stores for complex client state
- TanStack Query for server state management

### Frontend Guidelines

- **Component Architecture**: Keep components relatively small and focused
  - Abstract functionality into reusable components
  - Leverage the existing shadcn/ui component system
  - Use shared packages for common utilities and types
- **Responsive Design**: All components must be responsive across all screen sizes
- **Dark Theme Support**: All components must properly support dark theme
- **Color Scheme**: Respect `apps/web/app/globals.css` for consistent color schemes
- **Shared Code**: Extract common functionality to `packages/shared` for reuse between web and extension
- **Code Quality**: After writing frontend code, always:
  1. Build the project (`bun run build`)
  2. Run type checking (`bun run check-types`)
  3. Format code (`bun run format`)
  4. Lint code (`bun run lint`)

### Monorepo Guidelines

- **Workspace Dependencies**: Use workspace references (e.g., `"@readspace/shared": "workspace:*"`) for internal packages
- **Shared Code**: Place common utilities, types, and business logic in `packages/shared`
- **Configuration**: Use shared ESLint and TypeScript configs from `packages/` for consistency
- **Turborepo**: Leverage Turborepo's caching and parallelization for faster builds
- **Package Naming**: Follow the `@readspace/package-name` convention for internal packages

### Extension Patterns

- Message passing between content script and background worker
- Chrome Storage API for persistence
- Declarative permissions in manifest

## Environment Configuration

`./docker/setup.sh` (add `--dev` for local development) generates every `.env` with sane defaults:

- `server/.env` - Backend API keys, database, Redis, Meilisearch, AI providers
- `apps/web/.env` - Supabase URL/anon key, API base URL
- `apps/mobile/.env` - Supabase + API config for the Expo app
- `docker/supabase/.env` - Database credentials and JWT secrets
- `docker/.env` - Meilisearch keys

`apps/inbound` uses `wrangler.jsonc` vars/secrets, not a `.env`.

## Deployment Notes

- Backend runs as a Docker container alongside Taskiq `worker` and `scheduler` containers
- Web builds and deploys as a Next.js app; extension packages separately for the Chrome Web Store and Firefox Add-ons; mobile ships via EAS
- Supabase can be self-hosted (bundled compose) or used as a managed service
- Redis is required (Taskiq broker + caching); Meilisearch is required for search
- `apps/inbound` deploys to Cloudflare Workers via `wrangler deploy`

## Codebase Navigation Guide

This repo is indexed by **CodeGraph** (`.codegraph/` at the root) — prefer `codegraph_explore` / `codegraph explore "<query>"` over grep when locating or understanding code.

### Frontend (`apps/web/`) Directory Structure

#### Core Application Files

- **`app/`** - Next.js App Router structure
  - **`app/(auth)/`** - Authentication routes (login, signup, callback)
  - **`app/(protected)/`** - Protected application routes
    - `library/` - Article library and reading view
    - `manage-feeds/` - Feed management interface
    - `read-later/` - Saved articles
    - `import-opml/` - OPML import functionality
  - **`app/globals.css`** - Global styles and Tailwind configuration
  - **`app/layout.tsx`** - Root layout component
  - **`app/providers.tsx`** - Context providers setup

#### Component Organization

- **`components/`** - Reusable UI components
  - `ui/` - shadcn/ui base components
  - `navigation/` - Navigation and header components
  - `library/` - Library-specific components
  - `feeds/` - Feed management components
  - `articles/` - Article display components
  - `layout/` - Layout and page structure components
  - `onboarding/` - User onboarding flow components

#### State and Utilities

- **`stores/`** - Zustand state stores
- **`hooks/`** - Custom React hooks
- **`lib/`** - Utility functions and configurations
- **`types/`** - TypeScript type definitions
- **`database.types.ts`** - Supabase generated types
- **`env.ts`** - Environment variable validation
- **`middleware.ts`** - Next.js middleware for auth

### Shared Packages (`packages/`) Directory Structure

#### Shared Package (`packages/shared/`)

- **`src/utils/`** - Shared utility functions
- **`src/types/`** - Common TypeScript type definitions
- **`src/constants/`** - Shared constants and configuration
- **`package.json`** - Package configuration with proper exports

#### Configuration Packages

- **`packages/design-tokens/`** - `src/colors.ts`, `src/theme.css` - the palette source of truth (web + extension)
- **`packages/eslint-config/`** - Shared ESLint rules for web and extension
- **`packages/typescript-config/`** - TypeScript configurations for different project types

### Backend (`server/`) Directory Structure

#### Core Application (`server/app/`)

- **`main.py`** - FastAPI application entry point
- **`core/`** - Core application configuration
  - `config.py` - Pydantic settings
  - `constants.py` - Shared constants (put reusable literals here)
  - `dependencies.py` - FastAPI dependency injection
  - `custom_exceptions.py` - Custom exception classes
  - `taskiq_app.py` - Taskiq broker + scheduler wiring
  - `redis_cache.py` - Redis caching utilities
  - `logging_config.py` - structlog / JSON logging setup
  - `resource_limits.py` - Request/processing guardrails
- **`middleware/`** - `logging.py`, `compression.py`

#### API Layer

- **`routers/`** - FastAPI route handlers, grouped by domain: `feeds/`, `articles/`, `opml/` packages plus `discover.py`, `folders.py`, `users.py`, `intake.py` (newsletter webhook), `info.py`

#### Business Logic

- **`services/`** - Business logic layer (`feed_*`, `article_*`, `ai_service.py`, search, subscription, etc.)
- **`crud/`** - Data-access helpers over the ORM
- **`db/`** - `session.py` (async engine/session), `base_class.py`

#### Data Layer

- **`models/`** - SQLAlchemy / SQLModel models: `feed.py`, `article.py`, `folder.py`, `user.py`, `enums.py`
- **`schemas/`** - Pydantic request/response schemas
- **`typing/`**, **`utils/`** - Shared type aliases and helpers

#### Background Processing

- **`workers/`** - Taskiq tasks. `registry.py` lists task modules for the worker/scheduler; `feed_tasks.py` / `opml_tasks.py` are the task entrypoints, with implementation split under `workers/feed/` (refresh, enrichment, favicon, compaction) and `workers/opml/`

#### Database and Testing

- **`alembic/`** - Database migrations
- **`tests/`** - Test suite
  - `unit/` - Unit tests
  - `integration/` - Integration tests

#### Configuration Files

- **`pyproject.toml`** - Poetry dependency management and project config
- **`alembic.ini`** - Database migration configuration
- **`pytest.ini`** - Test configuration

## Visual Development

IMMEDIATELY after implementing any front-end change:

1. **Identify what changed** - Review the modified components/pages
2. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view
3. **Validate feature implementation** - Ensure the change fulfills the user's specific request
4. **Check acceptance criteria** - Review any provided context files or requirements
5. **Capture evidence** - Take full page screenshot at desktop viewport (1440px) of each changed view
6. **Check for errors** - Run `mcp__playwright__browser_console_messages`

This verification ensures changes meet design standards and user requirements.

### Comprehensive Design Review

Invoke the `@agent-design-review` subagent for thorough design validation when:

- Completing significant UI/UX features
- Before finalizing PRs with visual changes
- Needing comprehensive accessibility and responsiveness testing
- Specific constants should always be extracted to server/app/core/constants.py and re-used.
- Have useful logs throughout, but make sure its not redundant. Use proper log levels.
- Avoid nested functions in Python

## Important Type Definitions

### RSS Feed URL vs Website URL

When working with feeds, there are two distinct URL fields:

- **`url`**: The RSS feed URL (the actual XML feed endpoint, e.g., `https://example.com/feed.xml`)
- **`link`**: The website URL (the human-readable website the feed belongs to, e.g., `https://example.com`)

This distinction is critical in both:

- Database schema (`apps/web/database.types.ts` - line 287+)
- Server API schemas (`server/app/schemas/rss_schemas.py` and `subscription_schemas.py`)
- Frontend types (`apps/web/lib/api/hooks/feeds.ts`)
- Shared types (`packages/shared/src/types/`)
- Use bun over npm or pnpm
- Unit tests must NOT involve database interactions
- we prefer integration tests. unit tests only for pure logic
