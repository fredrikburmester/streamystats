import "server-only";

import { db } from "@streamystats/database";
import { items, userItemRatings } from "@streamystats/database/schema";
import { and, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";

export interface RatedItem {
  rating: number;
  review: string | null;
  ratedAt: Date | null;
  item: {
    id: string;
    name: string;
    type: string | null;
    productionYear: number | null;
    communityRating: number | null;
    genres: string[] | null;
    overview: string | null;
    primaryImageTag: string | null;
    seriesId: string | null;
    seriesName: string | null;
    seriesPrimaryImageTag: string | null;
    parentIndexNumber: number | null;
    indexNumber: number | null;
  };
}

/** A user's rated library items, highest rated (then most recent) first. */
export async function getRatedItems({
  serverId,
  userId,
  minRating,
  maxRating,
  type,
  limit,
}: {
  serverId: number;
  userId: string;
  minRating: number;
  maxRating: number;
  type: "Movie" | "Series" | "Episode" | null;
  limit: number;
}): Promise<RatedItem[]> {
  // One opinion per item, preferring a plugin star review over a native
  // like/favorite (same precedence as recommendations).
  const perItem = db
    .selectDistinctOn([userItemRatings.itemId], {
      itemId: userItemRatings.itemId,
      rating: userItemRatings.rating,
      review: userItemRatings.review,
      ratedAt: userItemRatings.ratedAt,
    })
    .from(userItemRatings)
    .where(
      and(
        eq(userItemRatings.serverId, serverId),
        eq(userItemRatings.userId, userId),
        isNotNull(userItemRatings.itemId),
      ),
    )
    .orderBy(
      userItemRatings.itemId,
      sql`(${userItemRatings.source} = 'jellyfin-enhanced') DESC`,
      sql`${userItemRatings.ratedAt} DESC NULLS LAST`,
    )
    .as("per_item");

  const rows = await db
    .select({
      rating: perItem.rating,
      review: perItem.review,
      ratedAt: perItem.ratedAt,
      item: {
        id: items.id,
        name: items.name,
        type: items.type,
        productionYear: items.productionYear,
        communityRating: items.communityRating,
        genres: items.genres,
        overview: items.overview,
        primaryImageTag: items.primaryImageTag,
        seriesId: items.seriesId,
        seriesName: items.seriesName,
        seriesPrimaryImageTag: items.seriesPrimaryImageTag,
        parentIndexNumber: items.parentIndexNumber,
        indexNumber: items.indexNumber,
      },
    })
    .from(perItem)
    .innerJoin(items, eq(perItem.itemId, items.id))
    .where(
      and(
        isNull(items.deletedAt),
        gte(perItem.rating, minRating),
        lte(perItem.rating, maxRating),
        type ? eq(items.type, type) : sql`true`,
      ),
    )
    .orderBy(
      sql`${perItem.rating} DESC`,
      sql`${perItem.ratedAt} DESC NULLS LAST`,
    )
    .limit(limit);

  return rows;
}
