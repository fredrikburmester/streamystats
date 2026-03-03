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
import {
  getProfileRecommendations,
  type RecommendationCardItem,
  type RecommendationResult,
} from "./recommendation-engine";
import { getMe } from "./users";

export type RecommendationItem = RecommendationResult;

type RecommendationCardItemWithEmbedding = RecommendationCardItem & {
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
  item: RecommendationCardItemWithEmbedding,
): RecommendationCardItem => {
  const { embedding: _embedding, ...card } = item;
  return card;
};

/**
 * Get movie recommendations for a user.
 *
 * Uses the pre-computed user taste profile from user_embeddings for a single
 * fast HNSW-indexed vector search. Returns empty if no profile exists yet.
 */
export async function getSimilarStatistics(
  serverId: string | number,
  userId?: string,
  limit = 20,
  offset = 0,
): Promise<RecommendationItem[]> {
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
    return await getProfileRecommendations(
      serverIdNum,
      targetUserId,
      "Movie",
      limit,
      offset,
    );
  } catch (error) {
    console.error("Error getting movie recommendations:", error);
    return [];
  }
}

export const revalidateRecommendations = async (
  serverId: number,
  userId?: string,
) => {
  revalidateTag(`recommendations-${serverId}`, "hours");
  if (userId) {
    revalidateTag(`recommendations-${serverId}-${userId}`, "hours");
  }
};

/**
 * Get items similar to a specific item (not user-based).
 * This function is unchanged — it uses direct cosine distance against
 * a specific item's embedding, not the user profile.
 */
export const getSimilarItemsForItem = async (
  serverId: string | number,
  itemId: string,
  limit = 10,
): Promise<RecommendationItem[]> => {
  try {
    const serverIdNum = Number(serverId);

    // Get the target item with its embedding
    const targetItem = await db.query.items.findFirst({
      where: and(
        eq(items.id, itemId),
        eq(items.serverId, serverIdNum),
        isNotNull(items.embedding),
      ),
      columns: itemCardWithEmbeddingColumns,
    });

    if (!targetItem || !targetItem.embedding) {
      return [];
    }

    // Calculate cosine similarity with other items of the same type
    const similarity = sql<number>`1 - (${cosineDistance(
      items.embedding,
      targetItem.embedding,
    )})`;

    const similarItems = await db
      .select({
        item: itemCardSelect,
        similarity: similarity,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverIdNum),
          isNull(items.deletedAt),
          eq(items.type, targetItem.type),
          isNotNull(items.embedding),
          sql`${items.id} != ${itemId}`,
        ),
      )
      .orderBy(desc(similarity))
      .limit(limit * 2);

    const qualifiedSimilarItems = similarItems.filter(
      (result) => Number(result.similarity) > 0.4,
    );

    return qualifiedSimilarItems.slice(0, limit).map((result) => ({
      item: result.item,
      similarity: Number(result.similarity),
      basedOn: [
        stripEmbedding(targetItem as RecommendationCardItemWithEmbedding),
      ],
    }));
  } catch (error) {
    console.error("Error getting similar items for item:", error);
    return [];
  }
};

export const hideRecommendation = async (
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
        message: "Recommendation already hidden",
      };
    }

    await db.insert(hiddenRecommendations).values({
      serverId: serverIdNum,
      userId: currentUser.id,
      itemId: itemId,
    });

    await revalidateRecommendations(serverIdNum, currentUser.id);

    return {
      success: true,
      error: false,
      message: "Recommendation hidden successfully",
    };
  } catch (error) {
    console.error("Error hiding recommendation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
