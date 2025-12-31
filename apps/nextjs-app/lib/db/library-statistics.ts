import {
  db,
  type Item,
  items,
  libraries,
  mediaSources,
  sessions,
  users,
} from "@streamystats/database";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  max,
  type SQL,
  sql,
  sum,
} from "drizzle-orm";
import { getStatisticsExclusions } from "./exclusions";

// Type definitions for library statistics
export interface AggregatedLibraryStatistics {
  movies_count: number;
  episodes_count: number;
  series_count: number;
  libraries_count: number;
  users_count: number;
  total_items: number;
  total_watch_time: number;
  total_play_count: number;
}

// Type definitions for item watch statistics
export interface ItemWatchStats {
  item_id: string;
  item: Item;
  total_watch_time: number;
  watch_count: number;
  unique_viewers: number;
  last_watched?: string | null;
  first_watched?: string | null;
}

export interface ItemWatchStatsResponse {
  data: ItemWatchStats[];
  page: number;
  per_page: number;
  total_pages: number;
  total_items: number;
}

/**
 * Get aggregated library statistics for a server
 */
export const getAggregatedLibraryStatistics = async ({
  serverId,
}: {
  serverId: number;
}): Promise<AggregatedLibraryStatistics> => {
  // Get exclusion settings
  const {
    itemLibraryExclusion,
    usersTableExclusion,
    librariesTableExclusion,
    userExclusion,
  } = await getStatisticsExclusions(serverId);

  // Build item conditions (excluding soft-deleted items and excluded libraries)
  const itemConditions: SQL[] = [
    eq(items.serverId, serverId),
    isNull(items.deletedAt),
  ];
  if (itemLibraryExclusion) {
    itemConditions.push(itemLibraryExclusion);
  }

  // Get counts by item type (excluding soft-deleted items and excluded libraries)
  const itemCounts = await db
    .select({
      type: items.type,
      count: count(items.id),
    })
    .from(items)
    .where(and(...itemConditions))
    .groupBy(items.type);

  // Build library conditions
  const libraryConditions: SQL[] = [eq(libraries.serverId, serverId)];
  if (librariesTableExclusion) {
    libraryConditions.push(librariesTableExclusion);
  }

  // Get library count (excluding excluded libraries)
  const libraryCount = await db
    .select({ count: count(libraries.id) })
    .from(libraries)
    .where(and(...libraryConditions))
    .then((result: { count: number }[]) => result[0]?.count || 0);

  // Build user conditions
  const userConditions: SQL[] = [eq(users.serverId, serverId)];
  if (usersTableExclusion) {
    userConditions.push(usersTableExclusion);
  }

  // Get user count (excluding excluded users)
  const userCount = await db
    .select({ count: count(users.id) })
    .from(users)
    .where(and(...userConditions))
    .then((result: { count: number }[]) => result[0]?.count || 0);

  // Build session conditions
  const sessionConditions: SQL[] = [eq(sessions.serverId, serverId)];
  if (userExclusion) {
    sessionConditions.push(userExclusion);
  }

  // Get total watch stats (excluding excluded users)
  const watchStats = await db
    .select({
      totalWatchTime: sum(sessions.playDuration),
      totalPlayCount: count(sessions.id),
    })
    .from(sessions)
    .where(and(...sessionConditions))
    .then(
      (result: { totalWatchTime: string | null; totalPlayCount: number }[]) => {
        const row = result[0];
        return {
          totalWatchTime: Number(row?.totalWatchTime || 0),
          totalPlayCount: row?.totalPlayCount || 0,
        };
      },
    );

  // Process item counts
  const moviesCount =
    itemCounts.find((item) => item.type === "Movie")?.count || 0;
  const episodesCount =
    itemCounts.find((item) => item.type === "Episode")?.count || 0;
  const seriesCount =
    itemCounts.find((item) => item.type === "Series")?.count || 0;
  const totalItems = itemCounts.reduce((sum, item) => sum + item.count, 0);

  return {
    movies_count: moviesCount,
    episodes_count: episodesCount,
    series_count: seriesCount,
    libraries_count: libraryCount,
    users_count: userCount,
    total_items: totalItems,
    total_watch_time: Number(watchStats.totalWatchTime || 0),
    total_play_count: Number(watchStats.totalPlayCount || 0),
  };
};

