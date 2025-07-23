"use server";

import {
  Item,
  sessions,
  items,
  hiddenRecommendations,
  jellyseerrItems,
  JellyseerrItem,
} from "@streamystats/database/schema";
import { db } from "@streamystats/database";
import {
  and,
  eq,
  sql,
  desc,
  notInArray,
  isNotNull,
  gt,
  count,
} from "drizzle-orm";
import { cosineDistance } from "drizzle-orm";
import { getMe } from "./users";

const enableDebug = false;

// Debug logging helper - only logs in development or when DEBUG_RECOMMENDATIONS is enabled
const debugLog = (...args: any[]) => {
  if (
    (process.env.NODE_ENV === "development" ||
      process.env.DEBUG_RECOMMENDATIONS === "true") &&
    enableDebug
  ) {
    console.log(...args);
  }
};

// Unified interface for recommendation items that can be either Jellyfin or Jellyseerr items
export interface UnifiedRecommendationItem {
  id: string;
  name: string; // title for Jellyseerr items
  type: string;
  productionYear: number | null;
  communityRating: number | null;
  overview: string | null;
  embedding: number[] | null;

  // Jellyfin-specific properties (will be null for Jellyseerr items)
  primaryImageTag?: string | null;
  backdropImageTags?: string[] | null;
  imageBlurHashes?: any;
  seriesId?: string | null;
  seriesPrimaryImageTag?: string | null;
  parentBackdropItemId?: string | null;
  parentBackdropImageTags?: string[] | null;
  primaryImageThumbTag?: string | null;
  parentThumbItemId?: string | null;
  parentThumbImageTag?: string | null;
  primaryImageLogoTag?: string | null;

  // Jellyseerr-specific properties (will be null for Jellyfin items)
  posterPath?: string | null;
  backdropPath?: string | null;
  genres?: string[] | null;
  sourceType?: string | null;
  mediaType?: string | null;

  // Source identifier
  source: "jellyfin" | "jellyseerr";
}

export interface RecommendationItem {
  item: UnifiedRecommendationItem;
  similarity: number;
  basedOn: Item[];
}

// Helper functions to convert items to unified format
function jellyfinItemToUnified(item: Item): UnifiedRecommendationItem {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    productionYear: item.productionYear,
    communityRating: item.communityRating,
    overview: item.overview,
    embedding: item.embedding,

    // Jellyfin-specific properties
    primaryImageTag: item.primaryImageTag,
    backdropImageTags: item.backdropImageTags,
    imageBlurHashes: item.imageBlurHashes,
    seriesId: item.seriesId,
    seriesPrimaryImageTag: item.seriesPrimaryImageTag,
    parentBackdropItemId: item.parentBackdropItemId,
    parentBackdropImageTags: item.parentBackdropImageTags,
    primaryImageThumbTag: item.primaryImageThumbTag,
    parentThumbItemId: item.parentThumbItemId,
    parentThumbImageTag: item.parentThumbImageTag,
    primaryImageLogoTag: item.primaryImageLogoTag,

    // Jellyseerr-specific properties (null for Jellyfin items)
    posterPath: null,
    backdropPath: null,
    genres: null,
    sourceType: null,
    mediaType: null,

    source: "jellyfin",
  };
}

function jellyseerrItemToUnified(
  item: JellyseerrItem
): UnifiedRecommendationItem {
  return {
    id: item.id,
    name: item.title,
    type: item.type,
    productionYear: item.productionYear,
    communityRating: item.communityRating,
    overview: item.overview,
    embedding: item.embedding,

    // Jellyfin-specific properties (null for Jellyseerr items)
    primaryImageTag: null,
    backdropImageTags: null,
    imageBlurHashes: null,
    seriesId: null,
    seriesPrimaryImageTag: null,
    parentBackdropItemId: null,
    parentBackdropImageTags: null,
    primaryImageThumbTag: null,
    parentThumbItemId: null,
    parentThumbImageTag: null,
    primaryImageLogoTag: null,

    // Jellyseerr-specific properties
    posterPath: item.posterPath,
    backdropPath: item.backdropPath,
    genres: item.genres as string[] | null,
    sourceType: item.sourceType,
    mediaType: item.mediaType,

    source: "jellyseerr",
  };
}

