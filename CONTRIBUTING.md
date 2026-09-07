# Contributing to Readspace

First off, thank you for considering contributing to Readspace! It's people like you that make open source great. We welcome any and all contributions.

## Table of Contents

- [Contributing to Readspace](#contributing-to-readspace)
  - [Table of Contents](#table-of-contents)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Initial Setup](#initial-setup)
  - [Development Environment Setup](#development-environment-setup)
    - [Resetting Your Environment](#resetting-your-environment)
    - [2. Run Application Services](#2-run-application-services)
      - [Web Client (Next.js)](#web-client-nextjs)
      - [Backend Server (FastAPI)](#backend-server-fastapi)
      - [Chrome Extension](#chrome-extension)
    - [Working on Background Tasks (Celery)](#working-on-background-tasks-celery)
    - [Database Migrations (Alembic)](#database-migrations-alembic)
    - [Linting and Formatting](#linting-and-formatting)
      - [Backend (Server)](#backend-server)
      - [Frontend (Web) and Browser Extension](#frontend-web-and-browser-extension)
  - [Submitting a Pull Request](#submitting-a-pull-request)

## Getting Started

### Prerequisites

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/products/docker-desktop/) and Docker Compose
- [Node.js v20+](https://nodejs.org/en/) (we recommend using a version manager like `nvm`)
- [Bun](https://bun.sh/) - Fast all-in-one JavaScript runtime and package manager
- [Python 3.13+](https://www.python.org/)
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
    ./docker/setup.sh
    ```

    This will create `.env` files in `docker/supabase/`, `docker/.env` (Meilisearch keys), `apps/web/`, `apps/mobile/`, and `server/`.

    This script is safe to re-run whenever you want to change deployment config (access URL, RSSHub mode, AI settings) — it detects existing secrets (Postgres password, JWT signing key, Meilisearch master key) in `docker/supabase/.env` / `docker/.env` and reuses them rather than regenerating, so it won't silently break a database you already initialized. See [Resetting Your Environment](#resetting-your-environment) if you actually want a clean slate or to rotate secrets.

3.  **Install Dependencies**

    Install all workspace dependencies using Bun:

    ```bash
    bun i
    ```

    This will install dependencies for all apps and packages in the monorepo.

## Development Environment Setup

Our recommended development setup uses Docker to run the core infrastructure (Supabase, Redis, RSSHub, Taskiq workers) while you run the application services (Web, API, Extension, Mobile) directly on your host machine. This gives you the best of both worlds: a stable backend foundation and a fast, hot-reloading development loop for the parts you're actively working on.

First, configure your environment for development mode by running the setup script with the `--dev` flag (this automatically configures localhost loopback URLs and disables AI for local work without interactive prompts):

```bash
./docker/setup.sh --dev
```

Then start the infrastructure services in development mode:

```bash
./docker/launch.sh --dev
```

This starts the core database and caching infrastructure:

- Supabase (with Studio, Pooler, and database)
- Redis
- Meilisearch (search engine)
- RSSHub (optional)

_Note: Application containers (Web, API, Taskiq worker, Taskiq scheduler) are assigned to the `app` profile and are skipped during `--dev` mode so you can run them locally on your host machine for hot-reloading._

**Supabase Studio:** Access the local dashboard at [http://localhost:18000](http://localhost:18000).

Wait a minute for the services to initialize. You can check their status with `docker ps`.

### Resetting Your Environment

There are two reset scripts, scoped differently:

- **`./docker/reset.sh`** — the counterpart to `launch.sh`. Wipes everything: Postgres, Meilisearch's search index, and Redis. Use this for "start over completely." Add `--dev` if your last `launch.sh` used it, so it tears down the matching compose profile.
- **`./docker/supabase/reset.sh`** — wipes only the Supabase/Postgres database. Use this if you just want a clean database but don't need to touch Meilisearch or Redis.

Both scripts prompt for confirmation and, importantly, **leave `docker/supabase/.env` and `docker/.env` untouched** — your secrets are preserved, so `./docker/launch.sh --dev` immediately reinitializes a clean instance without needing to re-run `setup.sh`.

```bash
./docker/reset.sh --dev
./docker/launch.sh --dev
```

**Rotating secrets** (e.g. after a suspected leak) is a separate, deliberate step — reset first, then pass `--regenerate-secrets` to `setup.sh`:

```bash
./docker/reset.sh --dev
./docker/setup.sh --dev --regenerate-secrets
./docker/launch.sh --dev
```

`setup.sh --regenerate-secrets` will refuse to run while a `supabase-db` container still exists, since generating a new Postgres password against a database that already has the old one baked in breaks authentication for every Supabase service. Reset first, then rotate.

### 2. Run Application Services

With the infrastructure running, you can now launch any of the application services on your host machine.

#### Web Client (Next.js)

```bash
cd apps/web
bun dev
```

The web client will be available at `http://localhost:8042`.

#### Backend Server (FastAPI)

```bash
cd server
poetry install
poetry run poe migrate
poetry run poe start
```

The backend API will be available at `http://localhost:8008`.

#### Browser Extension

The extension is built with Vite and supports both Chrome and Firefox.

**For Chrome:**

1.  **Start the development server:**

    ```bash
    cd apps/extension
    bun dev
    ```

2.  **Load the extension in Chrome:**
    - Open Chrome and navigate to `chrome://extensions`.
    - Enable "Developer mode".
    - Click "Load unpacked".
    - Select the `apps/extension/dist` directory.

**For Firefox:**

```bash
cd apps/extension
bun dev:firefox:watch # in one terminal
bun dev:firefox # in another terminal
```

This will automatically build, launch Firefox with the extension, and reload on changes.

Changes to the source code will be automatically rebuilt.

#### Mobile App (React Native)

The mobile app is built with Expo and React Native.

```bash
cd apps/mobile
bun install
bun ios # or bun android
```

Follow the Expo CLI instructions to run on iOS simulator, Android emulator, or physical device.

> [!NOTE]
> **Environment Variables**: The `apps/mobile/.env` file is generated automatically by running `./docker/setup.sh --dev`.
>
> **Physical Device Testing**: If you are running the app on a physical phone via the Expo Go app over Wi-Fi, you must replace `localhost` in `apps/mobile/.env` with your computer's local network IP address (e.g., `192.168.1.50`) so the phone can reach the API.

### Working on Background Tasks (Taskiq)

Our backend uses Taskiq to manage asynchronous tasks. The architecture consists of two main components:

- **`worker`**: Executes background tasks, such as fetching RSS feeds, processing articles, or sending notifications.
- **`scheduler`**: Periodically adds tasks to the queue based on a defined schedule (e.g., "fetch this feed every hour").

When running `./docker/launch.sh --dev`, the worker and scheduler services are automatically started in Docker.

**For active Taskiq development**, it's better to run them directly on your host machine for faster iteration:

```bash
cd server

# Run the scheduler
poetry run taskiq scheduler app.core.taskiq_app:scheduler --fs-discover --tasks-pattern "app/workers/*.py"

# In another terminal, run the worker
poetry run taskiq worker app.core.taskiq_app:broker --fs-discover --tasks-pattern "app/workers/*.py"
```

This gives you immediate feedback and easier debugging compared to running in Docker.

### Database Migrations (Alembic)

When you make changes to the database schema (i.e., by modifying the SQLAlchemy models in `server/app/models/`), you must create a new migration file. We use Alembic to manage schema changes.

1.  **Ensure Supabase is running:**
    Make sure you've started the infrastructure with `./docker/launch.sh --dev`.

2.  **Generate a new migration:**
    Run the `alembic revision` command from the `server` directory:

    ```bash
    cd server
    alembic revision --autogenerate -m "Your descriptive migration message"
    ```

3.  **Review the generated migration:**
    A new migration script will be created in `server/alembic/versions/`. Please inspect this file to ensure it accurately reflects your intended changes.

4.  **Apply the migration:**
    ```bash
    alembic upgrade head
    ```

### Linting and Formatting

To maintain code quality and consistency, please run the linters and formatters before submitting a pull request. Each part of the monorepo has its own scripts.

#### Backend

We use `ruff` for both linting and formatting. `lint` also runs `mypy` for type checking.

```bash
cd server
# Lint and auto-fix issues
poe lint

# Format the code
poe format
```

#### Frontend (Web, Extension, Mobile)

We use ESLint for linting and Prettier for formatting.

```bash
# Lint all projects
bun run lint

# Format all projects
bun run format

# Type check all projects
bun run check-types
```

#### Prefer raw Docker Compose for development?

If you prefer to use Docker Compose directly:

```bash
# --project-directory/--project-name pin Compose's path resolution and project identity
# to match the wrapper scripts — needed if you ever add --profile app to build the app
# images this way, and keeps volume names consistent with launch.sh/reset.sh either way.

# Start development infrastructure (database, cache, search)
docker compose -f docker/supabase/docker-compose.yml -f docker/docker-compose.yml -f docker/supabase/docker-compose.dev.yml \
  --env-file docker/supabase/.env --env-file docker/.env \
  --project-directory docker --project-name readspace up -d

# Then start services on your host machine (see "Run Application Services" section above)

# To stop:
docker compose -f docker/supabase/docker-compose.yml -f docker/docker-compose.yml -f docker/supabase/docker-compose.dev.yml \
  --project-directory docker --project-name readspace down
```

**Stopping Services:**

When you're done developing, stop the infrastructure services:

```bash
./docker/down.sh --dev
```

## Submitting a Pull Request

1.  Create a new branch for your feature or bug fix.
2.  Make your changes.
3.  Ensure your code lints and tests pass.
4.  Push your branch and open a Pull Request against the `main` branch.
5.  Provide a clear description of your changes.

Thank you for your contribution!
