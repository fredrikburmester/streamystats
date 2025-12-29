import {
  db,
  type Item,
  items,
  libraries,
  sessions,
} from "@streamystats/database";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  type SQL,
  sql,
  sum,
} from "drizzle-orm";

import { getStatisticsExclusions } from "./exclusions";

interface ItemWithStats extends Item {
  totalPlayCount: number;
  totalPlayDuration: number;
}

interface MostWatchedItems {
  Movie: ItemWithStats[];
  Episode: ItemWithStats[];
  Series: ItemWithStats[];
}

export async function getMostWatchedItems({
  serverId,
  userId,
}: {
  serverId: string | number;
  userId?: string | number;
}): Promise<MostWatchedItems> {
  // Get exclusion settings
  const { userExclusion, itemLibraryExclusion } =
    await getStatisticsExclusions(serverId);

  // First get the aggregated session data for Movies and Episodes
  const whereConditions: SQL[] = [
    eq(sessions.serverId, Number(serverId)),
    isNotNull(sessions.itemId),
  ];

  // Add userId filter if provided
  if (userId !== undefined) {
    whereConditions.push(eq(sessions.userId, String(userId)));
  }

  // Add exclusion filters
  if (userExclusion) {
    whereConditions.push(userExclusion);
  }

  const rawSessionStats = await db
    .select({
      itemId: sessions.itemId,
      totalPlayCount: count(sessions.id).as("totalPlayCount"),
      totalPlayDuration: sum(sessions.playDuration).as("totalPlayDuration"),
    })
    .from(sessions)
    .where(and(...whereConditions))
    .groupBy(sessions.itemId)
    .orderBy(desc(sum(sessions.playDuration)));

  const sessionStats = rawSessionStats
    .map((stat) => ({
      itemId: stat.itemId || "",
      totalPlayCount: stat.totalPlayCount,
      totalPlayDuration: Number(stat.totalPlayDuration || 0),
    }))
    .filter((stat) => stat.itemId); // Filter out null itemIds

  // Batch fetch all items in a single query instead of N+1 queries
  // Also filter out items from excluded libraries
  const itemIds = sessionStats.map((stat) => stat.itemId);
  const itemConditions: SQL[] = [inArray(items.id, itemIds)];

  if (itemLibraryExclusion) {
    itemConditions.push(itemLibraryExclusion);
  }

  const itemsData =
    itemIds.length > 0
      ? await db
          .select()
          .from(items)
          .where(and(...itemConditions))
      : [];

  // Create a map for O(1) lookup
  const itemsMap = new Map(itemsData.map((item) => [item.id, item]));

  // Combine session stats with item data
  const itemsWithStats: ItemWithStats[] = sessionStats
    .map((stat) => {
      const item = itemsMap.get(stat.itemId);
      if (!item) return null;
      return {
        ...item,
        totalPlayCount: Number(stat.totalPlayCount),
        totalPlayDuration: Number(stat.totalPlayDuration || 0),
      };
    })
    .filter((item): item is ItemWithStats => item !== null);

  // Group by item type
  const grouped: MostWatchedItems = {
    Movie: [],
    Episode: [],
    Series: [],
  };

  // Collect episodes for series aggregation
  const episodesBySeriesId = new Map<string, ItemWithStats[]>();

  for (const item of itemsWithStats) {
    if (item.type === "Movie") {
      grouped.Movie.push(item);
    } else if (item.type === "Episode") {
      grouped.Episode.push(item);

      // Also collect episodes by seriesId for series aggregation
      if (item.seriesId) {
        if (!episodesBySeriesId.has(item.seriesId)) {
          episodesBySeriesId.set(item.seriesId, []);
        }
        episodesBySeriesId.get(item.seriesId)!.push(item);
      }
    }
  }

  // Aggregate series statistics from episodes
  const seriesStatsMap = new Map<
    string,
    { totalPlayCount: number; totalPlayDuration: number }
  >();

  for (const [seriesId, episodes] of episodesBySeriesId) {
    const totalPlayCount = episodes.reduce(
      (sum, ep) => sum + ep.totalPlayCount,
      0,
    );
    const totalPlayDuration = episodes.reduce(
      (sum, ep) => sum + ep.totalPlayDuration,
      0,
    );

    seriesStatsMap.set(seriesId, { totalPlayCount, totalPlayDuration });
  }

  // Get actual Series items for the watched series
  if (seriesStatsMap.size > 0) {
    const seriesIds = Array.from(seriesStatsMap.keys());
    const seriesItems = await db
      .select()
      .from(items)
      .where(
        and(
          inArray(items.id, seriesIds),
          eq(items.type, "Series"),
          eq(items.serverId, Number(serverId)),
        ),
      );

    for (const seriesItem of seriesItems) {
      const stats = seriesStatsMap.get(seriesItem.id);
      if (stats) {
        grouped.Series.push({
          ...seriesItem,
          totalPlayCount: stats.totalPlayCount,
          totalPlayDuration: stats.totalPlayDuration,
        });
      }
    }
  }

  // Sort each category by total play duration (descending) and limit to top items
  const limit = 10; // You can adjust this or make it a parameter
  grouped.Movie = grouped.Movie.sort(
    (a, b) => b.totalPlayDuration - a.totalPlayDuration,
  ).slice(0, limit);
  grouped.Episode = grouped.Episode.sort(
    (a, b) => b.totalPlayDuration - a.totalPlayDuration,
  ).slice(0, limit);
  grouped.Series = grouped.Series.sort(
    (a, b) => b.totalPlayDuration - a.totalPlayDuration,
  ).slice(0, limit);

  return grouped;
}

