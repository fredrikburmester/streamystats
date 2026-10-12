"use server";

import "server-only";

import { db } from "@streamystats/database";
import {
  hiddenRecommendations,
  type Item,
  items,
  sessions,
} from "@streamystats/database/schema";
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  notInArray,
  sql,
} from "drizzle-orm";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";

import { getItemEmbeddingComparison } from "./embedding-comparison";
import { getStatisticsExclusions } from "./exclusions";
import { getDislikeRelevances, getUserRatingSignals } from "./rating-signals";
import { isNearerToDislike, relativeSimilarity } from "./rating-signals-pick";
import {
  getRecommendationProfile,
  getThemeSeedCards,
} from "./recommendation-profile";
import { withMatchedThemes } from "./recommendation-profile-pick";
import { getExcludedStartedIds } from "./started-items";
import { getMe } from "./users";

const enableDebug = false;

// Debug logging helper - only logs in development or when DEBUG_RECOMMENDATIONS is enabled
const debugLog = (...args: unknown[]) => {
  if (
    (process.env.NODE_ENV === "development" ||
      process.env.DEBUG_RECOMMENDATIONS === "true") &&
    enableDebug
  ) {
    // eslint-disable-next-line no-console
    console.debug(...args);
  }
};

export interface SeriesRecommendationItem {
  item: SeriesRecommendationCardItem;
  similarity: number;
  basedOn: SeriesRecommendationCardItem[];
  /** The user's own stated interests this matches (see taste profile). */
  matchedThemes?: string[];
}

