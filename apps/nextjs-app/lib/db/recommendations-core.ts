import "server-only";

import {
  db,
  itemEdges,
  items,
  userTasteProfiles,
} from "@streamystats/database";
import type {
  ItemEdgeMetadata,
  UserTasteProfile,
} from "@streamystats/database/schema";
import { hiddenRecommendations } from "@streamystats/database/schema";
import {
  and,
  cosineDistance,
  eq,
  inArray,
  isNull,
  notInArray,
  sql,
} from "drizzle-orm";
import {
  aggregateGraphScores,
  type CandidateSignals,
  diversify,
  type EdgeContribution,
  scoreCandidates,
} from "@/lib/recommendation-engine";
import { getStatisticsExclusions } from "./exclusions";
import { getSimilarSeries } from "./similar-series-statistics";
import type {
  RecommendationCardItem,
  RecommendationItem,
} from "./similar-statistics";
import { getSimilarStatistics } from "./similar-statistics";

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

export interface ForYouRecommendation extends RecommendationItem {
  /** Human-readable explanation of the strongest signal behind this pick */
  reason: string | null;
}

const CANDIDATE_POOL = 400;

async function getWatchedTitleIds(
  serverId: number,
  userId: string,
): Promise<string[]> {
  const rows = await db.execute(sql`
    SELECT DISTINCT CASE WHEN i.type = 'Episode' THEN i.series_id ELSE i.id END AS id
    FROM sessions s
    JOIN items i ON i.id = s.item_id
    WHERE s.server_id = ${serverId} AND s.user_id = ${userId}
  `);
  return (rows as unknown as Array<{ id: string | null }>)
    .map((r) => r.id)
    .filter((id): id is string => id !== null);
}

async function getHiddenItemIds(
  serverId: number,
  userId: string,
): Promise<string[]> {
  const rows = await db
    .select({ itemId: hiddenRecommendations.itemId })
    .from(hiddenRecommendations)
    .where(
      and(
        eq(hiddenRecommendations.serverId, serverId),
        eq(hiddenRecommendations.userId, userId),
      ),
    );
  return rows.map((r) => r.itemId);
}

function buildReason(
  contributions: EdgeContribution[],
  anchorNames: Map<string, string>,
  peopleByEdge: Map<string, string[]>,
): string | null {
  const top = contributions[0];
  if (!top) return null;
  const anchorName = anchorNames.get(top.anchorItemId);

  if (top.edgeType === "co_watched") {
    return anchorName
      ? `Loved by viewers who watched ${anchorName}`
      : "Loved by viewers with similar taste";
  }
  if (top.edgeType === "shared_people") {
    const people = peopleByEdge.get(`${top.anchorItemId}`);
    if (people && people.length > 0) {
      return `Features ${people[0]}`;
    }
    return anchorName ? `Shares cast or crew with ${anchorName}` : null;
  }
  return anchorName ? `Similar to ${anchorName}` : null;
}

export interface ForYouRecommendationParams {
  serverId: number;
  userId: string;
  mediaType: "Movie" | "Series";
  limit?: number;
  offset?: number;
  viewerUserId?: string;
}

/**
 * Graph-backed personalized recommendations.
 *
 * Traverses the recommendation graph from the user's anchor items, blends
 * graph proximity with taste-embedding similarity and profile priors
 * (genres, decades, ratings), applies a diversity re-rank, and explains each
 * pick. Falls back to the legacy embedding-only engine until the
 * recommendation-sync job has built the graph and profile.
 *
 * Trusted internal API: callers are responsible for authorizing `userId`
 * (the server-action wrapper in `recommendations.ts` guards it with the
 * session; the AI chat tools pass their already-authenticated user).
 */
