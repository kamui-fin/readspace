# Contributing to Readspace

First off, thank you for considering contributing to Readspace! It's people like you that make open source great. We welcome any and all contributions.

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Initial Setup](#initial-setup)
- [Development Environment Setup](#development-environment-setup)
  - [1. Start Core Infrastructure](#1-start-core-infrastructure)
  - [2. Run Application Services](#2-run-application-services)
- [Working on Background Tasks (Celery)](#working-on-background-tasks-celery)
- [Database Migrations (Alembic)](#database-migrations-alembic)
- [Linting and Formatting](#linting-and-formatting)
- [Submitting a Pull Request](#submitting-a-pull-request)

## Getting Started

### Prerequisites

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/products/docker-desktop/) and Docker Compose
- [Node.js v22](https://nodejs.org/en/) (we recommend using a version manager like `nvm`)
- [pnpm](https://pnpm.io/) 
- [Python](https://www.python.org/)
- [Poetry](https://python-poetry.org/)

### Initial Setup

1.  **Fork and Clone the Repository**

    ```bash
    git clone https://github.com/kamui-fin/readspace.git
    cd readspace
    ```

2.  **Configure Environment Variables**

    Run the setup script to generate the necessary `.env` files for all services.

    ```bash
    ./setup.sh
    ```

    This will create `.env` files in `supabase/`, `web/`, and `server/`.

## Development Environment Setup

Our recommended development setup uses Docker to run the core infrastructure (Supabase, Redis) while you run the application services (Web, API, Extension) directly on your host machine. This gives you the best of both worlds: a stable backend foundation and a fast, hot-reloading development loop for the parts you're actively working on.

### 1. Start Core Infrastructure

First, start the Supabase stack and Redis in Docker.

```bash
# Start the full Supabase stack in the background
docker compose -f supabase/docker-compose.yml --env-file supabase/.env up -d

# Start Redis from the main docker-compose file
docker compose up -d redis
```

-   **Supabase Studio:** You can access the local dashboard at [http://localhost:8000](http://localhost:8000). Log in with email `supabase` and password `not_being_used`.

Wait a minute for the services to initialize. You can check their status with `docker ps`.

### 2. Run Application Services

With the infrastructure running, you can now launch any of the application services on your host machine.

#### Web Client (Next.js)

```bash
cd web
pnpm i
pnpm dev
```
The web client will be available at `http://localhost:8042`.

#### Backend Server (FastAPI)

```bash
cd server
poetry install
poe start
```
The backend API will be available at `http://localhost:8008`.

#### Chrome Extension

The extension is built with Vite.

1.  **Install dependencies:**
    ```bash
    cd extension
    pnpm i
    ```
2.  **Start the development server:**
    ```bash
    pnpm dev
    ```
3.  **Load the extension in Chrome:**
    -   Open Chrome and navigate to `chrome://extensions`.
    -   Enable "Developer mode".
    -   Click "Load unpacked".
    -   Select the `extension/dist` directory.

Changes to the source code will be automatically rebuilt.

### Working on Background Tasks (Celery)

Our backend uses Celery to manage asynchronous tasks. The architecture consists of two main components that run alongside the main API server:

-   **`worker`**: This service executes background tasks, such as fetching RSS feeds, processing articles, or sending notifications.
-   **`beat`**: This is a scheduler. It periodically adds tasks to the queue for the workers to execute based on a defined schedule (e.g., "fetch this feed every hour").

If you need to work on features involving background jobs, you'll need to run the `worker` and `beat` services. Make sure Redis is running first (see the hybrid setup), then launch them using Docker Compose:

```bash
# Ensure redis is running, then start the worker and beat services
docker compose up -d worker beat
```

You can view their logs using `docker compose logs -f worker beat`.

### Database Migrations (Alembic)

When you make changes to the database schema (i.e., by modifying the SQLAlchemy models in `server/app/models/`), you must create a new migration file. We use Alembic to manage schema changes.

1.  **Ensure your services are running:**
    Use either the full Docker setup (`./start_docker.sh`) or the hybrid setup. The `api` container must be running.

2.  **Generate a new migration:**
    Run the `alembic revision` command inside the `api` container.

    ```bash
    docker compose exec api alembic revision --autogenerate -m "Your descriptive migration message"
    ```

3.  **Review the generated migration:**
    A new migration script will be created in `server/alembic/versions/`. Please inspect this file to ensure it accurately reflects your intended changes.

4.  **Apply the migration:**
    Migrations are automatically applied when the `api` container starts. To apply them manually while services are running, use:

    ```bash
    docker compose exec api alembic upgrade head
    ```

### Linting and Formatting

To maintain code quality and consistency, please run the linters and formatters before submitting a pull request. Each part of the monorepo has its own scripts.

#### Backend (Server)

We use `ruff` for both linting and formatting.

```bash
cd server
# Lint and auto-fix issues
poe lint

# Format the code
poe format
```

#### Frontend (Web) and Browser Extension

We use ESLint for linting and Prettier for formatting. Run these commands from the `web/` or `extension/` directory.

```bash
# Lint the code
pnpm lint

# Format the code
pnpm format
```

## Submitting a Pull Request

1.  Create a new branch for your feature or bug fix.
2.  Make your changes.
3.  Ensure your code lints and tests pass.
4.  Push your branch and open a Pull Request against the `main` branch.
5.  Provide a clear description of your changes.

Thank you for your contribution! 