export interface SeriesRecommendationCardItem {
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

type SeriesRecommendationCardItemWithEmbedding =
  SeriesRecommendationCardItem & {
    embedding: Item["embedding"];
  };

const itemCardSelect = {
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

const itemCardWithEmbeddingSelect = {
  ...itemCardSelect,
  embedding: items.embedding,
} as const;

const itemCardWithEmbeddingColumns = {
  id: true,
  name: true,
  type: true,
  productionYear: true,
  runtimeTicks: true,
  genres: true,
  communityRating: true,
  primaryImageTag: true,
  primaryImageThumbTag: true,
  primaryImageLogoTag: true,
  backdropImageTags: true,
  seriesId: true,
  seriesPrimaryImageTag: true,
  parentBackdropItemId: true,
  parentBackdropImageTags: true,
  parentThumbItemId: true,
  parentThumbImageTag: true,
  embedding: true,
} as const;

const stripEmbedding = (
  item: SeriesRecommendationCardItemWithEmbedding,
): SeriesRecommendationCardItem => {
  const { embedding: _embedding, ...card } = item;
  return card;
};

const RECOMMENDATION_POOL_SIZE = 500;

async function getLikedSeedCards({
  serverId,
  likedItemIds,
}: {
  serverId: number;
  likedItemIds: string[];
}): Promise<SeriesRecommendationCardItemWithEmbedding[]> {
  if (likedItemIds.length === 0) return [];
  const rows = await db
    .select(itemCardWithEmbeddingSelect)
    .from(items)
    .where(
      and(
        eq(items.serverId, serverId),
        inArray(items.id, likedItemIds),
        isNotNull(items.embedding),
      ),
    );
  const order = new Map(likedItemIds.map((id, index) => [id, index]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

async function getSeriesRecommendations(
  serverIdNum: number,
  userId: string,
  poolSize: number,
  viewerUserId?: string,
): Promise<SeriesRecommendationItem[]> {
  "use cache";
  cacheTag("user-analytics");
  cacheLife("hours");
  cacheTag(
    `series-recommendations-${serverIdNum}`,
    `series-recommendations-${serverIdNum}-${userId}`,
  );

  try {
    debugLog(
      `\n🚀 Starting series recommendation process for server ${serverIdNum}, user ${userId}, pool size ${poolSize}`,
    );

    debugLog("\n📺 Getting user-specific series recommendations...");
    const recommendations = await getUserSpecificSeriesRecommendations(
      serverIdNum,
      userId,
      poolSize,
      viewerUserId,
    );
    debugLog(
      `✅ Got ${recommendations.length} user-specific series recommendations`,
    );

    debugLog(
      `\n🎉 Final result: ${recommendations.length} total series recommendations`,
    );
    return recommendations;
  } catch (error) {
    debugLog("❌ Error getting similar series:", error);
    return [];
  }
}

export async function getSimilarSeries({
  serverId,
  userId,
  limit = 20,
  offset = 0,
  viewerUserId,
}: {
  serverId: string | number;
  userId?: string;
  limit?: number;
  offset?: number;
  viewerUserId?: string;
}): Promise<SeriesRecommendationItem[]> {
  const serverIdNum = Number(serverId);

  let targetUserId = userId;
  if (!targetUserId) {
    const currentUser = await getMe();
    if (currentUser && currentUser.serverId === serverIdNum) {
      targetUserId = currentUser.id;
      debugLog(`🔍 Using current user: ${targetUserId}`);
    } else {
      debugLog("❌ No valid user found for series recommendations");
      return [];
    }
  }

  const allRecommendations = await getSeriesRecommendations(
    serverIdNum,
    targetUserId,
    RECOMMENDATION_POOL_SIZE,
    viewerUserId,
  );

  return allRecommendations.slice(offset, offset + limit);
}

export const revalidateSeriesRecommendations = async (
  serverId: number,
  userId?: string,
) => {
  revalidateTag(`series-recommendations-${serverId}`, "hours");
  if (userId) {
    revalidateTag(`series-recommendations-${serverId}-${userId}`, "hours");
  }
};

async function getUserSpecificSeriesRecommendations(
  serverId: number,
  userId: string,
  limit: number,
  viewerUserId?: string,
): Promise<SeriesRecommendationItem[]> {
  debugLog(
    `\n🎯 Starting user-specific series recommendations for user ${userId}, server ${serverId}, limit ${limit}`,
  );

  const { itemLibraryExclusion } = await getStatisticsExclusions(
    serverId,
    viewerUserId,
  );

  const ratingSignals = await getUserRatingSignals({ serverId, userId });
  const profile = await getRecommendationProfile({ serverId, userId });
  const themeSeeds = getThemeSeedCards(profile);
  const hasLikedSeeds =
    ratingSignals.likedItemIds.length > 0 || themeSeeds.length > 0;

  // Get user's watch history for episodes, aggregated by series
  // Only include series where user watched at least 2 episodes
  const userSeriesWatchHistory = await db
    .select({
      seriesId: sessions.seriesId,
      totalPlayDuration: sql<number>`SUM(${sessions.playDuration})`.as(
        "totalPlayDuration",
      ),
      episodeCount: sql<number>`COUNT(DISTINCT ${sessions.itemId})`.as(
        "episodeCount",
      ),
      lastWatched: sql<Date>`MAX(${sessions.endTime})`.as("lastWatched"),
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.serverId, serverId),
        eq(sessions.userId, userId),
        isNotNull(sessions.seriesId),
        isNotNull(sessions.playDuration),
      ),
    )
    .groupBy(sessions.seriesId)
    .having(sql`COUNT(DISTINCT ${sessions.itemId}) >= 2`)
    .orderBy(sql`MAX(${sessions.endTime}) DESC`);

  debugLog(`📊 Found ${userSeriesWatchHistory.length} series in watch history`);

  if (userSeriesWatchHistory.length === 0 && !hasLikedSeeds) {
    debugLog(
      "❌ No series watch history found, returning empty recommendations",
    );
    return [];
  }

  // Get the actual Series items for these seriesIds
  const seriesIds = userSeriesWatchHistory
    .map((w) => w.seriesId)
    .filter((id): id is string => !!id);

  if (seriesIds.length === 0 && !hasLikedSeeds) {
    debugLog("❌ No valid series IDs found, returning empty recommendations");
    return [];
  }

  const watchedSeriesItems = await db
    .select(itemCardWithEmbeddingSelect)
    .from(items)
    .where(
      and(
        eq(items.serverId, serverId),
        isNull(items.deletedAt),
        eq(items.type, "Series"),
        isNotNull(items.embedding),
        inArray(items.id, seriesIds),
      ),
    );

  debugLog(
    `📺 Found ${watchedSeriesItems.length} series items with embeddings`,
  );

  type WatchedSeriesWithStats = {
    series: (typeof watchedSeriesItems)[number];
    totalPlayDuration: number;
    episodeCount: number;
    lastWatched: Date;
  };

  // Match series with their watch stats
  const watchedSeriesWithStats = watchedSeriesItems
    .map((series): WatchedSeriesWithStats | null => {
      const stats = userSeriesWatchHistory.find(
        (w) => w.seriesId === series.id,
      );
      return stats
        ? {
            series,
            totalPlayDuration: stats.totalPlayDuration,
            episodeCount: stats.episodeCount,
            lastWatched: new Date(stats.lastWatched),
          }
        : null;
    })
    .filter((item): item is WatchedSeriesWithStats => item !== null)
    .sort((a, b) => b.lastWatched.getTime() - a.lastWatched.getTime());

  debugLog("🎬 Series with watch stats (top 5):");
  watchedSeriesWithStats.slice(0, 5).forEach((item, index) => {
    debugLog(
      `  ${index + 1}. "${item.series.name}" - ${
        item.episodeCount
      } episodes, ${Math.round(
        item.totalPlayDuration / 60,
      )}min total, last watched: ${item.lastWatched}`,
    );
  });

  if (watchedSeriesWithStats.length === 0 && !hasLikedSeeds) {
    debugLog(
      "❌ No series with embeddings found, returning empty recommendations",
    );
    return [];
  }

  // Get hidden recommendations for this user
  let hiddenItems: { itemId: string }[] = [];
  try {
    hiddenItems = await db
      .select({ itemId: hiddenRecommendations.itemId })
      .from(hiddenRecommendations)
      .where(
        and(
          eq(hiddenRecommendations.serverId, serverId),
          eq(hiddenRecommendations.userId, userId),
        ),
      );
  } catch (error) {
    debugLog("Error fetching hidden recommendations:", error);
    hiddenItems = [];
  }

  const hiddenItemIds = hiddenItems.map((h) => h.itemId).filter(Boolean);
  const watchedSeriesIds = watchedSeriesWithStats.map((w) => w.series.id);
  // Anything the user rated (and the series of a rated episode) is already
  // known to them.
  const excludedItemIds = [
    ...new Set([
      ...watchedSeriesIds,
      ...ratingSignals.knownItemIds,
      ...(await getExcludedStartedIds({
        serverId,
        userId,
        enabled: profile.excludeStarted,
      })),
    ]),
  ];
  debugLog(`🙈 Found ${hiddenItemIds.length} hidden items`);

  // Use top watched series to create recommendations

  // Prioritize recent watches but include some highly watched series
  const recentWatches = watchedSeriesWithStats.slice(0, 5);
  debugLog(`⏰ Recent series watches (${recentWatches.length}):`);
  recentWatches.forEach((item, index) => {
    debugLog(`  ${index + 1}. "${item.series.name}"`);
  });

  // Get top watched series ordered by total play duration
  const topWatchedSeries = watchedSeriesWithStats
    .sort((a, b) => b.totalPlayDuration - a.totalPlayDuration)
    .slice(0, 10);

  debugLog(`🔥 Top watched series by duration (${topWatchedSeries.length}):`);
  topWatchedSeries.forEach((item, index) => {
    debugLog(
      `  ${index + 1}. "${item.series.name}" - ${Math.round(
        item.totalPlayDuration / 60,
      )}min total`,
    );
  });

  // Combine recent and top watched, remove duplicates, limit to 15
  const recentIds = new Set(recentWatches.map((item) => item.series.id));
  const additionalTopWatched = topWatchedSeries.filter(
    (item) => !recentIds.has(item.series.id),
  );

  const baseSeries = [...recentWatches, ...additionalTopWatched].slice(0, 15);
  debugLog(`📺 Final base series for similarity (${baseSeries.length}):`);
  baseSeries.forEach((item, index) => {
    const isRecent = recentIds.has(item.series.id);
    debugLog(
      `  ${index + 1}. "${item.series.name}" (${
        isRecent ? "recent" : "top watched"
      })`,
    );
  });

  // Liked items lead the seeds, ahead of watch history. A liked episode or
  // movie seeds on its own content, so a standout episode can surface a
  // series that shares its theme rather than its parent series' format.
  // The user's stated interests lead, then ratings; watch history only seeds
  // when the user allows it (watched series stay excluded either way).
  const likedSeeds = [
    ...themeSeeds,
    ...(await getLikedSeedCards({
      serverId,
      likedItemIds: ratingSignals.likedItemIds,
    })),
  ];
  const likedSeedIds = new Set(likedSeeds.map((item) => item.id));
  const seedSeries: SeriesRecommendationCardItemWithEmbedding[] = [
    ...likedSeeds,
    ...(profile.useWatchHistory ? baseSeries : [])
      .map((b) => b.series)
      .filter((series) => !likedSeedIds.has(series.id)),
  ];

  if (seedSeries.length === 0) {
    debugLog("❌ No base series found, returning empty recommendations");
    return [];
  }

  // Get candidate series similar to any of the base series
  const candidateSeries = new Map<
    string,
    {
      item: SeriesRecommendationCardItem;
      similarities: number[];
      /** Similarity relative to each seed's own nearest neighbour (0-1]. */
      relevances: number[];
      basedOn: SeriesRecommendationCardItemWithEmbedding[];
    }
  >();

  for (const watchedSeries of seedSeries) {
    if (!watchedSeries.embedding) {
      debugLog(`⚠️ Skipping "${watchedSeries.name}" - no embedding`);
      continue;
    }

    debugLog(`\n🔍 Finding series similar to "${watchedSeries.name}"`);

    // Calculate cosine similarity with other series using indexed expression
    const { distance, dimensionFilter } = getItemEmbeddingComparison(
      watchedSeries.embedding,
    );
    const similarity = sql<number>`1 - (${distance})`;

    // Get a large pool of similar series with low threshold, sorted by distance ascending (nearest first)
    const similarSeries = await db
      .select({
        item: itemCardSelect,
        similarity: similarity,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverId),
          isNull(items.deletedAt),
          eq(items.type, "Series"),
          isNotNull(items.embedding),
          dimensionFilter,
          excludedItemIds.length > 0
            ? notInArray(items.id, excludedItemIds)
            : sql`true`, // Exclude already watched or rated series
          hiddenItemIds.length > 0
            ? notInArray(items.id, hiddenItemIds)
            : sql`true`, // Exclude hidden items
          itemLibraryExclusion ?? sql`true`,
        ),
      )
      .orderBy(asc(distance))
      .limit(200); // Get a large pool for each base series

    debugLog(`  Found ${similarSeries.length} similar series (top 5):`);
    similarSeries.slice(0, 5).forEach((result, index) => {
      debugLog(
        `    ${index + 1}. "${result.item.name}" - similarity: ${Number(
          result.similarity,
        ).toFixed(3)}`,
      );
    });

    // Filter with low threshold to ensure we have enough candidates
    // Results are already sorted by similarity, so best matches come first
    const qualifiedSimilarSeries = similarSeries.filter(
      (result) => Number(result.similarity) > 0.1,
    );

    debugLog(`  ${qualifiedSimilarSeries.length} series with similarity > 0.1`);

    // Add similarities to candidate series
    const topSimilarity = Number(qualifiedSimilarSeries[0]?.similarity ?? 0);
    for (const result of qualifiedSimilarSeries) {
      const seriesId = result.item.id;
      const simScore = Number(result.similarity);

      let candidate = candidateSeries.get(seriesId);

      if (!candidate) {
        candidate = {
          item: result.item,
          similarities: [],
          relevances: [],
          basedOn: [],
        };
        candidateSeries.set(seriesId, candidate);
      }

      candidate.similarities.push(simScore);
      candidate.relevances.push(relativeSimilarity(simScore, topSimilarity));
      candidate.basedOn.push(watchedSeries);
    }
  }

  const dislikeRelevance = await getDislikeRelevances({
    serverId,
    dislikedItemIds: ratingSignals.dislikedItemIds,
    dislikedEmbeddings: profile.dislikeThemes.map((theme) => theme.embedding),
    candidateIds: [...candidateSeries.keys()],
  });
  for (const [seriesId, candidate] of candidateSeries) {
    if (
      isNearerToDislike(candidate.relevances, dislikeRelevance.get(seriesId))
    ) {
      candidateSeries.delete(seriesId);
    }
  }

  debugLog(`\n📋 Total unique candidate series: ${candidateSeries.size}`);

  const toRecommendation = (candidate: {
    item: SeriesRecommendationCardItem;
    similarities: number[];
    basedOn: SeriesRecommendationCardItemWithEmbedding[];
  }): SeriesRecommendationItem => ({
    item: candidate.item,
    similarity:
      candidate.similarities.reduce((sum, sim) => sum + sim, 0) /
      candidate.similarities.length,
    basedOn: candidate.basedOn.slice(0, 3).map(stripEmbedding), // Limit to 3 base series for clarity
  });

  // Each rated item's best match leads, in seed order (highest rated, most
  // recent first). Raw similarity is not comparable across seeds -- an
  // episode's short text scores lower against everything than a series' -- so
  // ranking only by it would bury every episode-seeded pick.
  const ratedPicks: SeriesRecommendationItem[] = [];
  const pickedIds = new Set<string>();
  for (const seed of likedSeeds) {
    let best: { id: string; similarity: number } | null = null;
    for (const [id, candidate] of candidateSeries) {
      if (pickedIds.has(id)) continue;
      const index = candidate.basedOn.findIndex((b) => b.id === seed.id);
      if (index === -1) continue;
      const similarity = candidate.similarities[index] ?? 0;
      if (!best || similarity > best.similarity) best = { id, similarity };
    }
    const candidate = best ? candidateSeries.get(best.id) : undefined;
    if (best && candidate) {
      pickedIds.add(best.id);
      ratedPicks.push({
        ...toRecommendation(candidate),
        basedOn: [stripEmbedding(seed)],
      });
    }
  }

  const finalRecommendations = [
    ...ratedPicks,
    ...Array.from(candidateSeries.entries())
      .filter(([id]) => !pickedIds.has(id))
      .map(([, candidate]) => toRecommendation(candidate))
      .sort((a, b) => b.similarity - a.similarity),
  ]
    .slice(0, limit)
    .map(withMatchedThemes);

  debugLog(`\n✅ Final ${finalRecommendations.length} series recommendations:`);
  finalRecommendations.forEach((rec, index) => {
    const baseSeriesNames = rec.basedOn.map((s) => `"${s.name}"`).join(", ");
    const type = rec.basedOn.length >= 2 ? "multi-series" : "single-series";
    debugLog(
      `  ${index + 1}. "${rec.item.name}" (similarity: ${rec.similarity.toFixed(
        3,
      )}, ${type}) <- ${baseSeriesNames}`,
    );
  });

  return finalRecommendations;
}

/**
 * Get series similar to a specific series (not user-based)
 */
export const getSimilarSeriesForItem = async (
  serverId: string | number,
  itemId: string,
  limit = 10,
): Promise<SeriesRecommendationItem[]> => {
  "use cache";
  cacheTag("user-analytics");
  cacheLife("hours");
  cacheTag(
    `series-recommendations-${serverId}`,
    `series-recommendations-item-${itemId}`,
  );

  try {
    debugLog(
      `\n🎯 Getting series similar to specific series ${itemId} in server ${serverId}, limit ${limit}`,
    );

    const serverIdNum = Number(serverId);

    // Get the target series with its embedding
    const targetSeries = await db.query.items.findFirst({
      where: and(
        eq(items.id, itemId),
        eq(items.serverId, serverIdNum),
        eq(items.type, "Series"),
        isNotNull(items.embedding),
      ),
      columns: itemCardWithEmbeddingColumns,
    });

    if (!targetSeries || !targetSeries.embedding) {
      debugLog(`❌ Target series not found or missing embedding: ${itemId}`);
      return [];
    }

    debugLog(`📺 Target series: "${targetSeries.name}"`);

    // Calculate cosine similarity with other series using indexed expression
    const { distance, dimensionFilter } = getItemEmbeddingComparison(
      targetSeries.embedding,
    );
    const similarity = sql<number>`1 - (${distance})`;

    const similarSeries = await db
      .select({
        item: itemCardSelect,
        similarity: similarity,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverIdNum),
          isNull(items.deletedAt),
          eq(items.type, "Series"),
          isNotNull(items.embedding),
          dimensionFilter,
          sql`${items.id} != ${itemId}`, // Exclude the target series itself
        ),
      )
      .orderBy(asc(distance))
      .limit(limit * 2); // Get more to filter for quality

    debugLog(`📊 Found ${similarSeries.length} potential similar series`);

    // Filter for good similarity scores
    const qualifiedSimilarSeries = similarSeries.filter(
      (result) => Number(result.similarity) > 0.4,
    );

    debugLog(
      `✅ ${qualifiedSimilarSeries.length} series with similarity > 0.4:`,
    );
    qualifiedSimilarSeries
      .slice(0, Math.min(5, limit))
      .forEach((result, index) => {
        debugLog(
          `  ${index + 1}. "${result.item.name}" - similarity: ${Number(
            result.similarity,
          ).toFixed(3)}`,
        );
      });

    // Transform to recommendation format
    const recommendations: SeriesRecommendationItem[] = qualifiedSimilarSeries
      .slice(0, limit)
      .map((result) => ({
        item: result.item,
        similarity: Number(result.similarity),
        basedOn: [
          stripEmbedding(
            targetSeries as SeriesRecommendationCardItemWithEmbedding,
          ),
        ], // Based on the target series
      }));

    debugLog(`\n🎉 Returning ${recommendations.length} similar series`);
    return recommendations;
  } catch (error) {
    debugLog("❌ Error getting similar series for item:", error);
    return [];
  }
};

export const hideSeriesRecommendation = async (
  serverId: string | number,
  itemId: string,
) => {
  try {
    // Get the current user
    const currentUser = await getMe();
    if (!currentUser || currentUser.serverId !== Number(serverId)) {
      return {
        success: false,
        error: "User not found or not authorized for this server",
      };
    }

    const serverIdNum = Number(serverId);

    // Check if the recommendation is already hidden
    const existingHidden = await db
      .select()
      .from(hiddenRecommendations)
      .where(
        and(
          eq(hiddenRecommendations.serverId, serverIdNum),
          eq(hiddenRecommendations.userId, currentUser.id),
          eq(hiddenRecommendations.itemId, itemId),
        ),
      )
      .limit(1);

    if (existingHidden.length > 0) {
      return {
        success: true,
        error: false,
        message: "Series recommendation already hidden",
      };
    }

    // Insert the hidden recommendation
    await db.insert(hiddenRecommendations).values({
      serverId: serverIdNum,
      userId: currentUser.id,
      itemId: itemId,
    });

    // Revalidate series recommendations cache
    await revalidateSeriesRecommendations(serverIdNum, currentUser.id);

    return {
      success: true,
      error: false,
      message: "Series recommendation hidden successfully",
    };
  } catch (error) {
    debugLog("Error hiding series recommendation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
