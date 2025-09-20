# Readspace Server

FastAPI backend for Readspace - a privacy-first reading hub.

## Development

```bash
# Install dependencies
poetry install

# Start development server
poe start

# Run tests
poe test

# Lint and format
poe lint
poe format
```

## Architecture

Built with FastAPI, PostgreSQL, Supabase, and Celery for background tasks.