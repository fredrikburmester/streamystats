# Build stage
FROM oven/bun:1.3.5 AS builder
WORKDIR /app

# Copy configuration files
COPY package.json bun.lock ./
COPY packages/database/package.json ./packages/database/
COPY apps/job-server/package.json ./apps/job-server/

# Create stub for nextjs-app to satisfy workspace requirements
RUN mkdir -p apps/nextjs-app && echo '{"name":"@streamystats/nextjs-app","version":"0.0.0","dependencies":{}}' > apps/nextjs-app/package.json

# Install dependencies
RUN bun install

# Copy source code
COPY packages/database ./packages/database
COPY apps/job-server ./apps/job-server

# Build the database package (if it requires a build step)
WORKDIR /app/packages/database
RUN bun run build

# Compile the migration runner to a single binary (used at container startup)
RUN bun build ./src/migrate-entrypoint.ts --compile --minify --outfile migrate-bin

# Compile the job-server to a single binary
WORKDIR /app/apps/job-server

# Install geoip-lite with its data (the package includes pre-built data files)
RUN bun add geoip-lite@1.4.10

# Compile for the current architecture (matches builder and runner)
RUN bun build ./src/index.ts --compile --minify --outfile server

# Production runtime stage - Debian Slim (glibc compatible)
FROM debian:stable-slim AS runner

# Install minimal dependencies (wget/curl for healthcheck)
RUN apt-get update && apt-get install -y curl ca-certificates && rm -rf /var/lib/apt/lists/*


WORKDIR /app

# Copy migration binary and drizzle files (migrate-bin expects ./drizzle relative to CWD)
COPY --from=builder /app/packages/database/migrate-bin ./migrate-bin
COPY --from=builder /app/packages/database/drizzle ./drizzle

# Copy only the compiled binary
COPY --from=builder /app/apps/job-server/server ./server

# Copy geoip-lite data files to the exact path bun expects at runtime
# Bun stores packages in .bun cache with version-specific paths
COPY --from=builder /app/apps/job-server/node_modules/geoip-lite/data ./node_modules/.bun/geoip-lite@1.4.10/node_modules/geoip-lite/data

# Environment setup
ENV NODE_ENV=production
ENV PORT=3005
ENV HOST=0.0.0.0

LABEL org.opencontainers.image.source="https://github.com/fredrikburmester/streamystats"

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://127.0.0.1:3005/health || exit 1

# Run migrations before starting the job server. Next.js depends on the job-server healthcheck,
# so this effectively enforces: db -> (migrate + job-server healthy) -> nextjs.
CMD ["sh", "-c", "./migrate-bin && exec ./server"]
