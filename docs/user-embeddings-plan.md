# Pre-computed User Embeddings for Fast Recommendations

Replace the per-request N+1 similarity search in both Movie and Series recommendations with a batch-precomputed **single unified taste profile** per user, making each live query a single HNSW-indexed vector search.

## Phase 1 — Database Schema

### New `user_embeddings` table

One row per user per server — a single unified taste vector combining Movies and Series.

```typescript
export const userEmbeddings = pgTable(
  "user_embeddings",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    serverId: integer("server_id").notNull().references(() => servers.id, { onDelete: "cascade" }),
    embedding: vector("embedding").notNull(),
    itemCount: integer("item_count").notNull().default(0),
    lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("user_embeddings_user_server_unique").on(table.userId, table.serverId),
    index("user_embeddings_server_id_idx").on(table.serverId),
  ]
);
```

Files: `packages/database/src/schema.ts` (table + relations + types), then `drizzle-kit generate`.

## Phase 2 — Nightly Batch Job

### New `user-embedding-job.ts`

Per-server pg-boss job (`"user-embeddings-sync"`, cron `0 3 * * *`, category `ai`).

For each active user (last activity within 90 days):

1. Fetch all sessions joined with items (both Movies and Episodes) where `items.embedding IS NOT NULL`
2. For Movies: weight = `(percentComplete / 100) × exp(-0.01 × daysSinceWatched)`. Items with `percentComplete < 10` get weight `-0.3` (bounce penalty)
3. For Episodes: group by `seriesId`, fetch Series-level embedding, weight = `min(episodeCount / 5, 1.0) × exp(-0.01 × daysSinceLastEpisode)`
4. Combine all weighted embeddings (movies + series) → normalize to unit length
5. Upsert into `user_embeddings`
6. `ensureUserEmbeddingIndex(dimensions)` — creates HNSW index on `user_embeddings.embedding`

Skip users with < 3 total items with embeddings.

Register in: `job-defaults.ts`, `index.ts`, `queue.ts`, `scheduler.ts`.

## Phase 3 — Unified Live Query

### New `recommendation-engine.ts`

Core: `getProfileRecommendations(serverId, userId, targetType, limit, offset)`

1. Read `user_embeddings` for the user
2. If no profile → return `[]` (fallback graceful degradation)
3. Single `cosineDistance` query against items of `targetType`, filtering out watched + hidden + deleted
4. Freshness bump: `×1.1` for items added in last 14 days
5. Return top `limit`

### Caller integration

- `similar-statistics.ts` → `getSimilarStatistics` delegates to engine (targetType = `"Movie"`)
- `similar-series-statistics.ts` → `getSimilarSeries` delegates to engine (targetType = `"Series"`)
- Item-based functions (`getSimilarItemsForItem`, `getSimilarSeriesForItem`) unchanged
- `basedOn` field dropped from return type; UI components updated accordingly
