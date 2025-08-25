# GitHub Actions CI/CD Pipeline

This directory contains GitHub Actions workflows for automated testing, linting, security scanning, and deployment.

## Workflows

### 1. CI Pipeline (`ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**
- **lint-and-typecheck**: Runs ruff linting, formatting checks, and mypy type checking
- **test**: Runs pytest with coverage reporting, includes database setup with Supabase
- **frontend-lint-and-test**: Lints and builds the Next.js web application  
- **extension-lint-and-build**: Lints and builds the browser extensions

**Features:**
- Multi-environment testing with PostgreSQL and Redis services
- Code coverage reporting via Codecov
- Dependency caching for faster builds
- Parallel job execution for optimal performance

### 2. Migration Deploy (`deploy-migrations.yml`)

Deploys database migrations to production after successful CI runs.

**Triggers:**
- Automatically after CI workflow completes successfully on `main` branch
- Manual dispatch with environment selection

**Features:**
- Environment-specific deployment (production/staging)
- Slack notifications for deployment status
- Migration verification

### 3. Security Scanning (`security.yml`)

Comprehensive security and dependency scanning.

**Runs:**
- Weekly on schedule (Mondays at 6 AM UTC)
- On pushes to main branch
- On pull requests

**Scans:**
- Dependency review for pull requests
- Python security with Bandit and Safety
- Frontend security with npm audit and ESLint security rules
- CodeQL analysis for Python and JavaScript

## Setup Instructions

### Required Secrets

Add these secrets in your GitHub repository settings:

#### Production Environment
```
SUPABASE_URL=your_production_supabase_url
SUPABASE_JWT_SECRET=your_jwt_secret
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  
SUPABASE_DB_CONNECTION=postgresql+asyncpg://user:pass@host:port/db
CODECOV_TOKEN=your_codecov_token
```

#### Optional (for notifications)
```
SLACK_WEBHOOK_URL=your_slack_webhook_url
```

### Environment Setup

1. **Create GitHub Environments:**
   - Go to Settings → Environments
   - Create `production` and `staging` environments
   - Add environment-specific secrets

2. **Configure Codecov:**
   - Sign up at [codecov.io](https://codecov.io)
   - Connect your repository
   - Copy the upload token to `CODECOV_TOKEN` secret

3. **Set up Slack notifications (optional):**
   - Create a Slack webhook URL
   - Add it as `SLACK_WEBHOOK_URL` secret

### Local Development Commands

The workflows use the same commands available locally:

#### Backend (server/)
```bash
poetry run poe lint       # Run ruff linting
poetry run poe format     # Format with ruff
poetry run poe test       # Run tests with coverage
poetry run mypy app/      # Type checking
```

#### Frontend (web/)
```bash
pnpm lint                 # ESLint
pnpm format:check         # Check Prettier formatting
pnpm type-check           # TypeScript checking
pnpm build               # Build application
```

#### Extension (extension/)
```bash
pnpm lint                 # ESLint
pnpm format:check         # Check Prettier formatting  
pnpm type-check           # TypeScript checking
pnpm build:chrome         # Build Chrome extension
pnpm build:firefox        # Build Firefox extension
```

## Workflow Status

You can monitor workflow status:
- In the GitHub Actions tab of your repository
- Via status checks on pull requests
- Through commit status indicators

## Troubleshooting

### Common Issues

1. **Database connection failures:**
   - Ensure PostgreSQL service is running
   - Check database connection strings

2. **Coverage upload failures:**
   - Verify `CODECOV_TOKEN` is set correctly
   - Check if coverage.xml file is generated

3. **Migration deployment failures:**
   - Verify production database credentials
   - Ensure migrations are valid

4. **Dependency caching issues:**
   - Clear cache in Actions → Caches
   - Check if lockfiles are committed

### Debug Tips

- Enable debug logging by setting `ACTIONS_STEP_DEBUG=true` repository secret
- Check workflow logs for detailed error messages
- Use workflow dispatch for manual testing