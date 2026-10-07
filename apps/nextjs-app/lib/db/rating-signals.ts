import "server-only";

import { db } from "@streamystats/database";
import { items, userItemRatings } from "@streamystats/database/schema";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { getItemEmbeddingComparison } from "./embedding-comparison";
import {
  pickRatingSignals,
  type RatingRow,
  type RatingSignals,
  relativeSimilarity,
} from "./rating-signals-pick";

export type { RatingSignals } from "./rating-signals-pick";

/**
 * What a user's explicit ratings say about their taste: which items to treat
 * as seeds (liked), which to steer away from (disliked), and which are already
 * known to them and so never worth recommending.
 */
export async function getUserRatingSignals({
  serverId,
  userId,
}: {
  serverId: number;
  userId: string;
}): Promise<RatingSignals> {
  // One opinion per item: a plugin star review is more deliberate than a
  // native like/favorite, so it wins when both exist.
  const rows = await db
    .selectDistinctOn([userItemRatings.itemId], {
      itemId: userItemRatings.itemId,
      rating: userItemRatings.rating,
      ratedAt: userItemRatings.ratedAt,
      seriesId: items.seriesId,
      hasEmbedding: sql<boolean>`${items.embedding} IS NOT NULL`,
    })
    .from(userItemRatings)
    .innerJoin(items, eq(userItemRatings.itemId, items.id))
    .where(
      and(
        eq(userItemRatings.serverId, serverId),
        eq(userItemRatings.userId, userId),
        isNotNull(userItemRatings.itemId),
        isNull(items.deletedAt),
      ),
    )
    .orderBy(
      userItemRatings.itemId,
      sql`(${userItemRatings.source} = 'jellyfin-enhanced') DESC`,
      sql`${userItemRatings.ratedAt} DESC NULLS LAST`,
    );

  const ratingRows: RatingRow[] = [];
  for (const row of rows) {
    if (row.itemId === null) continue;
    ratingRows.push({
      itemId: row.itemId,
      rating: row.rating,
      ratedAt: row.ratedAt,
      seriesId: row.seriesId,
      hasEmbedding: row.hasEmbedding === true,
    });
  }
  return pickRatingSignals(ratingRows);
}

/**
 * For each candidate, its highest relative similarity (see relativeSimilarity)
 * to anything the user disliked, each dislike normalized by its own closest
 * candidate. Exact distances over the (small) candidate set rather than an
 * index scan.
 */
export async function getDislikeRelevances({
  dislikedItemIds,
  candidateIds,
}: {
  dislikedItemIds: string[];
  candidateIds: string[];
}): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (dislikedItemIds.length === 0 || candidateIds.length === 0) return result;

  const disliked = await db
    .select({ embedding: items.embedding })
    .from(items)
    .where(and(inArray(items.id, dislikedItemIds), isNotNull(items.embedding)));

  for (const { embedding } of disliked) {
    if (!embedding) continue;
    const { distance, dimensionFilter } = getItemEmbeddingComparison(embedding);
    const rows = await db
      .select({ id: items.id, similarity: sql<number>`1 - (${distance})` })
      .from(items)
      .where(and(inArray(items.id, candidateIds), dimensionFilter));
    const top = Math.max(0, ...rows.map((row) => Number(row.similarity)));
    for (const row of rows) {
      const relevance = relativeSimilarity(Number(row.similarity), top);
      const previous = result.get(row.id);
      if (previous === undefined || relevance > previous) {
        result.set(row.id, relevance);
      }
    }
  }
  return result;
}
