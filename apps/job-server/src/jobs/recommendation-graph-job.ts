import {
  type AnchorItem,
  db,
  type NewUserTasteProfile,
  type PersonAffinity,
  userTasteProfiles,
} from "@streamystats/database";
import { sql } from "drizzle-orm";
import { nowIsoMicroUtc, publishJobEvent } from "../events/job-events";
import { structuredLog as log } from "../utils/structured-log";
import { logJobResult } from "./job-logger";
import type { PgBossJob } from "../types/job-status";

export const RECOMMENDATION_GRAPH_JOB_NAME = "build-recommendation-graph";

export interface RecommendationGraphJobData {
  serverId: number;
}

export interface RecommendationGraphResult {
  serverId: number;
  coWatchedEdges: number;
  sharedPeopleEdges: number;
  embeddingEdges: number;
  profilesUpdated: number;
}

/**
 * Half-life style recency decay: 1.0 for "watched today", ~0.5 after 90 days.
 */
export function recencyWeight(lastWatched: Date | null, now: Date): number {
  if (!lastWatched) return 0.3;
  const days = Math.max(0, (now.getTime() - lastWatched.getTime()) / 86_400_000);
  return Math.exp((-Math.LN2 * days) / 90);
}

function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return 1;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 1;
  return 1 - dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Rebuild collaborative "co_watched" edges for a server.
 *
 * Two items are connected when at least two users have watched both.
 * Episodes roll up to their series so the graph works at the title level.
 * Weight is the Jaccard overlap of the two items' audiences, which keeps
 * universally-popular items from dominating every neighbourhood.
 */
async function buildCoWatchedEdges(serverId: number): Promise<number> {
  await db.execute(
    sql`DELETE FROM item_edges WHERE server_id = ${serverId} AND edge_type = 'co_watched'`,
  );

  const result = await db.execute(sql`
    WITH user_items AS (
      SELECT DISTINCT s.user_id,
        CASE WHEN i.type = 'Episode' THEN i.series_id ELSE i.id END AS item_id
      FROM sessions s
      JOIN items i ON i.id = s.item_id
      WHERE s.server_id = ${serverId}
        AND s.play_duration IS NOT NULL AND s.play_duration > 0
        AND (
          (i.type = 'Movie' AND s.percent_complete > 50)
          OR (i.type = 'Episode' AND i.series_id IS NOT NULL)
          OR i.type = 'Series'
        )
    ),
    valid_items AS (
      SELECT ui.user_id, ui.item_id
      FROM user_items ui
      JOIN items i ON i.id = ui.item_id AND i.deleted_at IS NULL
      WHERE ui.item_id IS NOT NULL
    ),
    item_counts AS (
      SELECT item_id, COUNT(*)::float AS cnt FROM valid_items GROUP BY item_id
    ),
    pairs AS (
      SELECT a.item_id AS source_id, b.item_id AS target_id, COUNT(*)::float AS common
      FROM valid_items a
      JOIN valid_items b ON a.user_id = b.user_id AND a.item_id <> b.item_id
      GROUP BY 1, 2
      HAVING COUNT(*) >= 2
    ),
    ranked AS (
      SELECT p.source_id, p.target_id, p.common,
        p.common / (ca.cnt + cb.cnt - p.common) AS jaccard,
        ROW_NUMBER() OVER (
          PARTITION BY p.source_id
          ORDER BY p.common / (ca.cnt + cb.cnt - p.common) DESC
        ) AS rn
      FROM pairs p
      JOIN item_counts ca ON ca.item_id = p.source_id
      JOIN item_counts cb ON cb.item_id = p.target_id
    )
    INSERT INTO item_edges (server_id, source_item_id, target_item_id, edge_type, weight, metadata)
    SELECT ${serverId}, source_id, target_id, 'co_watched',
      LEAST(1.0, jaccard),
      jsonb_build_object('commonUsers', common::int)
    FROM ranked
    WHERE rn <= 30
    ON CONFLICT ON CONSTRAINT item_edges_unique
    DO UPDATE SET weight = EXCLUDED.weight, metadata = EXCLUDED.metadata, computed_at = now()
  `);
  return result.count ?? 0;
}