/**
 * Get library items with watch statistics
 */
export const getLibraryItemsWithStats = async ({
  serverId,
  page,
  sortOrder,
  sortBy,
  type,
  search,
  libraryIds,
}: {
  serverId: number;
  page?: string;
  sortOrder?: string;
  sortBy?: string;
  type?: "Movie" | "Episode" | "Series";
  search?: string;
  libraryIds?: string;
}): Promise<ItemWatchStatsResponse> => {
  // Get exclusion settings
  const { itemLibraryExclusion } = await getStatisticsExclusions(serverId);

  const currentPage = Math.max(1, Number(page) || 1);
  const perPage = 20;
  const offset = (currentPage - 1) * perPage;

  // Build base query conditions (excluding soft-deleted items and excluded libraries)
  const conditions: SQL[] = [
    eq(items.serverId, serverId),
    isNull(items.deletedAt),
  ];

  // Add library exclusion filter
  if (itemLibraryExclusion) {
    conditions.push(itemLibraryExclusion);
  }

  // Add type filter
  if (type) {
    conditions.push(eq(items.type, type));
  }

  // Add search filter
  if (search?.trim()) {
    conditions.push(ilike(items.name, `%${search.trim()}%`));
  }

  // Add library filter
  if (libraryIds?.trim()) {
    const libraryIdArray = libraryIds.split(",").filter((id) => id.trim());
    if (libraryIdArray.length > 0) {
      conditions.push(inArray(items.libraryId, libraryIdArray));
    }
  }

  // Build the base query for items with watch stats
  const baseQuery = db
    .select({
      item: items,
      totalWatchTime:
        sql<number>`COALESCE(SUM(${sessions.playDuration}), 0)`.as(
          "total_watch_time",
        ),
      watchCount: sql<number>`COUNT(${sessions.id})`.as("watch_count"),
      uniqueViewers: sql<number>`COUNT(DISTINCT ${sessions.userId})`.as(
        "unique_viewers",
      ),
      firstWatched: sql<string>`MIN(${sessions.startTime})`.as("first_watched"),
      lastWatched: sql<string>`MAX(${sessions.startTime})`.as("last_watched"),
    })
    .from(items)
    .leftJoin(sessions, eq(items.id, sessions.itemId))
    .where(and(...conditions))
    .groupBy(items.id);

  // Apply sorting
  let orderClause: SQL | undefined;
  const order = sortOrder === "desc" ? desc : asc;

  switch (sortBy) {
    case "name":
      orderClause = order(items.name);
      break;
    case "total_watch_time":
      orderClause = order(sql`COALESCE(SUM(${sessions.playDuration}), 0)`);
      break;
    case "watch_count":
      orderClause = order(sql`COUNT(${sessions.id})`);
      break;
    case "official_rating":
      orderClause = order(items.officialRating);
      break;
    case "community_rating":
      orderClause = order(items.communityRating);
      break;
    case "runtime":
      orderClause = order(items.runtimeTicks);
      break;
    case "genres":
      orderClause = order(sql`array_to_string(${items.genres}, ', ')`);
      break;
    default:
      orderClause = desc(sql`COALESCE(SUM(${sessions.playDuration}), 0)`);
  }

  // Get paginated results
  const results = await baseQuery
    .orderBy(orderClause)
    .limit(perPage)
    .offset(offset);

  // Get total count for pagination
  const totalCountQuery = db
    .select({ count: sql<number>`COUNT(DISTINCT ${items.id})` })
    .from(items)
    .leftJoin(sessions, eq(items.id, sessions.itemId))
    .where(and(...conditions));

  const totalCount = await totalCountQuery.then(
    (result) => result[0]?.count || 0,
  );

  const totalPages = Math.ceil(totalCount / perPage);

  // Transform results to match expected interface
  const data: ItemWatchStats[] = results.map(
    (row: {
      item: Item;
      totalWatchTime: number;
      watchCount: number;
      uniqueViewers: number;
      firstWatched: string;
      lastWatched: string;
    }) => ({
      item_id: row.item.id,
      item: row.item,
      total_watch_time: Number(row.totalWatchTime),
      watch_count: Number(row.watchCount),
      unique_viewers: Number(row.uniqueViewers),
      first_watched: row.firstWatched,
      last_watched: row.lastWatched,
    }),
  );

  return {
    data,
    page: currentPage,
    per_page: perPage,
    total_pages: totalPages,
    total_items: totalCount,
  };
};

