# 1. Base image with Node.js
FROM node:20-alpine AS base
WORKDIR /app

# 2. Install dependencies with pnpm
FROM base AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 3. Build the Next.js app
FROM base AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# 4. Production image
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=8042
EXPOSE 8042

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

WORKDIR /app

COPY --chown=nextjs:nodejs --from=builder /app/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/.next ./.next
COPY --chown=nextjs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs --from=builder /app/package.json ./package.json

USER nextjs

CMD ["node_modules/.bin/next", "start", "-p", "8042"]