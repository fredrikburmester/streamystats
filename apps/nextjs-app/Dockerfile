# syntax=docker/dockerfile:1.7

# Dependencies stage - Full Bun
FROM oven/bun:1.3.5-alpine AS deps

# Install system dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++ vips-dev

WORKDIR /app

# Copy workspace configuration
COPY package.json bun.lock* ./

# Copy all package.json files for workspace structure
COPY packages/database/package.json ./packages/database/
COPY apps/nextjs-app/package.json ./apps/nextjs-app/
COPY apps/job-server/package.json ./apps/job-server/

# Install dependencies with Bun
RUN --mount=type=cache,target=/root/.bun \
    bun install --frozen-lockfile

# Database build stage
FROM deps AS database-builder

COPY packages/database ./packages/database

WORKDIR /app/packages/database
RUN bun run build

# NextJS build stage
FROM database-builder AS nextjs-builder

WORKDIR /app

COPY apps/nextjs-app ./apps/nextjs-app

ARG VERSION=latest
ARG COMMIT_SHA
ARG BUILD_TIME
ENV NEXT_PUBLIC_VERSION=${VERSION}
ENV NEXT_PUBLIC_COMMIT_SHA=${COMMIT_SHA}
ENV NEXT_PUBLIC_BUILD_TIME=${BUILD_TIME}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js with Bun
WORKDIR /app/apps/nextjs-app
RUN --mount=type=cache,target=/app/apps/nextjs-app/.next/cache \
    bun --bun next build --experimental-build-mode compile

# Production runtime stage
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat vips curl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

LABEL org.opencontainers.image.source="https://github.com/fredrikburmester/streamystats"

# Copy standalone build
COPY --from=nextjs-builder --chown=nextjs:nodejs /app/apps/nextjs-app/.next/standalone ./
COPY --from=nextjs-builder --chown=nextjs:nodejs /app/apps/nextjs-app/.next/static ./apps/nextjs-app/.next/static
COPY --from=nextjs-builder --chown=nextjs:nodejs /app/apps/nextjs-app/public ./apps/nextjs-app/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/api/health || exit 1

WORKDIR /app/apps/nextjs-app

CMD ["node", "server.js"]
