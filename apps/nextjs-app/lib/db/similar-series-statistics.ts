"use server";

import { db } from "@streamystats/database";
import {
  hiddenRecommendations,
  type Item,
  items,
} from "@streamystats/database/schema";
import {
  and,
  cosineDistance,
  desc,
  eq,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { revalidateTag } from "next/cache";

import { getMe } from "./users";
import { getProfileRecommendations } from "./recommendation-engine";

const debugLog = (..._args: unknown[]) => {};

export interface SeriesRecommendationItem {
  item: SeriesRecommendationCardItem;
  similarity: number;
  basedOn: SeriesRecommendationCardItem[];
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

/**
 * Get series recommendations for a user.
 *
 * Uses the pre-computed user taste profile from user_embeddings for a single
 * fast HNSW-indexed vector search. Returns empty if no profile exists yet.
 */
export async function getSimilarSeries(
  serverId: string | number,
  userId?: string,
  limit = 20,
  offset = 0,
): Promise<SeriesRecommendationItem[]> {
  const serverIdNum = Number(serverId);

  let targetUserId = userId;
  if (!targetUserId) {
    const currentUser = await getMe();
    if (currentUser && currentUser.serverId === serverIdNum) {
      targetUserId = currentUser.id;
    } else {
      return [];
    }
  }

  try {
    const results = await getProfileRecommendations(
      serverIdNum,
      targetUserId,
      "Series",
      limit,
      offset,
    );

    // Map to existing return type (basedOn is always [])
    return results as SeriesRecommendationItem[];
  } catch (error) {
    debugLog("❌ Error getting series recommendations:", error);
    return [];
  }
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

/**
 * Get series similar to a specific series (not user-based).
 * Unchanged — uses direct cosine distance against a specific series' embedding.
 */
export const getSimilarSeriesForItem = async (
  serverId: string | number,
  itemId: string,
  limit = 10,
): Promise<SeriesRecommendationItem[]> => {
  try {
    const serverIdNum = Number(serverId);

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
      return [];
    }

    const similarity = sql<number>`1 - (${cosineDistance(
      items.embedding,
      targetSeries.embedding,
    )})`;

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
          sql`${items.id} != ${itemId}`,
        ),
      )
      .orderBy(desc(similarity))
      .limit(limit * 2);

    const qualifiedSimilarSeries = similarSeries.filter(
      (result) => Number(result.similarity) > 0.4,
    );

    return qualifiedSimilarSeries.slice(0, limit).map((result) => ({
      item: result.item,
      similarity: Number(result.similarity),
      basedOn: [
        stripEmbedding(
          targetSeries as SeriesRecommendationCardItemWithEmbedding,
        ),
      ],
    }));
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
    const currentUser = await getMe();
    if (!currentUser || currentUser.serverId !== Number(serverId)) {
      return {
        success: false,
        error: "User not found or not authorized for this server",
      };
    }

    const serverIdNum = Number(serverId);

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

    await db.insert(hiddenRecommendations).values({
      serverId: serverIdNum,
      userId: currentUser.id,
      itemId: itemId,
    });

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
