# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Readspace is an open-source, privacy-first reading hub that brings RSS feeds, newsletters, saved articles, Twitter threads, Reddit posts, and books into one clean, distraction-free inbox. It's built as a full-stack application with a Python FastAPI backend, Next.js frontend, and Chrome/Firefox extension.

## Architecture

### Monorepo Structure
- **`server/`**: Python FastAPI backend with PostgreSQL and Supabase
- **`web/`**: Next.js 15 frontend with TypeScript and Tailwind CSS
- **`extension/`**: Chrome/Firefox browser extension built with Vite and React
- **`supabase/`**: Database schema, migrations, and local development setup

### Backend Architecture (`server/`)
- **FastAPI** with async/await patterns throughout
- **PostgreSQL** with SQLAlchemy ORM and Alembic migrations
- **Supabase** for authentication and real-time features
- **Celery** with Redis for background task processing (feed fetching, article processing)
- **OpenTelemetry** instrumentation for observability
- **Structured logging** with JSON output

Key service patterns:
- Repository pattern for data access (`repositories/`)
- Service layer for business logic (`services/`)
- CRUD operations abstracted (`crud/`)
- Background workers for RSS feed fetching and processing (`workers/`)

### Frontend Architecture (`web/`)
- **Next.js 15** with App Router and Server Components
- **TypeScript** throughout with strict type checking
- **Tailwind CSS** for styling with shadcn/ui components
- **Zustand** for client-side state management
- **TanStack Query** for server state and caching
- **Supabase Auth** integration with session management

### Browser Extension (`extension/`)
- **Manifest V3** Chrome extension with Firefox compatibility
- **React** with TypeScript
- **Vite** for building with separate Chrome/Firefox targets
- Content script for page analysis and RSS feed detection
- Background service worker for API communication

## Development Commands

### Environment Setup
```bash
# Initial setup - generates all .env files
./setup.sh

# Start all services with Docker
./start_docker.sh

# Start infrastructure only (recommended for development)
docker compose -f supabase/docker-compose.yml --env-file supabase/.env up -d
docker compose up -d redis
docker compose -f docker-compose.rsshub.yml up -d
```

### Backend Development (`server/`)
```bash
cd server
poetry install
poe start                    # Start FastAPI dev server (localhost:8008)
poe test                     # Run all tests
poe test-unit               # Run unit tests only
poe test-integration        # Run integration tests only
poe test-coverage           # Run tests with coverage report
poe lint                    # Lint and auto-fix with ruff
poe format                  # Format code with ruff
poe migrate                 # Apply database migrations

# Background workers (if needed)
docker compose up -d worker beat

# Database migrations
docker compose exec api alembic revision --autogenerate -m "Description"
docker compose exec api alembic upgrade head
```

### Frontend Development (`web/`)
```bash
cd web
pnpm i
pnpm dev                    # Start Next.js dev server (localhost:8042)
pnpm build                  # Build for production
pnpm lint                   # Lint with ESLint
pnpm format                 # Format with Prettier
pnpm type-check            # TypeScript type checking
```

### Extension Development (`extension/`)
```bash
cd extension
pnpm i
pnpm dev                   # Build for Chrome development
pnpm build                 # Build for Chrome production
pnpm build:firefox         # Build for Firefox
pnpm lint                  # Lint with ESLint
pnpm type-check           # TypeScript type checking
```

## Key Integration Points

### Authentication Flow
- Supabase Auth handles user authentication across all components
- JWT tokens are shared between web app and extension
- Backend validates Supabase JWT tokens on protected routes

### Data Flow
- RSS feeds are processed by Celery workers in the background
- Articles are stored with full content extraction and metadata
- Real-time updates use Supabase's real-time subscriptions
- Browser extension communicates with backend API for saving articles

### Database Schema
- User management through Supabase Auth
- RSS feeds, articles, and user preferences in PostgreSQL
- Vector embeddings for AI-powered features (content similarity, recommendations)
- Highlights and annotations stored with position data

