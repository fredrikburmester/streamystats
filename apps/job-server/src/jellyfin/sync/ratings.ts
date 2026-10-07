import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  items,
  servers,
  users,
  userItemRatings,
  type NewUserItemRating,
} from "@streamystats/database";
import { JellyfinClient } from "../client";
import {
  opinionToRating,
  parseReviewTarget,
  type JellyfinEnhancedReview,
  type ReviewTarget,
} from "../ratings-parse";
import { formatSyncLogLine } from "./sync-log";
import { getInternalUrl } from "../../utils/server-url";

export const RATING_SOURCES = {
  JELLYFIN: "jellyfin",
  JELLYFIN_ENHANCED: "jellyfin-enhanced",
} as const;

export interface ReviewLookups {
  movieByTmdb: Map<string, string>;
  seriesByTmdb: Map<string, string>;
  /** key: `${seriesItemId}:${season}:${episode}` */
  episodeByNumber: Map<string, string>;
}

export function episodeKey({
  seriesId,
  season,
  episode,
}: {
  seriesId: string;
  season: number;
  episode: number;
}): string {
  return `${seriesId}:${season}:${episode}`;
}

/**
 * The library item a review is about. A season review lands on its series:
 * there is no season-level embedding to learn from, and the season's content
 * is the series' content.
 */
export function resolveReviewItemId(
  target: ReviewTarget,
  lookups: ReviewLookups
): string | null {
  switch (target.kind) {
    case "movie":
      return lookups.movieByTmdb.get(target.tmdbId) ?? null;
    case "series":
      return lookups.seriesByTmdb.get(target.tmdbId) ?? null;
    case "season":
      return lookups.seriesByTmdb.get(target.seriesTmdbId) ?? null;
    case "episode": {
      const seriesId = lookups.seriesByTmdb.get(target.seriesTmdbId);
      if (!seriesId) return null;
      return (
        lookups.episodeByNumber.get(
          episodeKey({ seriesId, season: target.season, episode: target.episode })
        ) ?? null
      );
    }
  }
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function buildReviewLookups(
  serverId: number,
  targets: ReviewTarget[]
): Promise<ReviewLookups> {
  const movieTmdbIds = new Set<string>();
  const seriesTmdbIds = new Set<string>();
  for (const target of targets) {
    if (target.kind === "movie") movieTmdbIds.add(target.tmdbId);
    else if (target.kind === "series") seriesTmdbIds.add(target.tmdbId);
    else seriesTmdbIds.add(target.seriesTmdbId);
  }

  const byTmdb = async (type: "Movie" | "Series", ids: Set<string>) => {
    const map = new Map<string, string>();
    if (ids.size === 0) return map;
    const rows = await db
      .select({ id: items.id, tmdb: sql<string>`${items.providerIds}->>'Tmdb'` })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverId),
          eq(items.type, type),
          isNull(items.deletedAt),
          inArray(sql`${items.providerIds}->>'Tmdb'`, [...ids])
        )
      );
    for (const row of rows) {
      if (row.tmdb && !map.has(row.tmdb)) map.set(row.tmdb, row.id);
    }
    return map;
  };

  const movieByTmdb = await byTmdb("Movie", movieTmdbIds);
  const seriesByTmdb = await byTmdb("Series", seriesTmdbIds);

  const episodeByNumber = new Map<string, string>();
  const ratedSeriesIds = new Set<string>();
  for (const target of targets) {
    if (target.kind !== "episode") continue;
    const seriesId = seriesByTmdb.get(target.seriesTmdbId);
    if (seriesId) ratedSeriesIds.add(seriesId);
  }
  if (ratedSeriesIds.size > 0) {
    const episodes = await db
      .select({
        id: items.id,
        seriesId: items.seriesId,
        season: items.parentIndexNumber,
        episode: items.indexNumber,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverId),
          eq(items.type, "Episode"),
          isNull(items.deletedAt),
          inArray(items.seriesId, [...ratedSeriesIds])
        )
      );
    for (const ep of episodes) {
      if (ep.seriesId === null || ep.season === null || ep.episode === null) continue;
      const key = episodeKey({ seriesId: ep.seriesId, season: ep.season, episode: ep.episode });
      if (!episodeByNumber.has(key)) episodeByNumber.set(key, ep.id);
    }
  }

  return { movieByTmdb, seriesByTmdb, episodeByNumber };
}

/**
 * Replace every source's ratings in one transaction, so readers never see one
 * source from this sync next to another from the previous one.
 */
async function replaceSources({
  serverId,
  snapshots,
}: {
  serverId: number;
  snapshots: { source: string; rows: NewUserItemRating[] }[];
}): Promise<void> {
  await db.transaction(async (tx) => {
    for (const { source, rows } of snapshots) {
      await tx
        .delete(userItemRatings)
        .where(and(eq(userItemRatings.serverId, serverId), eq(userItemRatings.source, source)));
      for (let i = 0; i < rows.length; i += 500) {
        await tx.insert(userItemRatings).values(rows.slice(i, i + 500)).onConflictDoNothing();
      }
    }
  });
}

