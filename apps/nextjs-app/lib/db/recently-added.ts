"use server";

import "server-only";

import { db } from "@streamystats/database";
import { items } from "@streamystats/database/schema";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  notInArray,
} from "drizzle-orm";
import { getExclusionSettings } from "./exclusions";
import type {
  RecentlyAddedEpisode,
  RecentlyAddedItem,
  RecentlyAddedSeriesGroup,
} from "./recently-added-types";

const itemSelect = {
  id: items.id,
  name: items.name,
  type: items.type,
  productionYear: items.productionYear,
  runtimeTicks: items.runtimeTicks,
  genres: items.genres,
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
  imageBlurHashes: items.imageBlurHashes,
  dateCreated: items.dateCreated,
} as const;

const episodeSelect = {
  ...itemSelect,
  seasonNumber: items.parentIndexNumber,
  episodeNumber: items.indexNumber,
  seriesName: items.seriesName,
} as const;

/**
 * Get recently added items for a server, filtered by type.
 * Items are sorted by dateCreated descending.
 */
export async function getRecentlyAddedItems(
  serverId: string | number,
  itemType: "Movie" | "Series",
  limit = 20,
  offset = 0,
): Promise<RecentlyAddedItem[]> {
  const serverIdNum = Number(serverId);

  const exclusions = await getExclusionSettings(serverIdNum);
  const { excludedLibraryIds } = exclusions;

  const results = await db
    .select(itemSelect)
    .from(items)
    .where(
      and(
        eq(items.serverId, serverIdNum),
        isNull(items.deletedAt),
        isNotNull(items.dateCreated),
        eq(items.type, itemType),
        excludedLibraryIds.length > 0
          ? notInArray(items.libraryId, excludedLibraryIds)
          : undefined,
      ),
    )
    .orderBy(desc(items.dateCreated))
    .limit(limit)
    .offset(offset);

  return results;
}

/**
 * Get recently added series with episode grouping.
 * Groups episodes by series and determines if it's a new series or just new episodes.
 */
export async function getRecentlyAddedSeriesWithEpisodes(
  serverId: string | number,
  days = 7,
  limit = 20,
  offset = 0,
): Promise<RecentlyAddedSeriesGroup[]> {
  const serverIdNum = Number(serverId);
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);

  const exclusions = await getExclusionSettings(serverIdNum);
  const { excludedLibraryIds } = exclusions;

  const libraryExclusion =
    excludedLibraryIds.length > 0
      ? notInArray(items.libraryId, excludedLibraryIds)
      : undefined;

  // 1. Get recently added episodes grouped by series
  const recentEpisodes = await db
    .select(episodeSelect)
    .from(items)
    .where(
      and(
        eq(items.serverId, serverIdNum),
        isNull(items.deletedAt),
        eq(items.type, "Episode"),
        isNotNull(items.seriesId),
        isNotNull(items.dateCreated),
        gte(items.dateCreated, thresholdDate),
        libraryExclusion,
      ),
    )
    .orderBy(desc(items.dateCreated));

  if (recentEpisodes.length === 0) {
    return [];
  }

  // 2. Group episodes by seriesId
  const episodesBySeriesId = new Map<string, RecentlyAddedEpisode[]>();
  for (const episode of recentEpisodes) {
    if (!episode.seriesId) continue;
    const existing = episodesBySeriesId.get(episode.seriesId) || [];
    existing.push(episode as RecentlyAddedEpisode);
    episodesBySeriesId.set(episode.seriesId, existing);
  }

  const seriesIds = Array.from(episodesBySeriesId.keys());

  // 3. Get series metadata for all grouped series
  const seriesData = await db
    .select(itemSelect)
    .from(items)
    .where(
      and(
        eq(items.serverId, serverIdNum),
        isNull(items.deletedAt),
        eq(items.type, "Series"),
        inArray(items.id, seriesIds),
      ),
    );

  const seriesMap = new Map<string, RecentlyAddedItem>();
  for (const series of seriesData) {
    seriesMap.set(series.id, series);
  }

  // 4. Get total episode count for each series to determine if it's "new"
  const totalEpisodeCounts = await db
    .select({
      seriesId: items.seriesId,
      totalCount: count(),
    })
    .from(items)
    .where(
      and(
        eq(items.serverId, serverIdNum),
        isNull(items.deletedAt),
        eq(items.type, "Episode"),
        inArray(items.seriesId, seriesIds),
      ),
    )
    .groupBy(items.seriesId);

  const totalCountMap = new Map<string, number>();
  for (const row of totalEpisodeCounts) {
    if (row.seriesId) {
      totalCountMap.set(row.seriesId, row.totalCount);
    }
  }

  // 5. Build the result
  const results: RecentlyAddedSeriesGroup[] = [];

  for (const [seriesId, episodes] of episodesBySeriesId) {
    const series = seriesMap.get(seriesId);
    if (!series) continue;

    const totalEpisodes = totalCountMap.get(seriesId) || 0;
    const newEpisodeCount = episodes.length;

    // A series is "new" if all its episodes were added in the time window
    const isNewSeries = newEpisodeCount === totalEpisodes && totalEpisodes > 0;

    // Sort episodes by date (newest first)
    episodes.sort((a, b) => {
      const dateA = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
      const dateB = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
      return dateB - dateA;
    });

    results.push({
      series,
      recentEpisodes: episodes,
      newEpisodeCount,
      isNewSeries,
      latestEpisode: episodes[0] || null,
    });
  }

  // Sort by the most recent episode's dateCreated
  results.sort((a, b) => {
    const dateA = a.latestEpisode?.dateCreated
      ? new Date(a.latestEpisode.dateCreated).getTime()
      : 0;
    const dateB = b.latestEpisode?.dateCreated
      ? new Date(b.latestEpisode.dateCreated).getTime()
      : 0;
    return dateB - dateA;
  });

  // Apply pagination
  return results.slice(offset, offset + limit);
}
