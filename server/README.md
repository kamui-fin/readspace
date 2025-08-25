# Readspace Server

FastAPI backend server for the Readspace reading platform.

## Features

- RSS feed management
- Book reading and highlighting
- User authentication with Supabase
- Background task processing with Celery
- SQLAlchemy ORM with PostgreSQL

## Development

```bash
# Install dependencies
poetry install

# Run tests  
poetry run pytest

# Start development server
poetry run poe start

# Lint code
poetry run poe lint

# Format code
poetry run poe format
```

## Testing

```bash
# Run all tests
poetry run poe test

# Run unit tests only
poetry run poe test-unit

# Run integration tests only  
poetry run poe test-integration

# Run tests with coverage
poetry run poe test-coverage
```