export async function getForYouRecommendationsForUser({
  serverId,
  userId,
  mediaType,
  limit = 20,
  offset = 0,
  viewerUserId,
}: ForYouRecommendationParams): Promise<ForYouRecommendation[]> {
  try {
    const profile = await db.query.userTasteProfiles.findFirst({
      where: and(
        eq(userTasteProfiles.serverId, serverId),
        eq(userTasteProfiles.userId, userId),
      ),
    });

    const anchors = (profile?.anchorItems ?? []).filter((a) => a.weight > 0);
    if (!profile || anchors.length === 0) {
      return legacyFallback({
        serverId,
        userId,
        mediaType,
        limit,
        offset,
        viewerUserId,
      });
    }

    const [watchedIds, hiddenIds, { itemLibraryExclusion }] = await Promise.all(
      [
        getWatchedTitleIds(serverId, userId),
        getHiddenItemIds(serverId, userId),
        getStatisticsExclusions(serverId, viewerUserId),
      ],
    );

    const anchorIds = anchors.map((a) => a.itemId);
    const tasteVec = profile.tasteEmbedding;

    const semantic =
      tasteVec && tasteVec.length > 0
        ? sql<number>`CASE
            WHEN ${items.embedding} IS NOT NULL
              AND vector_dims(${items.embedding}) = ${tasteVec.length}
            THEN 1 - (${cosineDistance(items.embedding, tasteVec)})
            ELSE 0 END`
        : sql<number>`0`;

    const edgeRows = await db
      .select({
        sourceItemId: itemEdges.sourceItemId,
        edgeType: itemEdges.edgeType,
        weight: itemEdges.weight,
        metadata: itemEdges.metadata,
        semantic,
        item: itemCardSelect,
      })
      .from(itemEdges)
      .innerJoin(items, eq(itemEdges.targetItemId, items.id))
      .where(
        and(
          eq(itemEdges.serverId, serverId),
          inArray(itemEdges.sourceItemId, anchorIds),
          eq(items.type, mediaType),
          isNull(items.deletedAt),
          watchedIds.length > 0 ? notInArray(items.id, watchedIds) : undefined,
          hiddenIds.length > 0 ? notInArray(items.id, hiddenIds) : undefined,
          itemLibraryExclusion ?? undefined,
        ),
      )
      .limit(CANDIDATE_POOL * 4);

    if (edgeRows.length === 0) {
      return legacyFallback({
        serverId,
        userId,
        mediaType,
        limit,
        offset,
        viewerUserId,
      });
    }

    // Aggregate the edge list into per-candidate graph scores
    const graphScores = aggregateGraphScores(
      edgeRows.map((row) => ({
        sourceItemId: row.sourceItemId,
        targetItemId: row.item.id,
        edgeType: row.edgeType,
        weight: row.weight,
      })),
      anchors.map((a) => ({ itemId: a.itemId, weight: a.weight })),
    );

    // Collect per-candidate metadata (card, best semantic score, people labels)
    const cards = new Map<string, RecommendationCardItem>();
    const semanticByItem = new Map<string, number>();
    const peopleByAnchorForItem = new Map<string, Map<string, string[]>>();

    for (const row of edgeRows) {
      const id = row.item.id;
      if (!cards.has(id)) cards.set(id, row.item);
      const sem = Number(row.semantic) || 0;
      semanticByItem.set(id, Math.max(semanticByItem.get(id) ?? 0, sem));

      const metadata = row.metadata as ItemEdgeMetadata | null;
      if (row.edgeType === "shared_people" && metadata?.people?.length) {
        let perItem = peopleByAnchorForItem.get(id);
        if (!perItem) {
          perItem = new Map();
          peopleByAnchorForItem.set(id, perItem);
        }
        perItem.set(row.sourceItemId, metadata.people);
      }
    }

    const signals: CandidateSignals[] = [];
    for (const [id, graph] of graphScores) {
      const card = cards.get(id);
      if (!card) continue;
      signals.push({
        itemId: id,
        graphScore: graph.score,
        semanticSimilarity: semanticByItem.get(id) ?? 0,
        genres: card.genres,
        productionYear: card.productionYear,
        communityRating: card.communityRating,
        contributions: graph.contributions,
      });
    }

    const scored = scoreCandidates(signals, {
      genreWeights: profile.genreWeights,
      decadeWeights: profile.decadeWeights,
      ratingAffinity: profile.ratingAffinity,
    }).sort((a, b) => b.score - a.score);

    const pool = scored.slice(0, CANDIDATE_POOL);
    const diversified = diversify(
      pool.map((s) => ({ ...s, genres: cards.get(s.itemId)?.genres ?? null })),
      (c) => c.genres?.[0] ?? null,
      offset + limit,
    ).slice(offset, offset + limit);

    // Resolve anchor cards for the "based on" chips
    const anchorCards = await db
      .select(itemCardSelect)
      .from(items)
      .where(and(eq(items.serverId, serverId), inArray(items.id, anchorIds)));
    const anchorCardById = new Map(anchorCards.map((c) => [c.id, c]));
    const anchorNames = new Map(anchorCards.map((c) => [c.id, c.name]));

    return diversified.flatMap((candidate) => {
      const card = cards.get(candidate.itemId);
      if (!card) return [];
      const basedOn: RecommendationCardItem[] = candidate.contributions
        .slice(0, 3)
        .flatMap((c) => {
          const anchorCard = anchorCardById.get(c.anchorItemId);
          return anchorCard ? [anchorCard] : [];
        });

      return [
        {
          item: card,
          similarity: candidate.score,
          basedOn,
          reason: buildReason(
            candidate.contributions,
            anchorNames,
            peopleByAnchorForItem.get(candidate.itemId) ?? new Map(),
          ),
        },
      ];
    });
  } catch (error) {
    console.error("Error getting graph recommendations:", error);
    return legacyFallback({
      serverId,
      userId,
      mediaType,
      limit,
      offset,
      viewerUserId,
    });
  }
}

