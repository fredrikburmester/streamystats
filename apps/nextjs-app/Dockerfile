# Dependencies stage
FROM node:23-alpine AS deps

# Install system dependencies including build tools for native dependencies
RUN apk add --no-cache libc6-compat wget python3 make g++ vips-dev

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configuration files
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# Copy all package.json files to establish workspace structure
COPY packages/database/package.json ./packages/database/
COPY apps/nextjs-app/package.json ./apps/nextjs-app/
COPY apps/job-server/package.json ./apps/job-server/

# Install all dependencies with frozen lockfile and ensure proper installation
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile

# Database build stage
FROM deps AS database-builder

# Copy database source
COPY packages/database ./packages/database

# Build database package
RUN pnpm --filter @streamystats/database build

# NextJS build stage
FROM database-builder AS nextjs-builder

# Copy NextJS source
COPY apps/nextjs-app ./apps/nextjs-app

# Set version information
ARG VERSION=latest
ARG COMMIT_SHA
ARG BUILD_TIME
ENV NEXT_PUBLIC_VERSION=${VERSION}
ENV NEXT_PUBLIC_COMMIT_SHA=${COMMIT_SHA}
ENV NEXT_PUBLIC_BUILD_TIME=${BUILD_TIME}

# Ensure all dependencies are properly linked and available
RUN pnpm install --offline --frozen-lockfile

# Verify Next.js is properly installed
RUN ls -la apps/nextjs-app/node_modules/.bin/ || echo "No .bin directory found"
RUN test -f apps/nextjs-app/node_modules/.bin/next || echo "Next.js binary not found in .bin"
RUN pnpm list next --filter @streamystats/nextjs-app || echo "Next.js not found in dependencies"

# Build the NextJS application with cache mount for Next.js build cache only
RUN --mount=type=cache,target=/app/apps/nextjs-app/.next/cache \
    pnpm --filter @streamystats/nextjs-app build

# Production runtime stage
FROM node:23-alpine AS runner

# Install system dependencies
RUN apk add --no-cache libc6-compat wget vips

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Copy the standalone build output
COPY --from=nextjs-builder --chown=nextjs:nodejs /app/apps/nextjs-app/.next/standalone ./
COPY --from=nextjs-builder --chown=nextjs:nodejs /app/apps/nextjs-app/.next/static ./apps/nextjs-app/.next/static
COPY --from=nextjs-builder --chown=nextjs:nodejs /app/apps/nextjs-app/public ./apps/nextjs-app/public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application using the standalone server
CMD ["/usr/local/bin/node", "apps/nextjs-app/server.js"]