export function buildEnhancedRows({
  serverId,
  reviews,
  knownUserIds,
  lookups,
}: {
  serverId: number;
  reviews: JellyfinEnhancedReview[];
  knownUserIds: Set<string>;
  lookups: ReviewLookups;
}): NewUserItemRating[] {
  const rows: NewUserItemRating[] = [];
  for (const review of reviews) {
    if (!knownUserIds.has(review.userId)) continue;
    const target = parseReviewTarget(review.mediaType, review.tmdbId);
    if (!target) continue;
    rows.push({
      serverId,
      userId: review.userId,
      itemId: resolveReviewItemId(target, lookups),
      source: RATING_SOURCES.JELLYFIN_ENHANCED,
      sourceKey: `${review.mediaType}:${review.tmdbId}`,
      rating: review.rating,
      review: review.content,
      ratedAt: parseDate(review.updatedAt),
    });
  }
  return rows;
}

/**
 * Pull every user's explicit opinions from Jellyfin (likes, dislikes,
 * favorites) and, when the Jellyfin Enhanced plugin is installed, its star
 * reviews. Both sources are replaced wholesale, together, so removals
 * propagate.
 */
export async function syncRatingsForServer(serverId: number): Promise<{
  native: number;
  enhanced: number | null;
  unmatched: number;
}> {
  const startTime = Date.now();
  const serverRows = await db
    .select({
      url: servers.url,
      internalUrl: servers.internalUrl,
      apiKey: servers.apiKey,
      name: servers.name,
    })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);
  const server = serverRows[0];
  if (!server) throw new Error(`Server not found: ${serverId}`);
  const client = new JellyfinClient({ baseURL: getInternalUrl(server), apiKey: server.apiKey });

  const serverUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.serverId, serverId));
  const knownUserIds = new Set(serverUsers.map((u) => u.id));

  const nativeRows: NewUserItemRating[] = [];
  const opinionsByUser = new Map<string, Awaited<ReturnType<JellyfinClient["getUserOpinionItems"]>>>();
  const opinionItemIds = new Set<string>();
  for (const user of serverUsers) {
    const opinions = await client.getUserOpinionItems(user.id);
    opinionsByUser.set(user.id, opinions);
    for (const item of opinions) opinionItemIds.add(item.Id);
  }
  const existingIds = new Set<string>();
  const idList = [...opinionItemIds];
  for (let i = 0; i < idList.length; i += 1000) {
    const rows = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.serverId, serverId), inArray(items.id, idList.slice(i, i + 1000))));
    for (const row of rows) existingIds.add(row.id);
  }
  for (const [userId, opinions] of opinionsByUser) {
    for (const item of opinions) {
      nativeRows.push({
        serverId,
        userId,
        itemId: existingIds.has(item.Id) ? item.Id : null,
        source: RATING_SOURCES.JELLYFIN,
        sourceKey: item.Id,
        rating: opinionToRating(item.UserData),
        review: null,
        ratedAt: null,
      });
    }
  }
  // An unavailable plugin (uninstalled, or the key lost access) contributes an
  // empty snapshot: its earlier ratings must not keep shaping recommendations.
  // Transient failures throw before anything is written.
  const reviews = await client.getJellyfinEnhancedReviews();
  let enhancedRows: NewUserItemRating[] = [];
  if (reviews !== null) {
    const targets = reviews
      .map((r) => parseReviewTarget(r.mediaType, r.tmdbId))
      .filter((t): t is ReviewTarget => t !== null);
    const lookups = await buildReviewLookups(serverId, targets);
    enhancedRows = buildEnhancedRows({ serverId, reviews, knownUserIds, lookups });
  }

  await replaceSources({
    serverId,
    snapshots: [
      { source: RATING_SOURCES.JELLYFIN, rows: nativeRows },
      { source: RATING_SOURCES.JELLYFIN_ENHANCED, rows: enhancedRows },
    ],
  });

  const enhancedCount = reviews === null ? null : enhancedRows.length;
  const unmatched = [...nativeRows, ...enhancedRows].filter((r) => r.itemId === null).length;

  console.info(
    formatSyncLogLine("ratings-sync", {
      server: server.name,
      page: 0,
      processed: nativeRows.length + (enhancedCount ?? 0),
      inserted: nativeRows.length + (enhancedCount ?? 0),
      updated: 0,
      errors: 0,
      processMs: Date.now() - startTime,
      totalProcessed: nativeRows.length + (enhancedCount ?? 0),
      serverId,
      native: nativeRows.length,
      enhanced: enhancedCount === null ? "unavailable" : enhancedCount,
      unmatched,
    })
  );

  return { native: nativeRows.length, enhanced: enhancedCount, unmatched };
}