async function legacyFallback({
  serverId,
  userId,
  mediaType,
  limit,
  offset,
  viewerUserId,
}: {
  serverId: number;
  userId?: string;
  mediaType: "Movie" | "Series";
  limit: number;
  offset: number;
  viewerUserId?: string;
}): Promise<ForYouRecommendation[]> {
  const legacy =
    mediaType === "Movie"
      ? await getSimilarStatistics({
          serverId,
          userId,
          limit,
          offset,
          viewerUserId,
        })
      : await getSimilarSeries({
          serverId,
          userId,
          limit,
          offset,
          viewerUserId,
        });

  return legacy.map((rec) => ({ ...rec, reason: null }));
}

export interface TasteProfileSummary {
  genreWeights: Record<string, number>;
  decadeWeights: Record<string, number>;
  peopleAffinities: Array<{ name: string; type: string; weight: number }>;
  preferredRuntimeMins: number | null;
  ratingAffinity: number | null;
  noveltyScore: number | null;
  completionRate: number | null;
  watchedItemCount: number;
  totalWatchSeconds: number;
  anchorTitles: string[];
  computedAt: string;
}

/**
 * Enriched taste profile for a user, without the raw embedding vector.
 * Used by the AI chat tools and profile views. Returns null until the
 * recommendation-sync job has computed a profile.
 *
 * Trusted internal API: callers are responsible for authorizing `userId`.
 */
export async function getTasteProfileSummaryForUser({
  serverId,
  userId,
}: {
  serverId: number;
  userId: string;
}): Promise<TasteProfileSummary | null> {
  const profile: UserTasteProfile | undefined =
    await db.query.userTasteProfiles.findFirst({
      where: and(
        eq(userTasteProfiles.serverId, serverId),
        eq(userTasteProfiles.userId, userId),
      ),
    });

  if (!profile) return null;

  const anchorIds = (profile.anchorItems ?? []).map((a) => a.itemId);
  const anchorRows =
    anchorIds.length > 0
      ? await db
          .select({ id: items.id, name: items.name })
          .from(items)
          .where(
            and(eq(items.serverId, serverId), inArray(items.id, anchorIds)),
          )
      : [];
  const nameById = new Map(anchorRows.map((r) => [r.id, r.name]));

  return {
    genreWeights: profile.genreWeights ?? {},
    decadeWeights: profile.decadeWeights ?? {},
    peopleAffinities: (profile.peopleAffinities ?? []).map((p) => ({
      name: p.name,
      type: p.type,
      weight: p.weight,
    })),
    preferredRuntimeMins: profile.preferredRuntimeMins,
    ratingAffinity: profile.ratingAffinity,
    noveltyScore: profile.noveltyScore,
    completionRate: profile.completionRate,
    watchedItemCount: profile.watchedItemCount,
    totalWatchSeconds: profile.totalWatchSeconds,
    anchorTitles: (profile.anchorItems ?? [])
      .map((a) => nameById.get(a.itemId))
      .filter((n): n is string => n !== undefined),
    computedAt: profile.computedAt.toISOString(),
  };
}