export const getSimilarStatistics = async (
  serverId: string | number,
  userId?: string,
  limit: number = 10
): Promise<RecommendationItem[]> => {
  try {
    debugLog(
      `\n🚀 Starting recommendation process for server ${serverId}, user ${
        userId || "anonymous"
      }, limit ${limit}`
    );

    // Convert serverId to number
    const serverIdNum = Number(serverId);

    // Get the user ID to use for recommendations
    let targetUserId = userId;
    if (!targetUserId) {
      const currentUser = await getMe();
      if (currentUser && currentUser.serverId === serverIdNum) {
        targetUserId = currentUser.id;
        debugLog(`🔍 Using current user: ${targetUserId}`);
      } else {
        debugLog(`❌ No valid user found for recommendations`);
      }
    } else {
      debugLog(`👤 Using provided user: ${targetUserId}`);
    }

    let recommendations: RecommendationItem[] = [];

    if (targetUserId) {
      // Get enhanced user-specific recommendations (includes Jellyseerr items)
      debugLog(`\n📊 Getting enhanced user-specific recommendations...`);
      recommendations = await getUserSpecificRecommendationsWithJellyseerr(
        serverIdNum,
        targetUserId,
        limit
      );
      debugLog(
        `✅ Got ${recommendations.length} enhanced user-specific recommendations`
      );
    }

    // If we don't have enough user-specific recommendations, supplement with popular items
    if (recommendations.length < limit) {
      const remainingLimit = limit - recommendations.length;
      debugLog(
        `\n🔥 Need ${remainingLimit} more recommendations, getting popular items...`
      );
      const popularRecommendations = await getPopularRecommendations(
        serverIdNum,
        remainingLimit,
        targetUserId
      );
      debugLog(
        `✅ Got ${popularRecommendations.length} popular recommendations`
      );
      recommendations = [...recommendations, ...popularRecommendations];
    }

    debugLog(
      `\n🎉 Final result: ${recommendations.length} total recommendations`
    );
    return recommendations;
  } catch (error) {
    debugLog("❌ Error getting similar statistics:", error);
    return [];
  }
};

