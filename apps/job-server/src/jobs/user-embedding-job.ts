import {
  db,
  items,
  sessions,
  users,
  servers,
  userEmbeddings,
} from "@streamystats/database";
import { and, eq, sql, isNotNull, gte } from "drizzle-orm";
import type { PgBossJob } from "../types/job-status";

// ─── Constants ───────────────────────────────────────────────────────────────

export const USER_EMBEDDING_JOB_NAME = "calculate-user-embeddings";

/** Users inactive longer than this many days are skipped. */
const ACTIVE_DAYS_THRESHOLD = 90;

/** Users with fewer than this many watched items with embeddings are skipped. */
const MIN_ITEMS_FOR_PROFILE = 3;

/** Half-life for recency decay ≈ 200 days (more forgiving). */
const RECENCY_LAMBDA = 0.0035;

/** Weight applied to items the user "bounced" from (<10% watched). */
const BOUNCE_WEIGHT = -0.3;

/** Freshness multiplier is documented but applied at query-time, not here. */

// Track if user embedding HNSW index has been ensured this session (per dimension)
const userIndexEnsuredForDimension = new Set<number>();

// ─── Job data ────────────────────────────────────────────────────────────────

interface CalculateUserEmbeddingsJobData {
  serverId: number;
}

// ─── HNSW index helper ───────────────────────────────────────────────────────

/**
 * Ensure an HNSW index exists on user_embeddings.embedding for the given
 * dimension, mirroring `ensureEmbeddingIndex` in embedding-jobs.ts.
 */
