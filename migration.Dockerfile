# Build stage
FROM oven/bun:1.3.5 AS builder
WORKDIR /app

# Copy configuration files
COPY package.json bun.lock ./
COPY packages/database/package.json ./packages/database/
# Create dummy package.json for other workspaces to satisfy bun install
COPY apps/job-server/package.json ./apps/job-server/
RUN mkdir -p apps/nextjs-app && echo '{"name":"@streamystats/nextjs-app","version":"0.0.0","dependencies":{}}' > apps/nextjs-app/package.json

# Install dependencies
RUN bun install --frozen-lockfile

# Copy database package source
COPY packages/database ./packages/database

# Build the database package if needed (optional but good for consistency)
WORKDIR /app/packages/database
# RUN bun run build # Skipping build as we compile ts directly

# Compile the migration script to a single binary
# Buildx will run this stage per-platform, so this emits the correct arch binary.
RUN bun build ./src/migrate-entrypoint.ts --compile --minify --outfile migrate-bin

# Production runtime stage - Debian Slim (glibc compatible)
FROM debian:stable-slim AS runner

# Install minimal runtime deps for the compiled binary + TLS
RUN apt-get update && apt-get install -y ca-certificates libstdc++6 libgcc-s1 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled binary
COPY --from=builder /app/packages/database/migrate-bin ./migrate-bin

# Copy the migration SQL files (CRITICAL: Must be in ./drizzle relative to binary)
COPY --from=builder /app/packages/database/drizzle ./drizzle

ENV NODE_ENV=production

LABEL org.opencontainers.image.source="https://github.com/fredrikburmester/streamystats"

# Run the binary
CMD ["./migrate-bin"]