async function getUserSpecificRecommendations(
  serverId: number,
  userId: string,
  limit: number
): Promise<RecommendationItem[]> {
  debugLog(
    `\n🎯 Starting user-specific recommendations for user ${userId}, server ${serverId}, limit ${limit}`
  );

  // Get user's watch history with total play duration and recent activity
  const userWatchHistory = await db
    .select({
      itemId: sessions.itemId,
      item: items,
      totalPlayDuration: sql<number>`SUM(${sessions.playDuration})`.as(
        "totalPlayDuration"
      ),
      lastWatched: sql<Date>`MAX(${sessions.endTime})`.as("lastWatched"),
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .where(
      and(
        eq(sessions.serverId, serverId),
        eq(sessions.userId, userId),
        isNotNull(items.embedding),
        isNotNull(sessions.playDuration)
      )
    )
    .groupBy(sessions.itemId, items.id)
    .orderBy(sql`MAX(${sessions.endTime}) DESC`);

  debugLog(`📊 Found ${userWatchHistory.length} items in watch history`);
  userWatchHistory.forEach((item, index) => {
    debugLog(
      `  ${index + 1}. "${item.item.name}" - ${Math.round(
        item.totalPlayDuration / 60
      )}min total, last watched: ${item.lastWatched}`
    );
  });

  if (userWatchHistory.length === 0) {
    debugLog("❌ No watch history found, returning empty recommendations");
    return [];
  }

  // Extract watched items and their IDs
  const watchedItems = userWatchHistory.map(
    (w: {
      itemId: string | null;
      item: Item;
      totalPlayDuration: number;
      lastWatched: Date;
    }) => w.item
  );
  const watchedItemIds = watchedItems.map((item: Item) => item.id);

  // Get hidden recommendations for this user
  let hiddenItems: { itemId: string }[] = [];
  try {
    hiddenItems = await db
      .select({ itemId: hiddenRecommendations.itemId })
      .from(hiddenRecommendations)
      .where(
        and(
          eq(hiddenRecommendations.serverId, serverId),
          eq(hiddenRecommendations.userId, userId)
        )
      );
  } catch (error) {
    debugLog("Error fetching hidden recommendations:", error);
    hiddenItems = [];
  }

  const hiddenItemIds = hiddenItems.map((h) => h.itemId).filter(Boolean);
  debugLog(`🙈 Found ${hiddenItemIds.length} hidden items`);

  // Use multiple movies to create recommendations
  const recommendations: RecommendationItem[] = [];
  const usedRecommendationIds = new Set<string>();

  // Hybrid approach: prioritize recent watches but include some highly watched items
  // Take recent watches (first 4) and mix with some top watched items
  const recentWatches = watchedItems.slice(0, 4); // Most recent 4
  debugLog(`⏰ Recent watches (${recentWatches.length}):`);
  recentWatches.forEach((item, index) => {
    debugLog(`  ${index + 1}. "${item.name}"`);
  });

  // Get top watched items ordered by total play duration
  const topWatchedHistory = await db
    .select({
      itemId: sessions.itemId,
      item: items,
      totalPlayDuration: sql<number>`SUM(${sessions.playDuration})`.as(
        "totalPlayDuration"
      ),
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .where(
      and(
        eq(sessions.serverId, serverId),
        eq(sessions.userId, userId),
        isNotNull(items.embedding),
        isNotNull(sessions.playDuration)
      )
    )
    .groupBy(sessions.itemId, items.id)
    .orderBy(desc(sql<number>`SUM(${sessions.playDuration})`))
    .limit(6);

  const topWatchedItems = topWatchedHistory.map((w) => w.item);
  debugLog(`🔥 Top watched by duration (${topWatchedItems.length}):`);
  topWatchedHistory.forEach((item, index) => {
    debugLog(
      `  ${index + 1}. "${item.item.name}" - ${Math.round(
        item.totalPlayDuration / 60
      )}min total`
    );
  });

  // Combine recent and top watched, remove duplicates, limit to 6
  const recentIds = new Set(recentWatches.map((item) => item.id));
  const additionalTopWatched = topWatchedItems.filter(
    (item) => !recentIds.has(item.id)
  );

  const baseMovies = [...recentWatches, ...additionalTopWatched].slice(0, 6);
  debugLog(`🎬 Final base movies for similarity (${baseMovies.length}):`);
  baseMovies.forEach((item, index) => {
    const isRecent = recentIds.has(item.id);
    debugLog(
      `  ${index + 1}. "${item.name}" (${isRecent ? "recent" : "top watched"})`
    );
  });

  if (baseMovies.length === 0) {
    debugLog("❌ No base movies found, returning empty recommendations");
    return [];
  }

  // Get candidate items similar to any of the base movies
  const candidateItems = new Map<
    string,
    { item: Item; similarities: number[]; basedOn: Item[] }
  >();

  for (const watchedItem of baseMovies) {
    if (!watchedItem.embedding) {
      debugLog(`⚠️ Skipping "${watchedItem.name}" - no embedding`);
      continue;
    }

    debugLog(`\n🔍 Finding items similar to "${watchedItem.name}"`);

    // Calculate cosine similarity with other items
    const similarity = sql<number>`1 - (${cosineDistance(
      items.embedding,
      watchedItem.embedding
    )})`;

    // First, let's see the distribution of similarity scores
    const allSimilarItems = await db
      .select({
        item: items,
        similarity: similarity,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverId),
          isNotNull(items.embedding),
          notInArray(items.id, watchedItemIds), // Exclude already watched items
          hiddenItemIds.length > 0
            ? notInArray(items.id, hiddenItemIds)
            : sql`true` // Exclude hidden items
        )
      )
      .orderBy(desc(similarity))
      .limit(50); // Get more for analysis

    debugLog(`  📊 Similarity score distribution (top 10):`);
    allSimilarItems.slice(0, 10).forEach((result, index) => {
      debugLog(
        `    ${index + 1}. "${result.item.name}" - similarity: ${Number(
          result.similarity
        ).toFixed(3)}`
      );
    });

    // Now filter for actual recommendations with lower threshold
    const similarItems = allSimilarItems.filter(
      (result) => Number(result.similarity) > 0.5
    );

    debugLog(
      `  Found ${similarItems.length} similar items (similarity > 0.5):`
    );
    similarItems.slice(0, 5).forEach((result, index) => {
      debugLog(
        `    ${index + 1}. "${result.item.name}" - similarity: ${Number(
          result.similarity
        ).toFixed(3)}`
      );
    });
    if (similarItems.length > 5) {
      debugLog(`    ... and ${similarItems.length - 5} more`);
    }

    // Add similarities to candidate items
    for (const result of similarItems) {
      const itemId = result.item.id;
      const simScore = Number(result.similarity);

      if (!candidateItems.has(itemId)) {
        candidateItems.set(itemId, {
          item: result.item,
          similarities: [],
          basedOn: [],
        });
      }

      const candidate = candidateItems.get(itemId)!;
      candidate.similarities.push(simScore);
      candidate.basedOn.push(watchedItem);
    }
  }

  debugLog(`\n📋 Total unique candidate items: ${candidateItems.size}`);

  // Ensure each base movie gets at least one recommendation (if possible)
  const recommendationsPerBaseMovie = new Map<string, RecommendationItem[]>();

  // Group candidates by which base movie they're similar to
  for (const candidate of candidateItems.values()) {
    for (let i = 0; i < candidate.basedOn.length; i++) {
      const baseMovie = candidate.basedOn[i];
      const similarity = candidate.similarities[i];

      if (!recommendationsPerBaseMovie.has(baseMovie.id)) {
        recommendationsPerBaseMovie.set(baseMovie.id, []);
      }

      recommendationsPerBaseMovie.get(baseMovie.id)!.push({
        item: jellyfinItemToUnified(candidate.item),
        similarity,
        basedOn: [baseMovie],
      });
    }
  }

  // Get the best recommendation for each base movie
  const guaranteedRecommendations: RecommendationItem[] = [];
  debugLog(`\n🎯 Guaranteed recommendations (one per base movie):`);
  for (const [baseMovieId, recs] of recommendationsPerBaseMovie) {
    if (recs.length > 0) {
      const bestRec = recs.sort((a, b) => b.similarity - a.similarity)[0];
      const baseMovie = baseMovies.find((m) => m.id === baseMovieId);
      debugLog(
        `  "${bestRec.item.name}" (similarity: ${bestRec.similarity.toFixed(
          3
        )}) <- based on "${baseMovie?.name}"`
      );
      guaranteedRecommendations.push(bestRec);
    }
  }

  // Sort guaranteed recommendations by similarity
  guaranteedRecommendations.sort((a, b) => b.similarity - a.similarity);

  // Get multi-movie matches for remaining slots
  const multiMovieMatches = Array.from(candidateItems.values())
    .filter((candidate) => candidate.similarities.length >= 2)
    .map((candidate) => ({
      item: jellyfinItemToUnified(candidate.item),
      similarity:
        candidate.similarities.reduce((sum, sim) => sum + sim, 0) /
        candidate.similarities.length,
      basedOn: candidate.basedOn.slice(0, 3),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  debugLog(
    `\n🎭 Multi-movie matches (${multiMovieMatches.length} items similar to 2+ base movies):`
  );
  multiMovieMatches.slice(0, 5).forEach((match, index) => {
    const baseMovieNames = match.basedOn.map((m) => `"${m.name}"`).join(", ");
    debugLog(
      `  ${index + 1}. "${
        match.item.name
      }" (avg similarity: ${match.similarity.toFixed(
        3
      )}) <- based on ${baseMovieNames}`
    );
  });

  // Combine guaranteed + multi-movie + fill remaining with best single matches
  const usedItemIds = new Set(guaranteedRecommendations.map((r) => r.item.id));
  const additionalMultiMovieMatches = multiMovieMatches.filter(
    (m) => !usedItemIds.has(m.item.id)
  );

  const qualifiedCandidates = [
    ...guaranteedRecommendations,
    ...additionalMultiMovieMatches,
  ];

  // Take the top recommendations
  const finalRecommendations = qualifiedCandidates.slice(0, limit);
  recommendations.push(...finalRecommendations);

  debugLog(`\n✅ Final ${finalRecommendations.length} recommendations:`);
  finalRecommendations.forEach((rec, index) => {
    const baseMovieNames = rec.basedOn.map((m) => `"${m.name}"`).join(", ");
    const type = rec.basedOn.length >= 2 ? "multi-movie" : "single-movie";
    debugLog(
      `  ${index + 1}. "${rec.item.name}" (similarity: ${rec.similarity.toFixed(
        3
      )}, ${type}) <- ${baseMovieNames}`
    );
  });

  return recommendations.slice(0, limit);
}

async function getPopularRecommendations(
  serverId: number,
  limit: number,
  excludeUserId?: string
): Promise<RecommendationItem[]> {
  debugLog(
    `\n🔥 Getting popular recommendations for server ${serverId}, limit ${limit}, excluding user ${
      excludeUserId || "none"
    }`
  );

  // Get items that are popular (most watched) but exclude items already watched by the current user
  let watchedItemIds: string[] = [];
  let hiddenItemIds: string[] = [];

  if (excludeUserId) {
    const userWatchedItems = await db
      .select({ itemId: sessions.itemId })
      .from(sessions)
      .where(
        and(
          eq(sessions.serverId, serverId),
          eq(sessions.userId, excludeUserId),
          isNotNull(sessions.itemId)
        )
      )
      .groupBy(sessions.itemId);

    watchedItemIds = userWatchedItems
      .map((w) => w.itemId)
      .filter((id): id is string => id !== null);

    debugLog(`🚫 Excluding ${watchedItemIds.length} already watched items`);

    // Get hidden recommendations for this user
    let hiddenItems: { itemId: string }[] = [];
    try {
      hiddenItems = await db
        .select({ itemId: hiddenRecommendations.itemId })
        .from(hiddenRecommendations)
        .where(
          and(
            eq(hiddenRecommendations.serverId, serverId),
            eq(hiddenRecommendations.userId, excludeUserId)
          )
        );
    } catch (error) {
      debugLog("Error fetching hidden recommendations:", error);
      hiddenItems = [];
    }

    hiddenItemIds = hiddenItems.map((h) => h.itemId).filter(Boolean);
    debugLog(`🙈 Excluding ${hiddenItemIds.length} hidden items`);
  }

  // Get popular items based on watch count
  const popularItemsQuery = db
    .select({
      item: items,
      watchCount: count(sessions.id).as("watchCount"),
    })
    .from(items)
    .leftJoin(sessions, eq(items.id, sessions.itemId))
    .where(
      and(
        eq(items.serverId, serverId),
        isNotNull(items.embedding),
        // Exclude user's watched items if we have a user
        watchedItemIds.length > 0
          ? notInArray(items.id, watchedItemIds)
          : sql`true`,
        // Exclude user's hidden items if we have a user
        hiddenItemIds.length > 0
          ? notInArray(items.id, hiddenItemIds)
          : sql`true`
      )
    )
    .groupBy(items.id)
    .orderBy(desc(count(sessions.id)))
    .limit(limit);

  const popularItems = await popularItemsQuery;

  debugLog(`📈 Found ${popularItems.length} popular items:`);
  popularItems.slice(0, 5).forEach((item, index) => {
    debugLog(
      `  ${index + 1}. "${item.item.name}" - ${item.watchCount} watches`
    );
  });
  if (popularItems.length > 5) {
    debugLog(`  ... and ${popularItems.length - 5} more`);
  }

  // Transform to recommendation format (no specific similarity since these are popularity-based)
  return popularItems.map((item) => ({
    item: jellyfinItemToUnified(item.item),
    similarity: 0.5, // Default similarity for popular recommendations
    basedOn: [], // No specific items these are based on
  }));
}

/**
 * Get items similar to a specific item (not user-based)
 */
export const getSimilarItemsForItem = async (
  serverId: string | number,
  itemId: string,
  limit: number = 10
): Promise<RecommendationItem[]> => {
  try {
    debugLog(
      `\n🎯 Getting items similar to specific item ${itemId} in server ${serverId}, limit ${limit}`
    );

    const serverIdNum = Number(serverId);

    // Get the target item with its embedding
    const targetItem = await db.query.items.findFirst({
      where: and(
        eq(items.id, itemId),
        eq(items.serverId, serverIdNum),
        isNotNull(items.embedding)
      ),
    });

    if (!targetItem || !targetItem.embedding) {
      debugLog(`❌ Target item not found or missing embedding: ${itemId}`);
      return [];
    }

    debugLog(`🎬 Target item: "${targetItem.name}" (${targetItem.type})`);

    // Calculate cosine similarity with other items of the same type
    const similarity = sql<number>`1 - (${cosineDistance(
      items.embedding,
      targetItem.embedding
    )})`;

    const similarItems = await db
      .select({
        item: items,
        similarity: similarity,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverIdNum),
          eq(items.type, targetItem.type), // Same type (Movie, Series, etc.)
          isNotNull(items.embedding),
          sql`${items.id} != ${itemId}` // Exclude the target item itself
        )
      )
      .orderBy(desc(similarity))
      .limit(limit * 2); // Get more to filter for quality

    debugLog(`📊 Found ${similarItems.length} potential similar items`);

    // Filter for good similarity scores (threshold can be adjusted)
    const qualifiedSimilarItems = similarItems.filter(
      (result) => Number(result.similarity) > 0.6
    );

    debugLog(`✅ ${qualifiedSimilarItems.length} items with similarity > 0.6:`);
    qualifiedSimilarItems
      .slice(0, Math.min(5, limit))
      .forEach((result, index) => {
        debugLog(
          `  ${index + 1}. "${result.item.name}" - similarity: ${Number(
            result.similarity
          ).toFixed(3)}`
        );
      });

    // Transform to recommendation format
    const recommendations: RecommendationItem[] = qualifiedSimilarItems
      .slice(0, limit)
      .map((result) => ({
        item: jellyfinItemToUnified(result.item),
        similarity: Number(result.similarity),
        basedOn: [targetItem], // Based on the target item
      }));

    debugLog(`\n🎉 Returning ${recommendations.length} similar items`);
    return recommendations;
  } catch (error) {
    debugLog("❌ Error getting similar items for item:", error);
    return [];
  }
};

/**
 * Enhanced function that includes both Jellyfin and Jellyseerr items in recommendations
 */
async function getUserSpecificRecommendationsWithJellyseerr(
  serverId: number,
  userId: string,
  limit: number
): Promise<RecommendationItem[]> {
  debugLog(
    `\n🚀 Enhanced recommendations with Jellyseerr for user ${userId}, server ${serverId}, limit ${limit}`
  );

  // Get the original Jellyfin-based recommendations
  const jellyfinRecommendations = await getUserSpecificRecommendations(
    serverId,
    userId,
    Math.ceil(limit * 0.7) // Use 70% for Jellyfin recommendations
  );

  debugLog(`📚 Got ${jellyfinRecommendations.length} Jellyfin recommendations`);

  // Get user's watch history to find what they like
  const userWatchHistory = await db
    .select({
      itemId: sessions.itemId,
      item: items,
      totalPlayDuration: sql<number>`SUM(${sessions.playDuration})`.as(
        "totalPlayDuration"
      ),
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .where(
      and(
        eq(sessions.serverId, serverId),
        eq(sessions.userId, userId),
        isNotNull(items.embedding),
        isNotNull(sessions.playDuration)
      )
    )
    .groupBy(sessions.itemId, items.id)
    .orderBy(desc(sql<number>`SUM(${sessions.playDuration})`))
    .limit(6);

  if (userWatchHistory.length === 0) {
    debugLog("❌ No watch history found for Jellyseerr matching");
    return jellyfinRecommendations;
  }

  debugLog(
    `🎬 Using ${userWatchHistory.length} watched items for Jellyseerr similarity`
  );

  // Find Jellyseerr items similar to user's favorite movies
  const jellyseerrRecommendations: RecommendationItem[] = [];
  const usedJellyseerrIds = new Set<string>();

  for (const watchedItem of userWatchHistory) {
    if (!watchedItem.item.embedding) continue;

    debugLog(
      `🔍 Finding Jellyseerr items similar to "${watchedItem.item.name}"`
    );

    // Calculate cosine similarity with Jellyseerr items
    const similarity = sql<number>`1 - (${cosineDistance(
      jellyseerrItems.embedding,
      watchedItem.item.embedding
    )})`;

    const similarJellyseerrItems = await db
      .select({
        item: jellyseerrItems,
        similarity: similarity,
      })
      .from(jellyseerrItems)
      .where(
        and(
          eq(jellyseerrItems.serverId, serverId),
          isNotNull(jellyseerrItems.embedding),
          eq(jellyseerrItems.processed, true)
        )
      )
      .orderBy(desc(similarity))
      .limit(10);

    // Filter for good similarity scores and not already used
    const qualifiedItems = similarJellyseerrItems
      .filter(
        (result) =>
          Number(result.similarity) > 0.6 &&
          !usedJellyseerrIds.has(result.item.id)
      )
      .slice(0, 3); // Take top 3 per watched item

    debugLog(
      `  Found ${qualifiedItems.length} qualified Jellyseerr items (similarity > 0.6)`
    );

    for (const result of qualifiedItems) {
      usedJellyseerrIds.add(result.item.id);
      jellyseerrRecommendations.push({
        item: jellyseerrItemToUnified(result.item),
        similarity: Number(result.similarity),
        basedOn: [watchedItem.item],
      });
    }
  }

  // Sort Jellyseerr recommendations by similarity
  jellyseerrRecommendations.sort((a, b) => b.similarity - a.similarity);

  debugLog(
    `🎭 Got ${jellyseerrRecommendations.length} Jellyseerr recommendations`
  );

  // Combine recommendations: mix Jellyfin and Jellyseerr
  const combinedRecommendations: RecommendationItem[] = [];
  const maxJellyseerrItems = Math.floor(limit * 0.3); // Use up to 30% for Jellyseerr

  // Interleave the recommendations for variety
  let jellyfinIndex = 0;
  let jellyseerrIndex = 0;
  let jellyseerrCount = 0;

  while (
    combinedRecommendations.length < limit &&
    (jellyfinIndex < jellyfinRecommendations.length ||
      (jellyseerrIndex < jellyseerrRecommendations.length &&
        jellyseerrCount < maxJellyseerrItems))
  ) {
    // Add Jellyfin recommendation
    if (jellyfinIndex < jellyfinRecommendations.length) {
      combinedRecommendations.push(jellyfinRecommendations[jellyfinIndex]);
      jellyfinIndex++;
    }

    // Add Jellyseerr recommendation (every 2-3 items)
    if (
      jellyseerrIndex < jellyseerrRecommendations.length &&
      jellyseerrCount < maxJellyseerrItems &&
      combinedRecommendations.length % 3 === 0
    ) {
      combinedRecommendations.push(jellyseerrRecommendations[jellyseerrIndex]);
      jellyseerrIndex++;
      jellyseerrCount++;
    }
  }

  debugLog(
    `\n✅ Final combined recommendations: ${combinedRecommendations.length} total`
  );
  debugLog(
    `   - ${
      combinedRecommendations.filter((r) => r.item.source === "jellyfin").length
    } from Jellyfin`
  );
  debugLog(
    `   - ${
      combinedRecommendations.filter((r) => r.item.source === "jellyseerr")
        .length
    } from Jellyseerr`
  );

  return combinedRecommendations;
}

export const hideRecommendation = async (
  serverId: string | number,
  itemId: string
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
          eq(hiddenRecommendations.itemId, itemId)
        )
      )
      .limit(1);

    if (existingHidden.length > 0) {
      return {
        success: true,
        error: false,
        message: "Recommendation already hidden",
      };
    }

    // Insert the hidden recommendation
    await db.insert(hiddenRecommendations).values({
      serverId: serverIdNum,
      userId: currentUser.id,
      itemId: itemId,
    });

    return {
      success: true,
      error: false,
      message: "Recommendation hidden successfully",
    };
  } catch (error) {
    debugLog("Error hiding recommendation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