async function ensureUserEmbeddingIndex(dimensions: number): Promise<void> {
  if (userIndexEnsuredForDimension.has(dimensions)) return;

  // pgvector HNSW upper bound
  if (dimensions > 2000) {
    console.info(
      `[user-embeddings-index] dimensions=${dimensions} action=skip reason=exceedsMaxDimensions`
    );
    await db.execute(
      sql`DROP INDEX IF EXISTS user_embeddings_embedding_idx`
    );
    userIndexEnsuredForDimension.add(dimensions);
    return;
  }

  try {
    const existing = await db.execute<{
      indexname: string;
      indexdef: string;
    }>(sql`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'user_embeddings' AND indexname = 'user_embeddings_embedding_idx'
    `);

    if (existing.length > 0) {
      const def = existing[0].indexdef;
      const m = def.match(/vector\((\d+)\)/);
      if (m && parseInt(m[1]) === dimensions) {
        userIndexEnsuredForDimension.add(dimensions);
        return;
      }
      console.info(
        `[user-embeddings-index] dimensions=${dimensions} action=dropExisting reason=dimensionMismatch`
      );
      await db.execute(
        sql`DROP INDEX IF EXISTS user_embeddings_embedding_idx`
      );
    }

    console.info(
      `[user-embeddings-index] dimensions=${dimensions} action=create method=hnsw`
    );
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS user_embeddings_embedding_idx
      ON user_embeddings
      USING hnsw ((embedding::vector(${sql.raw(String(dimensions))})) vector_cosine_ops)
    `);
    userIndexEnsuredForDimension.add(dimensions);
  } catch (error) {
    console.warn("[user-embeddings-index] Could not create index:", error);
  }
}

// ─── Vector math helpers ─────────────────────────────────────────────────────

function normalizeVector(vec: number[]): number[] {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

function toPgVectorLiteral(value: number[]): string {
  return `[${value.join(",")}]`;
}

// ─── Per-user profile computation ────────────────────────────────────────────

interface WatchedItemForProfile {
  itemId: string;
  embedding: number[];
  type: string; // "Movie" or "Episode"
  seriesId: string | null;
  totalPlayDuration: number; // in ticks
  expectedRuntime: number; // in ticks (runtimeTicks from items)
  lastWatchedMs: number; // epoch ms of last watch
  episodeCount: number; // 1 for movies, actual count for series groups
}

async function computeUserProfile(
  serverId: number,
  userId: string,
  now: number
): Promise<{ embedding: number[]; itemCount: number } | null> {
  // ── Fetch movie watch data ───────────────────────────────────────────────
  const movieRows = await db
    .select({
      itemId: sessions.itemId,
      embedding: items.embedding,
      type: items.type,
      seriesId: items.seriesId,
      totalPlayDuration:
        sql<number>`SUM(${sessions.playDuration})`.as("totalPlayDuration"),
      expectedRuntime: items.runtimeTicks,
      lastWatched: sql<string>`MAX(${sessions.endTime})`.as("lastWatched"),
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .where(
      and(
        eq(sessions.serverId, serverId),
        eq(sessions.userId, userId),
        eq(items.type, "Movie"),
        isNotNull(items.embedding),
        isNotNull(sessions.playDuration)
      )
    )
    .groupBy(sessions.itemId, items.id);

  // ── Fetch series watch data (episodes aggregated to series) ──────────────
  const seriesRows = await db
    .select({
      seriesId: sessions.seriesId,
      embedding: items.embedding,
      episodeCount:
        sql<number>`COUNT(DISTINCT ${sessions.itemId})`.as("episodeCount"),
      lastWatched: sql<string>`MAX(${sessions.endTime})`.as("lastWatched"),
    })
    .from(sessions)
    .innerJoin(
      items,
      and(eq(items.id, sessions.seriesId), eq(items.type, "Series"))
    )
    .where(
      and(
        eq(sessions.serverId, serverId),
        eq(sessions.userId, userId),
        isNotNull(sessions.seriesId),
        isNotNull(items.embedding),
        isNotNull(sessions.playDuration)
      )
    )
    .groupBy(sessions.seriesId, items.id);

  // ── Build unified list ───────────────────────────────────────────────────
  const watched: WatchedItemForProfile[] = [];

  for (const row of movieRows) {
    if (!row.embedding || !row.itemId) continue;
    const expectedRuntime = row.expectedRuntime ?? 0;
    const totalPlayDuration = row.totalPlayDuration ?? 0;
    watched.push({
      itemId: row.itemId,
      embedding: row.embedding,
      type: "Movie",
      seriesId: null,
      totalPlayDuration,
      expectedRuntime,
      lastWatchedMs: row.lastWatched
        ? new Date(row.lastWatched).getTime()
        : now,
      episodeCount: 1,
    });
  }

  for (const row of seriesRows) {
    if (!row.embedding || !row.seriesId) continue;
    watched.push({
      itemId: row.seriesId,
      embedding: row.embedding,
      type: "Series",
      seriesId: row.seriesId,
      totalPlayDuration: 0,
      expectedRuntime: 0,
      lastWatchedMs: row.lastWatched
        ? new Date(row.lastWatched).getTime()
        : now,
      episodeCount: row.episodeCount ?? 1,
    });
  }

  if (watched.length < MIN_ITEMS_FOR_PROFILE) return null;

  // ── Compute weighted average ─────────────────────────────────────────────
  const dims = watched[0].embedding.length;
  const profile = new Array<number>(dims).fill(0);
  let totalAbsWeight = 0;

  for (const item of watched) {
    if (item.embedding.length !== dims) continue; // dimension mismatch guard

    const daysSinceWatched =
      (now - item.lastWatchedMs) / (1000 * 60 * 60 * 24);
    const recencyDecay = Math.exp(-RECENCY_LAMBDA * daysSinceWatched);

    let weight: number;
    if (item.type === "Movie") {
      const expectedRuntimeSeconds = item.expectedRuntime / 10_000_000;
      const completionRatio =
        expectedRuntimeSeconds > 0
          ? item.totalPlayDuration / expectedRuntimeSeconds
          : 0;

      if (completionRatio < 0.1) {
        weight = BOUNCE_WEIGHT;
      } else {
        weight = completionRatio * recencyDecay;
      }
    } else {
      // Series: engagement = min(episodes / 5, 1)
      const engagement = Math.min(item.episodeCount / 5, 1.0);
      weight = engagement * recencyDecay;
    }

    for (let d = 0; d < dims; d++) {
      profile[d] += weight * item.embedding[d];
    }
    totalAbsWeight += Math.abs(weight);
  }

  if (totalAbsWeight === 0) return null;

  // Average, then normalize to unit length
  for (let d = 0; d < dims; d++) {
    profile[d] /= totalAbsWeight;
  }

  return {
    embedding: normalizeVector(profile),
    itemCount: watched.length,
  };
}

// ─── Main job handler ────────────────────────────────────────────────────────

export async function calculateUserEmbeddingsJob(
  job: PgBossJob<CalculateUserEmbeddingsJobData>
) {
  const { serverId } = job.data;
  const startTime = Date.now();

  console.log(`[user-embeddings] action=start serverId=${serverId}`);

  try {
    // ── Get server embedding dimensions ──────────────────────────────────
    const server = await db
      .select({
        embeddingDimensions: servers.embeddingDimensions,
      })
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    const dimensions = server[0]?.embeddingDimensions ?? 1536;

    // Ensure HNSW index for user embeddings
    await ensureUserEmbeddingIndex(dimensions);

    // ── Get active users ─────────────────────────────────────────────────
    const cutoff = new Date(
      Date.now() - ACTIVE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000
    );

    const activeUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.serverId, serverId),
          gte(users.lastActivityDate, cutoff)
        )
      );

    if (activeUsers.length === 0) {
      console.log(
        `[user-embeddings] action=complete serverId=${serverId} users=0`
      );
      return { usersProcessed: 0, usersSkipped: 0 };
    }

    console.log(
      `[user-embeddings] serverId=${serverId} activeUsers=${activeUsers.length}`
    );

    let processed = 0;
    let skipped = 0;
    const now = Date.now();

    for (const user of activeUsers) {
      const result = await computeUserProfile(serverId, user.id, now);

      if (!result) {
        skipped++;
        continue;
      }

      // Upsert
      await db
        .insert(userEmbeddings)
        .values({
          userId: user.id,
          serverId,
          embedding: result.embedding,
          itemCount: result.itemCount,
          lastCalculatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userEmbeddings.userId, userEmbeddings.serverId],
          set: {
            embedding: sql`${toPgVectorLiteral(result.embedding)}::vector`,
            itemCount: result.itemCount,
            lastCalculatedAt: new Date(),
            updatedAt: new Date(),
          },
        });

      processed++;
    }

    const duration = Date.now() - startTime;
    console.log(
      `[user-embeddings] action=complete serverId=${serverId} processed=${processed} skipped=${skipped} durationMs=${duration}`
    );

    return { usersProcessed: processed, usersSkipped: skipped };
  } catch (error) {
    console.error(
      `[user-embeddings] action=error serverId=${serverId}`,
      error
    );
    throw error;
  }
}