// Type definition for per-library statistics
export interface PerLibraryStatistics {
  libraryId: string;
  libraryName: string;
  libraryType: string;

  // Content counts
  totalFiles: number;
  moviesCount: number;
  seriesCount: number;
  seasonsCount: number;
  episodesCount: number;

  // Size and time
  totalSizeBytes: number;
  totalRuntimeTicks: number;

  // Playback stats
  totalPlays: number;
  totalPlaybackSeconds: number;

  // Last activity
  lastPlayedItemId: string | null;
  lastPlayedItemName: string | null;
  lastPlayedByUserId: string | null;
  lastPlayedByUserName: string | null;
  lastActivityTime: Date | null;
}

/**
 * Get per-library statistics for a server
 */
export const getPerLibraryStatistics = async ({
  serverId,
}: {
  serverId: number;
}): Promise<PerLibraryStatistics[]> => {
  // Get exclusion settings
  const { librariesTableExclusion, itemLibraryExclusion, userExclusion } =
    await getStatisticsExclusions(serverId);

  // Build library conditions
  const libraryConditions: SQL[] = [eq(libraries.serverId, serverId)];
  if (librariesTableExclusion) {
    libraryConditions.push(librariesTableExclusion);
  }

  // Get all libraries for this server
  const serverLibraries = await db
    .select({
      id: libraries.id,
      name: libraries.name,
      type: libraries.type,
    })
    .from(libraries)
    .where(and(...libraryConditions))
    .orderBy(libraries.name);

  if (serverLibraries.length === 0) {
    return [];
  }

  const libraryIds = serverLibraries.map((lib) => lib.id);

  // Build item conditions
  const itemConditions: SQL[] = [
    eq(items.serverId, serverId),
    isNull(items.deletedAt),
    inArray(items.libraryId, libraryIds),
  ];
  if (itemLibraryExclusion) {
    itemConditions.push(itemLibraryExclusion);
  }

  // Query 1: Get item counts and runtime per library, grouped by type
  const itemStats = await db
    .select({
      libraryId: items.libraryId,
      type: items.type,
      count: count(items.id),
      totalRuntime: sum(items.runtimeTicks),
    })
    .from(items)
    .where(and(...itemConditions))
    .groupBy(items.libraryId, items.type);

  // Query 2: Get media source sizes per library
  const sizeStats = await db
    .select({
      libraryId: items.libraryId,
      totalSize: sum(mediaSources.size),
    })
    .from(mediaSources)
    .innerJoin(items, eq(mediaSources.itemId, items.id))
    .where(and(...itemConditions))
    .groupBy(items.libraryId);

  // Build session conditions for playback stats
  const sessionConditions: SQL[] = [
    eq(sessions.serverId, serverId),
    inArray(items.libraryId, libraryIds),
  ];
  if (userExclusion) {
    sessionConditions.push(userExclusion);
  }
  if (itemLibraryExclusion) {
    sessionConditions.push(itemLibraryExclusion);
  }

  // Query 3: Get session stats per library
  const sessionStats = await db
    .select({
      libraryId: items.libraryId,
      totalPlays: count(sessions.id),
      totalPlayback: sum(sessions.playDuration),
      lastActivity: max(sessions.startTime),
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .where(and(...sessionConditions, isNull(items.deletedAt)))
    .groupBy(items.libraryId);

  // Query 4: Get last played item per library using a subquery approach
  const lastPlayedItems = await db
    .selectDistinctOn([items.libraryId], {
      libraryId: items.libraryId,
      itemId: sessions.itemId,
      itemName: sessions.itemName,
      userId: sessions.userId,
      userName: sessions.userName,
      startTime: sessions.startTime,
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .where(and(...sessionConditions, isNull(items.deletedAt)))
    .orderBy(items.libraryId, desc(sessions.startTime));

  // Create maps for efficient lookup
  const itemStatsMap = new Map<
    string,
    { counts: Record<string, number>; runtime: number }
  >();
  for (const stat of itemStats) {
    if (!stat.libraryId) continue;
    const existing = itemStatsMap.get(stat.libraryId) || {
      counts: {},
      runtime: 0,
    };
    existing.counts[stat.type] = stat.count;
    existing.runtime += Number(stat.totalRuntime || 0);
    itemStatsMap.set(stat.libraryId, existing);
  }

  const sizeStatsMap = new Map<string, number>();
  for (const stat of sizeStats) {
    if (!stat.libraryId) continue;
    sizeStatsMap.set(stat.libraryId, Number(stat.totalSize || 0));
  }

  const sessionStatsMap = new Map<
    string,
    { plays: number; playback: number; lastActivity: Date | null }
  >();
  for (const stat of sessionStats) {
    if (!stat.libraryId) continue;
    sessionStatsMap.set(stat.libraryId, {
      plays: stat.totalPlays,
      playback: Number(stat.totalPlayback || 0),
      lastActivity: stat.lastActivity,
    });
  }

  const lastPlayedMap = new Map<
    string,
    {
      itemId: string | null;
      itemName: string | null;
      userId: string | null;
      userName: string | null;
    }
  >();
  for (const item of lastPlayedItems) {
    if (!item.libraryId) continue;
    lastPlayedMap.set(item.libraryId, {
      itemId: item.itemId,
      itemName: item.itemName,
      userId: item.userId,
      userName: item.userName,
    });
  }

  // Combine all data into per-library statistics
  const result: PerLibraryStatistics[] = serverLibraries.map((library) => {
    const itemData = itemStatsMap.get(library.id) || { counts: {}, runtime: 0 };
    const sizeData = sizeStatsMap.get(library.id) || 0;
    const sessionData = sessionStatsMap.get(library.id) || {
      plays: 0,
      playback: 0,
      lastActivity: null,
    };
    const lastPlayed = lastPlayedMap.get(library.id) || {
      itemId: null,
      itemName: null,
      userId: null,
      userName: null,
    };

    const counts = itemData.counts;
    const totalFiles = Object.values(counts).reduce((sum, c) => sum + c, 0);

    return {
      libraryId: library.id,
      libraryName: library.name,
      libraryType: library.type,

      totalFiles,
      moviesCount: counts.Movie || 0,
      seriesCount: counts.Series || 0,
      seasonsCount: counts.Season || 0,
      episodesCount: counts.Episode || 0,

      totalSizeBytes: sizeData,
      totalRuntimeTicks: itemData.runtime,

      totalPlays: sessionData.plays,
      totalPlaybackSeconds: sessionData.playback,

      lastPlayedItemId: lastPlayed.itemId,
      lastPlayedItemName: lastPlayed.itemName,
      lastPlayedByUserId: lastPlayed.userId,
      lastPlayedByUserName: lastPlayed.userName,
      lastActivityTime: sessionData.lastActivity,
    };
  });

  return result;
};