export interface WatchTimePerType {
  [key: string]: {
    type: string;
    totalWatchTime: number;
  };
}

export async function getWatchTimePerType({
  serverId,
  startDate,
  endDate,
  userId,
}: {
  serverId: string | number;
  startDate: string;
  endDate: string;
  userId?: string | number;
}): Promise<WatchTimePerType> {
  // Get exclusion settings
  const { userExclusion, itemLibraryExclusion } =
    await getStatisticsExclusions(serverId);

  const whereConditions: SQL[] = [
    eq(sessions.serverId, Number(serverId)),
    gte(sessions.startTime, new Date(startDate)),
    lte(sessions.startTime, new Date(endDate)),
    isNotNull(sessions.itemId),
  ];

  // Add userId condition if provided
  if (userId) {
    whereConditions.push(eq(sessions.userId, String(userId)));
  }

  // Add exclusion filters
  if (userExclusion) {
    whereConditions.push(userExclusion);
  }

  const rawResults = await db
    .select({
      date: sql<string>`DATE(${sessions.startTime})`.as("date"),
      itemId: sessions.itemId,
      totalWatchTime: sum(sessions.playDuration),
    })
    .from(sessions)
    .where(and(...whereConditions))
    .groupBy(sql`DATE(${sessions.startTime})`, sessions.itemId)
    .orderBy(sql`DATE(${sessions.startTime})`);

  const results = rawResults
    .map((result) => ({
      date: result.date,
      itemId: result.itemId || "",
      totalWatchTime: Number(result.totalWatchTime || 0),
    }))
    .filter((result) => result.itemId); // Filter out null itemIds

  // Now get the item types for each unique itemId
  // Also filter out items from excluded libraries
  const itemIds = [
    ...new Set(results.map((r) => r.itemId).filter((id) => id)),
  ] as string[];
  const itemTypeConditions: SQL[] = [inArray(items.id, itemIds)];
  if (itemLibraryExclusion) {
    itemTypeConditions.push(itemLibraryExclusion);
  }
  const itemTypes = (await db
    .select({
      id: items.id,
      type: items.type,
    })
    .from(items)
    .where(and(...itemTypeConditions))) as {
    id: string;
    type: string;
  }[];

  // Create a map of itemId to type
  const itemTypeMap = new Map(itemTypes.map((item) => [item.id, item.type]));

  // Group results by date and type
  const groupedResults = new Map<
    string,
    { date: string; type: string; totalWatchTime: number }
  >();

  for (const result of results) {
    if (!result.date || !result.itemId) continue;

    const type = itemTypeMap.get(result.itemId);
    if (!type) continue;

    const key = `${result.date}-${type}`;
    const existing = groupedResults.get(key);

    if (existing) {
      existing.totalWatchTime += Number(result.totalWatchTime || 0);
    } else {
      groupedResults.set(key, {
        date: result.date,
        type,
        totalWatchTime: Number(result.totalWatchTime || 0),
      });
    }
  }

  const statistics: WatchTimePerType = {};

  for (const [_key, result] of groupedResults) {
    if (result.date && result.type) {
      // Normalize type: map Episode to episode, Movie to movie, Audio to music, everything else to other
      let normalizedType: string;
      if (result.type === "Movie") {
        normalizedType = "movie";
      } else if (result.type === "Episode") {
        normalizedType = "episode";
      } else if (result.type === "Audio") {
        normalizedType = "music";
      } else {
        normalizedType = "other";
      }

      // Create composite key: date-type
      const compositeKey = `${result.date}-${normalizedType}`;

      statistics[compositeKey] = {
        type: normalizedType,
        totalWatchTime: result.totalWatchTime,
      };
    }
  }

  return statistics;
}

export interface LibraryWatchTime {
  [key: string]: {
    libraryId: string;
    libraryName: string;
    libraryType: string;
    totalWatchTime: number;
  };
}