/**
 * Rebuild "shared_people" edges for a server.
 *
 * Connects movies/series that share creative talent. Directors and writers
 * weigh more than actors, and only top-billed actors are considered so that
 * bit parts do not create edges. A minimum raw weight of 2 means a shared
 * director, a shared writer, or at least two shared top actors.
 */
async function buildSharedPeopleEdges(serverId: number): Promise<number> {
  await db.execute(
    sql`DELETE FROM item_edges WHERE server_id = ${serverId} AND edge_type = 'shared_people'`,
  );

  const result = await db.execute(sql`
    WITH ip AS (
      SELECT x.item_id, x.person_id, x.type
      FROM item_people x
      JOIN items i ON i.id = x.item_id
      WHERE x.server_id = ${serverId}
        AND i.type IN ('Movie', 'Series')
        AND i.deleted_at IS NULL
        AND (
          x.type IN ('Director', 'Writer')
          OR (x.type = 'Actor' AND COALESCE(x.sort_order, 99) < 8)
        )
    ),
    pairs AS (
      SELECT a.item_id AS source_id, b.item_id AS target_id,
        SUM(CASE a.type WHEN 'Director' THEN 3.0 WHEN 'Writer' THEN 2.0 ELSE 1.0 END) AS raw_weight,
        (array_agg(DISTINCT p.name || ' (' || a.type || ')'))[1:3] AS people_labels
      FROM ip a
      JOIN ip b ON a.person_id = b.person_id AND a.type = b.type AND a.item_id <> b.item_id
      JOIN people p ON p.id = a.person_id AND p.server_id = ${serverId}
      GROUP BY 1, 2
      HAVING SUM(CASE a.type WHEN 'Director' THEN 3.0 WHEN 'Writer' THEN 2.0 ELSE 1.0 END) >= 2.0
    ),
    ranked AS (
      SELECT source_id, target_id, raw_weight, people_labels,
        ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY raw_weight DESC) AS rn
      FROM pairs
    )
    INSERT INTO item_edges (server_id, source_item_id, target_item_id, edge_type, weight, metadata)
    SELECT ${serverId}, source_id, target_id, 'shared_people',
      LEAST(1.0, raw_weight / 8.0),
      jsonb_build_object('people', to_jsonb(people_labels))
    FROM ranked
    WHERE rn <= 25
    ON CONFLICT ON CONSTRAINT item_edges_unique
    DO UPDATE SET weight = EXCLUDED.weight, metadata = EXCLUDED.metadata, computed_at = now()
  `);
  return result.count ?? 0;
}

/**
 * Rebuild "embedding" edges for a server: the top semantic nearest
 * neighbours of every movie/series, materialized so the query-time engine
 * can combine them with the other edge types in one graph lookup.
 */
async function buildEmbeddingEdges(serverId: number): Promise<number> {
  await db.execute(
    sql`DELETE FROM item_edges WHERE server_id = ${serverId} AND edge_type = 'embedding'`,
  );

  const result = await db.execute(sql`
    INSERT INTO item_edges (server_id, source_item_id, target_item_id, edge_type, weight, metadata)
    SELECT ${serverId}, i.id, nn.id, 'embedding', GREATEST(0.0, LEAST(1.0, nn.sim)), NULL
    FROM items i
    CROSS JOIN LATERAL (
      SELECT i2.id, 1 - (i.embedding <=> i2.embedding) AS sim
      FROM items i2
      WHERE i2.server_id = ${serverId}
        AND i2.type = i.type
        AND i2.id <> i.id
        AND i2.embedding IS NOT NULL
        AND i2.deleted_at IS NULL
        AND vector_dims(i2.embedding) = vector_dims(i.embedding)
      ORDER BY i.embedding <=> i2.embedding
      LIMIT 15
    ) nn
    WHERE i.server_id = ${serverId}
      AND i.type IN ('Movie', 'Series')
      AND i.embedding IS NOT NULL
      AND i.deleted_at IS NULL
      AND nn.sim > 0.15
    ON CONFLICT ON CONSTRAINT item_edges_unique
    DO UPDATE SET weight = EXCLUDED.weight, computed_at = now()
  `);
  return result.count ?? 0;
}

