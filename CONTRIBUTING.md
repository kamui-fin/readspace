# Contributing to Readspace

Thanks for contributing to Readspace. Bug fixes, documentation improvements, feature work, and thoughtful product feedback are all welcome.

Before starting a large change, check the [existing issues](https://github.com/kamui-fin/readspace/issues) and [discussions](https://github.com/kamui-fin/readspace/discussions). Opening an issue first helps confirm the scope and avoids duplicated work.

## Prerequisites

- [Git](https://git-scm.com/)
- [Docker Engine](https://docs.docker.com/engine/install/) or Docker Desktop with Docker Compose
- [Node.js 22.13 or newer](https://nodejs.org/). Node.js 24 LTS is recommended and used in CI.
- [Bun 1.3.14 or newer](https://bun.sh/). The repository and EAS builds pin Bun 1.4.2.
- [Python 3.10 or newer](https://www.python.org/). Python 3.13 is recommended because it matches CI.
- [Poetry 2.x](https://python-poetry.org/)
- Bash, `curl`, `jq`, and OpenSSL for the Docker setup scripts

Mobile development also requires the platform tools described in the [Expo local app development guide](https://docs.expo.dev/guides/local-app-development/).

## Initial setup

1. Fork the repository, then clone your fork:

   ```bash
   git clone https://github.com/YOUR_USERNAME/readspace.git
   cd readspace
   git remote add upstream https://github.com/kamui-fin/readspace.git
   ```

2. Install the JavaScript workspace dependencies:

   ```bash
   bun install
   ```

3. Install the backend dependencies:

   ```bash
   cd server
   poetry install
   cd ..
   ```

4. Generate local development configuration:

   ```bash
   ./docker/setup.sh --dev
   ```

   This generates the required environment files for Docker, the web app, the mobile app, and the server. Development mode uses local URLs and disables optional AI features by default.

5. Start the local infrastructure:

   ```bash
   ./docker/launch.sh --dev
   ```

   Development mode starts Supabase, Redis, Meilisearch, and the optional local RSSHub service. It does not start the web app, API, Taskiq worker, or Taskiq scheduler. Run the application services you need directly on your host for faster reloads.

Useful local endpoints include:

- Supabase Studio: [http://localhost:18000](http://localhost:18000)
- Meilisearch: [http://localhost:7700](http://localhost:7700)
- RSSHub, when enabled: [http://localhost:1200](http://localhost:1200)

Startup can take a minute. Use `docker ps` to inspect service health and `docker logs CONTAINER_NAME` to investigate an individual service.

## Run application services

Only run the services relevant to the area you are changing.

### Web app

```bash
cd apps/web
bun run dev
```

The Next.js app is available at [http://localhost:8042](http://localhost:8042).

### Backend API

Apply migrations before starting the API:

```bash
cd server
poetry run poe migrate
poetry run poe start
```

The FastAPI server is available at [http://localhost:8008](http://localhost:8008).

### Taskiq worker and scheduler

Development mode does not start the Taskiq containers. Features that fetch feeds, process articles, or schedule background work need these processes running locally.

Run each command in a separate terminal:

```bash
cd server
poetry run poe worker
```

```bash
cd server
poetry run poe scheduler
```

Both tasks load workers through `app.workers.registry`, matching the production configuration.

### Browser extension

The extension supports Chrome and Firefox.

For Chrome:

```bash
cd apps/extension
bun run dev
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `apps/extension/dist`.

For Firefox, run these commands in separate terminals:

```bash
cd apps/extension
bun run dev:firefox:watch
```

```bash
cd apps/extension
bun run dev:firefox
```

The first command rebuilds on source changes. The second builds the initial Firefox version and launches it with `web-ext`.

### Mobile app

The mobile app uses Expo development builds rather than Expo Go.

To build and launch a development client:

```bash
cd apps/mobile
bun run ios:dev
```

Or for Android:

```bash
cd apps/mobile
bun run android:dev
```

Once a development client is installed, start the Expo development server with:

```bash
cd apps/mobile
bun run start:dev
```

`./docker/setup.sh --dev` generates `apps/mobile/.env` with localhost URLs. A physical device cannot use your computer's localhost. Replace the host in that file with your computer's LAN address, such as `192.168.1.50`, and ensure the device can reach your computer over the local network.

### Newsletter ingestion worker

The hosted newsletter ingestion service is a Cloudflare Worker:

```bash
cd apps/inbound
bun run dev
```

Self-hosted newsletter ingestion is not currently supported.

## Database migrations

Database schema changes require an Alembic migration.

1. Start the development infrastructure with `./docker/launch.sh --dev`.
2. Modify the SQLAlchemy or SQLModel definitions in `server/app/models/`.
3. Generate a migration from the `server` directory:

   ```bash
   cd server
   poetry run alembic revision --autogenerate -m "Describe the schema change"
   ```

4. Review the generated file in `server/alembic/versions/`. Autogenerated migrations must be checked for unintended changes, unsafe operations, and correct downgrade behavior.
5. Apply the migration:

   ```bash
   poetry run poe migrate
   ```

## Tests

Run the tests relevant to your changes before opening a pull request.

### Backend

From `server/`:

```bash
poetry run poe test-unit
poetry run poe test-integration
```

Integration tests require the local infrastructure. To run the full backend suite or generate coverage:

```bash
poetry run poe test
poetry run poe test-coverage
```

### Web app

From `apps/web/`:

```bash
bun test
```

### Newsletter ingestion worker

From `apps/inbound/`:

```bash
bun test
```

The mobile app and browser extension currently rely on linting, type checking, build checks, and manual testing because they do not define automated test scripts.

## Linting, formatting, and type checking

### JavaScript and TypeScript workspaces

From the repository root, lint and type check all workspaces that define those tasks:

```bash
bun run lint
bun run check-types
```

The web app, browser extension, and shared packages use ESLint and Prettier. Run their formatter from the relevant workspace:

```bash
cd apps/web
bun run format
```

```bash
cd apps/extension
bun run format
```

The mobile app uses Biome:

```bash
cd apps/mobile
bun run check:ci
```

To apply Biome fixes and formatting, run `bun run check` from `apps/mobile`.

### Backend

From `server/`:

```bash
poetry run poe lint
poetry run poe format
poetry run poe type-check
```

The `lint` task runs Ruff with automatic fixes. The `type-check` task runs mypy separately.

## Reset or stop the development environment

Stop the infrastructure without deleting data:

```bash
./docker/down.sh --dev
```

Reset all local instance data, including Postgres, Redis, and the Meilisearch index:

```bash
./docker/reset.sh --dev
./docker/launch.sh --dev
```

The reset script asks for confirmation and preserves existing secrets. To reset the data and rotate secrets:

```bash
./docker/reset.sh --dev
./docker/setup.sh --dev --regenerate-secrets
./docker/launch.sh --dev
```

> [!CAUTION]
> Resetting permanently deletes all data in the local instance. Secret regeneration must only be run after the existing database containers have been removed.

## Pull requests

1. Create a focused branch from the latest `main` branch.
2. Keep unrelated changes out of the pull request.
3. Add or update tests for behavior changes where automated coverage exists.
4. Run the relevant tests, lint checks, formatting checks, and type checks.
5. Update documentation when behavior, configuration, or developer workflows change.
6. Open the pull request against `main` with a clear description of the problem and solution.
7. Include screenshots or recordings for visible web, mobile, or extension changes.

CI currently checks backend Ruff formatting and linting, backend mypy types, backend unit tests, and frontend linting and type checking. Passing local checks before pushing makes review faster.

## Reporting security issues

Please do not open a public issue for a suspected security vulnerability. Report it privately through GitHub's security advisory feature for this repository.
