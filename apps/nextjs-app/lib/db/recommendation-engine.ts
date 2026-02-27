"use server";

import { db } from "@streamystats/database";
import {
  hiddenRecommendations,
  items,
  sessions,
  userEmbeddings,
} from "@streamystats/database/schema";
import {
  and,
  cosineDistance,
  desc,
  eq,
  isNotNull,
  isNull,
  notInArray,
  sql,
} from "drizzle-orm";

// ─── Shared select shapes ────────────────────────────────────────────────────

const recommendationItemCardSelect = {
  id: items.id,
  name: items.name,
  type: items.type,
  productionYear: items.productionYear,
  runtimeTicks: items.runtimeTicks,
  genres: items.genres,
  communityRating: items.communityRating,
  primaryImageTag: items.primaryImageTag,
  primaryImageThumbTag: items.primaryImageThumbTag,
  primaryImageLogoTag: items.primaryImageLogoTag,
  backdropImageTags: items.backdropImageTags,
  seriesId: items.seriesId,
  seriesPrimaryImageTag: items.seriesPrimaryImageTag,
  parentBackdropItemId: items.parentBackdropItemId,
  parentBackdropImageTags: items.parentBackdropImageTags,
  parentThumbItemId: items.parentThumbItemId,
  parentThumbImageTag: items.parentThumbImageTag,
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecommendationCardItem {
  id: string;
  name: string;
  type: string | null;
  productionYear: number | null;
  runtimeTicks: number | null;
  genres: string[] | null;
  communityRating: number | null;
  primaryImageTag: string | null;
  primaryImageThumbTag: string | null;
  primaryImageLogoTag: string | null;
  backdropImageTags: string[] | null;
  seriesId: string | null;
  seriesPrimaryImageTag: string | null;
  parentBackdropItemId: string | null;
  parentBackdropImageTags: string[] | null;
  parentThumbItemId: string | null;
  parentThumbImageTag: string | null;
}

export interface RecommendationResult {
  item: RecommendationCardItem;
  similarity: number;
  basedOn: RecommendationCardItem[]; // Always [] for profile-based, kept for API compat
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Boost factor for items added in the last 14 days */
const FRESHNESS_BOOST = 1.1;
const FRESHNESS_WINDOW_DAYS = 14;

/**
 * Minimum similarity score to include in results.
 * Filters out noise from items with near-zero or negative cosine similarity.
 */
const MIN_SIMILARITY = 0.05;

/**
 * Maximum number of item IDs to pass in the exclusion list.
 * Postgres handles NOT IN efficiently up to ~5000 values;
 * beyond that, consider a temp table or NOT EXISTS subquery.
 */
const MAX_EXCLUSION_LIST_SIZE = 5000;

// ─── Core engine ─────────────────────────────────────────────────────────────

/**
 * Get recommendations using the pre-computed user taste profile.
 *
 * This replaces the old N+1 per-movie cosine queries with a single
 * HNSW-indexed vector search using the unified user embedding.
 *
 * @param targetType - "Movie" or "Series" — filters which items to recommend
 */
export async function getProfileRecommendations(
  serverId: number,
  userId: string,
  targetType: "Movie" | "Series",
  limit: number,
  offset: number = 0,
): Promise<RecommendationResult[]> {
  // ── 1. Fetch pre-computed user profile ───────────────────────────────────
  const userProfile = await db
    .select({ embedding: userEmbeddings.embedding })
    .from(userEmbeddings)
    .where(
      and(
        eq(userEmbeddings.userId, userId),
        eq(userEmbeddings.serverId, serverId),
      ),
    )
    .limit(1);

  if (userProfile.length === 0 || !userProfile[0].embedding) {
    // No profile yet — return empty. The old logic can be used as fallback by callers.
    return [];
  }

  const profileVector = userProfile[0].embedding;

  // ── 2. Get hidden + watched item IDs for exclusion ───────────────────────
  const [hiddenRows, watchedRows] = await Promise.all([
    db
      .select({ itemId: hiddenRecommendations.itemId })
      .from(hiddenRecommendations)
      .where(
        and(
          eq(hiddenRecommendations.serverId, serverId),
          eq(hiddenRecommendations.userId, userId),
        ),
      )
      .catch(() => [] as { itemId: string }[]),

    targetType === "Movie"
      ? db
          .selectDistinct({ itemId: sessions.itemId })
          .from(sessions)
          .where(
            and(
              eq(sessions.serverId, serverId),
              eq(sessions.userId, userId),
              isNotNull(sessions.itemId),
            ),
          )
      : // For series: exclude series the user has already watched episodes of
        db
          .selectDistinct({ itemId: sessions.seriesId })
          .from(sessions)
          .where(
            and(
              eq(sessions.serverId, serverId),
              eq(sessions.userId, userId),
              isNotNull(sessions.seriesId),
            ),
          ),
  ]);

  const excludeIds = new Set<string>();
  for (const row of hiddenRows) {
    if (row.itemId) excludeIds.add(row.itemId);
  }
  for (const row of watchedRows) {
    if (row.itemId) excludeIds.add(row.itemId);
  }

  const excludeArray = Array.from(excludeIds);

  // ── 3. Single vector search with freshness boost ─────────────────
  const freshnessThreshold = new Date(
    Date.now() - FRESHNESS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const adjustedSimilarity = sql<number>`
    CASE
      WHEN ${items.createdAt} > ${freshnessThreshold.toISOString()}
      THEN (1 - (${cosineDistance(items.embedding, profileVector)})) * ${FRESHNESS_BOOST}
      ELSE (1 - (${cosineDistance(items.embedding, profileVector)}))
    END
  `;

  const conditions = [
    eq(items.serverId, serverId),
    eq(items.type, targetType),
    isNull(items.deletedAt),
    isNotNull(items.embedding),
    sql`(1 - (${cosineDistance(items.embedding, profileVector)})) > ${MIN_SIMILARITY}`,
  ];

  // Cap the exclusion list to avoid perf degradation with very large NOT IN clauses
  if (excludeArray.length > 0) {
    if (excludeArray.length > MAX_EXCLUSION_LIST_SIZE) {
      console.warn(
        `[recommendations] userId=${userId} exclusionListSize=${excludeArray.length} action=capped max=${MAX_EXCLUSION_LIST_SIZE}`,
      );
    }
    conditions.push(
      notInArray(items.id, excludeArray.slice(0, MAX_EXCLUSION_LIST_SIZE)),
    );
  }

  const candidates = await db
    .select({
      item: recommendationItemCardSelect,
      similarity: adjustedSimilarity,
    })
    .from(items)
    .where(and(...conditions))
    .orderBy(desc(adjustedSimilarity))
    .limit(limit)
    .offset(offset);

  // ── 4. Map to result shape ────────────────────────────────────────────────
  return candidates.map((row) => ({
    item: row.item,
    similarity: Number(row.similarity),
    basedOn: [], // Profile-based — no individual attribution
  }));
}