interface WatchedItemRow {
  itemId: string;
  type: string;
  genres: string[] | null;
  productionYear: number | null;
  communityRating: number | null;
  runtimeTicks: number | null;
  embedding: number[] | null;
  watchSeconds: number;
  lastWatched: Date | null;
  maxPercentComplete: number | null;
}

/**
 * Compute and persist the enriched taste profile for one user.
 * Returns false when the user has no usable watch history.
 */
async function buildProfileForUser(
  serverId: number,
  userId: string,
  now: Date,
): Promise<boolean> {
  // Watch history rolled up to title level (episodes -> series)
  const rows = await db.execute(sql`
    WITH watched AS (
      SELECT
        CASE WHEN i.type = 'Episode' THEN i.series_id ELSE i.id END AS item_id,
        SUM(s.play_duration) AS watch_seconds,
        MAX(s.end_time) AS last_watched,
        MAX(s.percent_complete) AS max_pct
      FROM sessions s
      JOIN items i ON i.id = s.item_id
      WHERE s.server_id = ${serverId}
        AND s.user_id = ${userId}
        AND s.play_duration IS NOT NULL AND s.play_duration > 0
        AND i.type IN ('Movie', 'Episode', 'Series')
      GROUP BY 1
    )
    SELECT w.item_id AS "itemId", i.type, i.genres,
      i.production_year AS "productionYear",
      i.community_rating AS "communityRating",
      i.runtime_ticks AS "runtimeTicks",
      i.embedding,
      w.watch_seconds AS "watchSeconds",
      w.last_watched AS "lastWatched",
      w.max_pct AS "maxPercentComplete"
    FROM watched w
    JOIN items i ON i.id = w.item_id AND i.deleted_at IS NULL
    ORDER BY w.watch_seconds DESC
    LIMIT 300
  `);

  const watched: WatchedItemRow[] = [];
  for (const raw of rows as unknown as Record<string, unknown>[]) {
    const embedding =
      typeof raw.embedding === "string"
        ? raw.embedding
            .slice(1, -1)
            .split(",")
            .map((v) => Number.parseFloat(v))
        : null;
    watched.push({
      itemId: String(raw.itemId),
      type: String(raw.type),
      genres: Array.isArray(raw.genres) ? (raw.genres as string[]) : null,
      productionYear:
        raw.productionYear === null ? null : Number(raw.productionYear),
      communityRating:
        raw.communityRating === null ? null : Number(raw.communityRating),
      runtimeTicks: raw.runtimeTicks === null ? null : Number(raw.runtimeTicks),
      embedding,
      watchSeconds: Number(raw.watchSeconds) || 0,
      lastWatched: raw.lastWatched ? new Date(String(raw.lastWatched)) : null,
      maxPercentComplete:
        raw.maxPercentComplete === null ? null : Number(raw.maxPercentComplete),
    });
  }

  if (watched.length === 0) return false;

  // Per-item interest weight: how much watch time, decayed by recency
  const maxWatch = Math.max(...watched.map((w) => w.watchSeconds), 1);
  const weights = watched.map((w) => {
    const volume = Math.log1p(w.watchSeconds) / Math.log1p(maxWatch);
    return 0.45 * recencyWeight(w.lastWatched, now) + 0.55 * volume;
  });

  // Genre and decade affinities (normalized so the top entry is 1.0)
  const genreAcc: Record<string, number> = {};
  const decadeAcc: Record<string, number> = {};
  let ratingSum = 0;
  let ratingWeight = 0;
  let runtimeSum = 0;
  let runtimeWeight = 0;

  watched.forEach((w, idx) => {
    const weight = weights[idx];
    for (const genre of w.genres ?? []) {
      genreAcc[genre] = (genreAcc[genre] ?? 0) + weight;
    }
    if (w.productionYear) {
      const decade = `${Math.floor(w.productionYear / 10) * 10}s`;
      decadeAcc[decade] = (decadeAcc[decade] ?? 0) + weight;
    }
    if (w.communityRating !== null) {
      ratingSum += w.communityRating * weight;
      ratingWeight += weight;
    }
    if (w.type === "Movie" && w.runtimeTicks) {
      runtimeSum += (w.runtimeTicks / 600_000_000) * weight;
      runtimeWeight += weight;
    }
  });

  const normalizeTop = (acc: Record<string, number>, keep: number) => {
    const entries = Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, keep);
    const max = entries[0]?.[1] ?? 1;
    return Object.fromEntries(entries.map(([k, v]) => [k, v / max]));
  };

  // Taste embedding: interest-weighted centroid
  const embedded = watched
    .map((w, idx) => ({ embedding: w.embedding, weight: weights[idx] }))
    .filter((e): e is { embedding: number[]; weight: number } => e.embedding !== null);

  let tasteEmbedding: number[] | null = null;
  let noveltyScore: number | null = null;
  if (embedded.length > 0) {
    const dims = embedded[0].embedding.length;
    const usable = embedded.filter((e) => e.embedding.length === dims);
    const totalWeight = usable.reduce((s, e) => s + e.weight, 0) || 1;
    tasteEmbedding = new Array(dims).fill(0);
    for (const { embedding, weight } of usable) {
      for (let i = 0; i < dims; i++) {
        tasteEmbedding[i] += (embedding[i] * weight) / totalWeight;
      }
    }
    if (usable.length >= 2) {
      const centroid = tasteEmbedding;
      const avgDistance =
        usable.reduce((s, e) => s + cosineDistance(e.embedding, centroid), 0) /
        usable.length;
      noveltyScore = Math.min(1, Math.max(0, avgDistance * 2));
    }
  }

  // Completion rate over movies the user started
  const startedMovies = watched.filter((w) => w.type === "Movie");
  const completedMovies = startedMovies.filter(
    (w) => (w.maxPercentComplete ?? 0) >= 85,
  );
  const completionRate =
    startedMovies.length > 0
      ? completedMovies.length / startedMovies.length
      : null;

  // Anchor items: the titles that best represent current taste
  const anchorItems: AnchorItem[] = watched
    .map((w, idx) => ({
      itemId: w.itemId,
      weight: weights[idx],
      mediaType: w.type === "Episode" ? "Series" : w.type,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 12);

  // People affinities from the user's watched titles
  const watchedIds = watched.map((w) => w.itemId);
  const peopleRows = await db.execute(sql`
    SELECT ip.person_id AS "personId", p.name, ip.type, COUNT(*)::int AS cnt
    FROM item_people ip
    JOIN people p ON p.id = ip.person_id AND p.server_id = ip.server_id
    WHERE ip.server_id = ${serverId}
      AND ip.item_id = ANY(${watchedIds})
      AND (
        ip.type IN ('Director', 'Writer')
        OR (ip.type = 'Actor' AND COALESCE(ip.sort_order, 99) < 5)
      )
    GROUP BY 1, 2, 3
    HAVING COUNT(*) >= 2
    ORDER BY cnt DESC
    LIMIT 20
  `);

  const peopleList = peopleRows as unknown as Array<{
    personId: string;
    name: string;
    type: string;
    cnt: number;
  }>;
  const maxCnt = peopleList[0]?.cnt ?? 1;
  const peopleAffinities: PersonAffinity[] = peopleList.map((p) => ({
    id: p.personId,
    name: p.name,
    type: p.type,
    weight: p.cnt / maxCnt,
  }));

  const totalWatchSeconds = watched.reduce((s, w) => s + w.watchSeconds, 0);

  const profile: NewUserTasteProfile = {
    serverId,
    userId,
    tasteEmbedding,
    genreWeights: normalizeTop(genreAcc, 15),
    decadeWeights: normalizeTop(decadeAcc, 8),
    peopleAffinities,
    preferredRuntimeMins: runtimeWeight > 0 ? runtimeSum / runtimeWeight : null,
    ratingAffinity: ratingWeight > 0 ? ratingSum / ratingWeight : null,
    noveltyScore,
    completionRate,
    watchedItemCount: watched.length,
    totalWatchSeconds,
    anchorItems,
    computedAt: now,
  };

  await db
    .insert(userTasteProfiles)
    .values(profile)
    .onConflictDoUpdate({
      target: [userTasteProfiles.serverId, userTasteProfiles.userId],
      set: {
        tasteEmbedding: profile.tasteEmbedding,
        genreWeights: profile.genreWeights,
        decadeWeights: profile.decadeWeights,
        peopleAffinities: profile.peopleAffinities,
        preferredRuntimeMins: profile.preferredRuntimeMins,
        ratingAffinity: profile.ratingAffinity,
        noveltyScore: profile.noveltyScore,
        completionRate: profile.completionRate,
        watchedItemCount: profile.watchedItemCount,
        totalWatchSeconds: profile.totalWatchSeconds,
        anchorItems: profile.anchorItems,
        computedAt: now,
      },
    });

  return true;
}

async function buildUserProfiles(serverId: number, now: Date): Promise<number> {
  const userRows = await db.execute(sql`
    SELECT DISTINCT user_id AS "userId" FROM sessions
    WHERE server_id = ${serverId} AND user_id IS NOT NULL
  `);

  let updated = 0;
  for (const row of userRows as unknown as Array<{ userId: string }>) {
    try {
      if (await buildProfileForUser(serverId, row.userId, now)) {
        updated++;
      }
    } catch (error) {
      log("recommendation-graph", {
        action: "profile-error",
        serverId,
        userId: row.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return updated;
}

export async function buildRecommendationGraphJob(
  job: PgBossJob<RecommendationGraphJobData>,
): Promise<RecommendationGraphResult> {
  const { serverId } = job.data;
  const startTime = Date.now();
  const now = new Date();

  log("recommendation-graph", { action: "start", serverId });
  publishJobEvent({
    type: "started",
    jobId: job.id,
    jobName: RECOMMENDATION_GRAPH_JOB_NAME,
    serverId,
    timestamp: nowIsoMicroUtc(),
  });

  try {
    const coWatchedEdges = await buildCoWatchedEdges(serverId);
    const sharedPeopleEdges = await buildSharedPeopleEdges(serverId);
    const embeddingEdges = await buildEmbeddingEdges(serverId);
    const profilesUpdated = await buildUserProfiles(serverId, now);

    const result: RecommendationGraphResult = {
      serverId,
      coWatchedEdges,
      sharedPeopleEdges,
      embeddingEdges,
      profilesUpdated,
    };

    log("recommendation-graph", {
      action: "complete",
      serverId,
      coWatchedEdges,
      sharedPeopleEdges,
      embeddingEdges,
      profilesUpdated,
      durationMs: Date.now() - startTime,
    });

    await logJobResult(
      job.id,
      RECOMMENDATION_GRAPH_JOB_NAME,
      "completed",
      { ...result },
      Date.now() - startTime,
    );
    publishJobEvent({
      type: "completed",
      jobId: job.id,
      jobName: RECOMMENDATION_GRAPH_JOB_NAME,
      serverId,
      data: result,
      timestamp: nowIsoMicroUtc(),
    });

    return result;
  } catch (error) {
    log("recommendation-graph", {
      action: "failed",
      serverId,
      error: error instanceof Error ? error.message : String(error),
    });
    await logJobResult(
      job.id,
      RECOMMENDATION_GRAPH_JOB_NAME,
      "failed",
      { serverId },
      Date.now() - startTime,
      error instanceof Error ? error : String(error),
    );
    publishJobEvent({
      type: "failed",
      jobId: job.id,
      jobName: RECOMMENDATION_GRAPH_JOB_NAME,
      serverId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: nowIsoMicroUtc(),
    });
    throw error;
  }
}