## Testing Strategy

### Backend Testing
- Unit tests for services and utilities (`tests/unit/`)
- Integration tests for API endpoints (`tests/integration/`)
- Factory pattern for test data generation
- Pytest with async support

### Frontend Testing
- Component testing framework not yet implemented
- Type safety enforced through TypeScript strict mode

## Common Development Patterns

### Backend Patterns
- Use repository pattern for database access
- Implement services for complex business logic
- Background tasks handled through Celery
- Error handling through custom exception classes
- Async/await throughout for I/O operations

### Backend Guidelines
- **Test-Driven Development**: Write unit tests first in `tests/unit/` before implementing functionality
- **Code Quality Workflow**: After writing code, always:
  1. Build the project
  2. Run tests (`poe test`)
  3. Format code (`poe format`)
  4. Lint code (`poe lint`)
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
- **Responsive Design**: All components must be responsive across all screen sizes
- **Dark Theme Support**: All components must properly support dark theme
- **Color Scheme**: Respect `web/app/globals.css` for consistent color schemes
- **Code Quality**: After writing frontend code, always:
  1. Build the project (`pnpm build`)
  2. Run type checking (`pnpm type-check`)
  3. Format code (`pnpm format`)
  4. Lint code (`pnpm lint`)

### Extension Patterns
- Message passing between content script and background worker
- Chrome Storage API for persistence
- Declarative permissions in manifest

## Environment Configuration

Each component requires its own `.env` file:
- `server/.env` - Backend API keys and database config
- `web/.env` - Frontend Supabase configuration
- `supabase/.env` - Database credentials and JWT secrets

The `setup.sh` script generates these files with appropriate defaults for local development.

## Deployment Notes

- Backend runs as Docker container with Celery workers
- Frontend builds as static assets for deployment
- Extension packages separately for Chrome Web Store and Firefox Add-ons
- Supabase can be self-hosted or used as managed service
- Redis required for Celery task queue

## Codebase Navigation Guide

### Frontend (`web/`) Directory Structure

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

### Backend (`server/`) Directory Structure

#### Core Application (`server/app/`)
- **`main.py`** - FastAPI application entry point
- **`core/`** - Core application configuration
  - `config.py` - Application settings and configuration
  - `dependencies.py` - FastAPI dependency injection
  - `exceptions.py` - Custom exception handling
  - `celery_app.py` - Celery configuration
  - `redis_cache.py` - Redis caching utilities

#### API Layer
- **`routers/`** - FastAPI route handlers (API endpoints)
  - `rss_feeds.py` - RSS feed management endpoints
  - `rss_articles.py` - Article management endpoints
  - `books.py` - Book/library management
  - `highlights.py` - Article highlights and annotations
  - `rss_opml.py` - OPML import/export functionality
  - `users.py` - User management endpoints

#### Business Logic
- **`services/`** - Business logic layer
  - `feed_*` files - RSS feed processing services
  - `article_*` files - Article processing services
  - `ai_service.py` - AI-powered features
  - `rss_search_service.py` - Feed discovery and search
  - `subscription_service.py` - User subscription management

#### Data Layer
- **`models/`** - SQLAlchemy database models
  - `rss_models.py` - RSS feed and article models
  - `user_models.py` - User-related models
  - `book_models.py` - Book and library models
- **`repositories/`** - Data access layer (repository pattern)
  - `base.py` - Base repository implementation
  - `books.py` - Book data access
  - `highlights.py` - Highlights data access
  - `supabase.py` - Supabase integration

#### Background Processing
- **`workers/`** - Celery background tasks
  - `tasks.py` - Background job definitions (feed fetching, article processing)

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
- Database schema (`web/database.types.ts` - line 287+)
- Server API schemas (`server/app/schemas/rss_schemas.py` and `subscription_schemas.py`)
- Frontend types (`web/lib/api/hooks/feeds.ts`)