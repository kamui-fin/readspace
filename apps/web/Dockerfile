# 1. Base image
FROM oven/bun:latest
WORKDIR /app

# Copy workspace configuration and package files
COPY bun.lock package.json turbo.json ./

# Copy package.json files for all workspaces (bun needs complete workspace structure)
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Copy TypeScript and ESLint config files (needed before build)
COPY packages/typescript-config/*.json ./packages/typescript-config/
COPY packages/eslint-config/*.js ./packages/eslint-config/

# Install dependencies

# For canvas dependency:
RUN apt-get update && apt-get install -y python3 make g++ pkg-config libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

RUN bun install

# Copy source files for the build (after install, so we don't invalidate cache)
COPY apps/web ./apps/web
COPY packages ./packages

# Add node_modules/.bin to PATH for CLI tools
ENV PATH="/app/node_modules/.bin:$PATH"

# Build Next.js (standalone output)
RUN turbo run build

ENV NODE_ENV=production
ENV PORT=8042
EXPOSE 8042

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
USER nextjs


WORKDIR /app/apps/web

# Start the app
CMD ["bun", "run", "start"]