export async function getWatchTimeByLibrary({
  serverId,
  startDate,
  endDate,
}: {
  serverId: string | number;
  startDate: string;
  endDate: string;
}): Promise<LibraryWatchTime> {
  // Get exclusion settings
  const { userExclusion, librariesTableExclusion } =
    await getStatisticsExclusions(serverId);

  const whereConditions: SQL[] = [
    eq(sessions.serverId, Number(serverId)),
    gte(sessions.startTime, new Date(startDate)),
    lte(sessions.startTime, new Date(endDate)),
    isNotNull(sessions.itemId),
  ];

  // Add exclusion filters
  if (userExclusion) {
    whereConditions.push(userExclusion);
  }
  if (librariesTableExclusion) {
    whereConditions.push(librariesTableExclusion);
  }

  const results = await db
    .select({
      date: sql<string>`DATE(${sessions.startTime})`.as("date"),
      libraryId: libraries.id,
      libraryName: libraries.name,
      libraryType: libraries.type,
      totalWatchTime: sum(sessions.playDuration),
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .innerJoin(libraries, eq(items.libraryId, libraries.id))
    .where(and(...whereConditions))
    .groupBy(
      sql`DATE(${sessions.startTime})`,
      libraries.id,
      libraries.name,
      libraries.type,
    )
    .orderBy(sql`DATE(${sessions.startTime})`, libraries.name);

  const statistics: LibraryWatchTime = {};

  for (const result of results) {
    if (result.date && result.libraryId) {
      // Create composite key: date-libraryId
      const key = `${result.date}-${result.libraryId}`;

      statistics[key] = {
        libraryId: result.libraryId,
        libraryName: result.libraryName,
        libraryType: result.libraryType,
        totalWatchTime: Number(result.totalWatchTime || 0),
      };
    }
  }

  return statistics;
}

export interface MostWatchedDay {
  date: string;
  watchTime: number;
}

export async function getMostWatchedDay({
  serverId,
  startDate,
  endDate,
  userId,
}: {
  serverId: string | number;
  startDate: string;
  endDate: string;
  userId?: string | number;
}): Promise<MostWatchedDay | null> {
  // Get exclusion settings
  const { userExclusion, itemLibraryExclusion } =
    await getStatisticsExclusions(serverId);

  const whereConditions: SQL[] = [
    eq(sessions.serverId, Number(serverId)),
    isNotNull(sessions.startTime),
    gte(sessions.startTime, new Date(startDate)),
    lte(sessions.startTime, new Date(endDate)),
  ];

  if (userId !== undefined) {
    whereConditions.push(eq(sessions.userId, String(userId)));
  }

  // Add exclusion filters
  if (userExclusion) {
    whereConditions.push(userExclusion);
  }
  if (itemLibraryExclusion) {
    whereConditions.push(itemLibraryExclusion);
  }

  // Join with items to filter by library
  const rows = await db
    .select({
      date: sql<string>`DATE(${sessions.startTime})`.as("date"),
      totalWatchTime: sum(sessions.playDuration).as("totalWatchTime"),
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .where(and(...whereConditions))
    .groupBy(sql`DATE(${sessions.startTime})`)
    .orderBy(desc(sum(sessions.playDuration)))
    .limit(1);

  const row = rows[0];
  if (!row?.date) return null;

  return {
    date: row.date,
    watchTime: Number(row.totalWatchTime || 0),
  };
}

export interface MostActiveUsersDay {
  date: string;
  activeUsers: number;
}

export async function getMostActiveUsersDay({
  serverId,
  startDate,
  endDate,
}: {
  serverId: string | number;
  startDate: string;
  endDate: string;
}): Promise<MostActiveUsersDay | null> {
  // Get exclusion settings
  const { userExclusion } = await getStatisticsExclusions(serverId);

  const whereConditions: SQL[] = [
    eq(sessions.serverId, Number(serverId)),
    isNotNull(sessions.startTime),
    isNotNull(sessions.userId),
    gte(sessions.startTime, new Date(startDate)),
    lte(sessions.startTime, new Date(endDate)),
  ];

  // Add exclusion filters
  if (userExclusion) {
    whereConditions.push(userExclusion);
  }

  const rows = await db
    .select({
      date: sql<string>`DATE(${sessions.startTime})`.as("date"),
      activeUsers: sql<number>`COUNT(DISTINCT ${sessions.userId})`.as(
        "activeUsers",
      ),
    })
    .from(sessions)
    .where(and(...whereConditions))
    .groupBy(sql`DATE(${sessions.startTime})`)
    .orderBy(desc(sql<number>`COUNT(DISTINCT ${sessions.userId})`))
    .limit(1);

  const row = rows[0];
  if (!row?.date) return null;

  return {
    date: row.date,
    activeUsers: Number(row.activeUsers || 0),
  };
}
