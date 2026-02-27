import "server-only";
import {
  db,
  type Item,
  items,
  type Session,
  sessions,
  type User,
  users,
} from "@streamystats/database";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  type SQL,
  sql,
  sum,
} from "drizzle-orm";
import { getStatisticsExclusions } from "./exclusions";

export interface ItemStats {
  totalViews: number;
  totalWatchTime: number;
  completionRate: number;
  firstWatched: string | null;
  lastWatched: string | null;
  usersWatched: ItemUserStats[];
  watchHistory: ItemWatchHistory[];
  watchCountByMonth: ItemWatchCountByMonth[];
}

export interface ItemUserStats {
  user: User;
  watchCount: number;
  totalWatchTime: number;
  completionRate: number;
  firstWatched: string | null;
  lastWatched: string | null;
}

export interface ItemWatchHistory {
  session: Session;
  user: User | null;
  watchDate: string;
  watchDuration: number;
  completionPercentage: number;
  playMethod: string | null;
  deviceName: string | null;
  clientName: string | null;
}

export interface ItemWatchCountByMonth {
  month: number;
  year: number;
  watchCount: number;
  uniqueUsers: number;
  totalWatchTime: number;
}

export interface SeriesEpisodeStats {
  totalSeasons: number;
  totalEpisodes: number;
  watchedEpisodes: number;
  watchedSeasons: number;
}

export interface ItemDetailsResponse {
  item: Item;
  totalViews: number;
  totalWatchTime: number;
  completionRate: number;
  firstWatched: string | null;
  lastWatched: string | null;
  usersWatched: ItemUserStats[];
  watchHistory: ItemWatchHistory[];
  watchCountByMonth: ItemWatchCountByMonth[];
  episodeStats?: SeriesEpisodeStats; // Optional, only for Series
}

/**
 * Get comprehensive item details with statistics
 */
export const getItemDetails = async ({
  itemId,
  userId,
}: {
  itemId: string;
  userId?: string;
}): Promise<ItemDetailsResponse | null> => {
  // Get the item first
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });

  if (!item) {
    return null;
  }

  // Get basic stats
  const totalStats = await getItemTotalStats({ itemId, userId });
  const watchDates = await getItemWatchDates({ itemId, userId });
  const completionRate = await getItemCompletionRate({
    itemId,
    userId,
  });
  const usersWatched = await getItemUserStats({
    itemId,
    userId,
  });
  const watchHistory = await getItemWatchHistory({
    itemId,
    userId,
  });
  const watchCountByMonth = await getItemWatchCountByMonth({
    itemId,
    userId,
  });

  // Get episode stats if this is a series
  let episodeStats: SeriesEpisodeStats | undefined;
  if (item.type === "Series") {
    episodeStats = await getSeriesEpisodeStats({ itemId, userId });
  }

  return {
    item,
    totalViews: totalStats.total_views,
    totalWatchTime: totalStats.total_watch_time,
    completionRate: Math.round(completionRate * 10) / 10, // Round to 1 decimal place
    firstWatched: watchDates.first_watched,
    lastWatched: watchDates.last_watched,
    usersWatched: usersWatched,
    watchHistory: watchHistory,
    watchCountByMonth: watchCountByMonth,
    episodeStats: episodeStats,
  };
};

/**
 * Get all episode IDs for a TV show
 */
export const getEpisodeIdsForSeries = async ({
  seriesId,
}: {
  seriesId: string;
}): Promise<string[]> => {
  const episodes = await db
    .select({
      id: items.id,
    })
    .from(items)
    .where(and(eq(items.type, "Episode"), eq(items.seriesId, seriesId)));

  return episodes.map((episode) => episode.id);
};

/**
 * Get total views and watch time for an item
 * If userId is provided, scoped to that user only
 * If userId is not provided, shows global data (for all users)
 */
export const getItemTotalStats = async ({
  itemId,
  userId,
}: {
  itemId: string;
  userId?: string;
}): Promise<{ total_views: number; total_watch_time: number }> => {
  // Get the item to check if it's a TV show
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });

  if (!item) {
    return { total_views: 0, total_watch_time: 0 };
  }

  let itemIdsToQuery: string[] = [itemId];

  // If it's a TV show, get all episode IDs
  if (item.type === "Series") {
    itemIdsToQuery = await getEpisodeIdsForSeries({
      seriesId: itemId,
    });
    if (itemIdsToQuery.length === 0) {
      return { total_views: 0, total_watch_time: 0 };
    }
  }

  // Build the where condition based on whether userId is provided
  const whereCondition = userId
    ? and(
        inArray(sessions.itemId, itemIdsToQuery),
        eq(sessions.userId, userId),
        isNotNull(sessions.playDuration),
      )
    : and(
        inArray(sessions.itemId, itemIdsToQuery),
        isNotNull(sessions.playDuration),
      );

  const result = await db
    .select({
      total_views: count(sessions.id),
      total_watch_time: sum(sessions.playDuration),
    })
    .from(sessions)
    .where(whereCondition);

  return {
    total_views: result[0]?.total_views || 0,
    total_watch_time: Number(result[0]?.total_watch_time || 0),
  };
};

/**
 * Get first and last watched dates for an item
 * If userId is provided, scoped to that user only
 * If userId is not provided, shows global data (for all users)
 */
export const getItemWatchDates = async ({
  itemId,
  userId,
}: {
  itemId: string;
  userId?: string;
}): Promise<{ first_watched: string | null; last_watched: string | null }> => {
  // Get the item to check if it's a TV show
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });

  if (!item) {
    return { first_watched: null, last_watched: null };
  }

  let itemIdsToQuery: string[] = [itemId];

  // If it's a TV show, get all episode IDs
  if (item.type === "Series") {
    itemIdsToQuery = await getEpisodeIdsForSeries({
      seriesId: itemId,
    });
    if (itemIdsToQuery.length === 0) {
      return { first_watched: null, last_watched: null };
    }
  }

  // Build the where condition based on whether userId is provided
  const whereCondition = userId
    ? and(
        inArray(sessions.itemId, itemIdsToQuery),
        eq(sessions.userId, userId),
        isNotNull(sessions.startTime),
      )
    : and(
        inArray(sessions.itemId, itemIdsToQuery),
        isNotNull(sessions.startTime),
      );

  const result = await db
    .select({
      first_watched: sql<string>`TO_CHAR(MIN(${sessions.startTime}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      last_watched: sql<string>`TO_CHAR(MAX(${sessions.startTime}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    })
    .from(sessions)
    .where(whereCondition);

  return {
    first_watched: result[0]?.first_watched || null,
    last_watched: result[0]?.last_watched || null,
  };
};

/**
 * Get completion rate for an item
 * If userId is provided, scoped to that user only
 * If userId is not provided, shows global data (for all users)
 */
export const getItemCompletionRate = async ({
  itemId,
  userId,
}: {
  itemId: string;
  userId?: string;
}): Promise<number> => {
  // Get the item to check if it's a TV show
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });

  if (!item) {
    return 0;
  }

  let itemIdsToQuery: string[] = [itemId];

  // If it's a TV show, get all episode IDs
  if (item.type === "Series") {
    itemIdsToQuery = await getEpisodeIdsForSeries({
      seriesId: itemId,
    });
    if (itemIdsToQuery.length === 0) {
      return 0;
    }
  }

  // Build the where condition based on whether userId is provided
  const whereCondition = userId
    ? and(
        inArray(sessions.itemId, itemIdsToQuery),
        eq(sessions.userId, userId),
        isNotNull(sessions.percentComplete),
      )
    : and(
        inArray(sessions.itemId, itemIdsToQuery),
        isNotNull(sessions.percentComplete),
      );

  const result = await db
    .select({
      avg_completion: sql<number>`AVG(${sessions.percentComplete})`,
    })
    .from(sessions)
    .where(whereCondition);

  return Number(result[0]?.avg_completion || 0);
};

/**
 * Get user statistics for an item
 * If userId is provided, shows only that user's stats
 * If userId is not provided, shows all users' stats
 */
export const getItemUserStats = async ({
  itemId,
  userId,
  serverId,
}: {
  itemId: string;
  userId?: string;
  serverId?: number;
}): Promise<ItemUserStats[]> => {
  // Get the item to check if it's a TV show
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });

  if (!item) {
    return [];
  }

  // Get exclusion settings if serverId provided
  const exclusions = serverId
    ? await getStatisticsExclusions(serverId)
    : { userExclusion: undefined };

  let itemIdsToQuery: string[] = [itemId];

  // If it's a TV show, get all episode IDs
  if (item.type === "Series") {
    itemIdsToQuery = await getEpisodeIdsForSeries({
      seriesId: itemId,
    });
    if (itemIdsToQuery.length === 0) {
      return [];
    }
  }

  // Build where conditions
  const whereConditions: SQL[] = [
    inArray(sessions.itemId, itemIdsToQuery),
    isNotNull(sessions.userId),
  ];

  if (userId) {
    whereConditions.push(eq(sessions.userId, userId));
  }

  // Add user exclusion filter
  if (exclusions.userExclusion) {
    whereConditions.push(exclusions.userExclusion);
  }

  const userStats = await db
    .select({
      userId: sessions.userId,
      userName: users.name,
      userServerId: users.serverId,
      userCreatedAt: users.createdAt,
      userUpdatedAt: users.updatedAt,
      watch_count: count(sessions.id),
      total_watch_time: sum(sessions.playDuration),
      completion_rate: sql<number>`AVG(${sessions.percentComplete})`,
      first_watched: sql<string>`TO_CHAR(MIN(${sessions.startTime}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      last_watched: sql<string>`TO_CHAR(MAX(${sessions.startTime}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    })
    .from(sessions)
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(and(...whereConditions))
    .groupBy(
      sessions.userId,
      users.name,
      users.serverId,
      users.createdAt,
      users.updatedAt,
    )
    .orderBy(desc(count(sessions.id)));

  // Map to expected format and handle missing users gracefully
  const result = userStats.map((stat) => {
    // Create a user object - use actual user data if available, otherwise create a fallback
    const user = stat.userName
      ? {
          id: stat.userId!,
          name: stat.userName,
          serverId: stat.userServerId!,
          lastLoginDate: null,
          lastActivityDate: null,
          hasPassword: false,
          hasConfiguredPassword: false,
          hasConfiguredEasyPassword: false,
          enableAutoLogin: false,
          isAdministrator: false,
          isHidden: false,
          isDisabled: false,
          enableUserPreferenceAccess: true,
          enableRemoteControlOfOtherUsers: false,
          enableSharedDeviceControl: false,
          enableRemoteAccess: true,
          enableLiveTvManagement: false,
          enableLiveTvAccess: true,
          enableMediaPlayback: true,
          enableAudioPlaybackTranscoding: true,
          enableVideoPlaybackTranscoding: true,
          enablePlaybackRemuxing: true,
          enableContentDeletion: false,
          enableContentDownloading: false,
          enableSyncTranscoding: true,
          enableMediaConversion: false,
          enableAllDevices: true,
          enableAllChannels: true,
          enableAllFolders: true,
          enablePublicSharing: false,
          invalidLoginAttemptCount: 0,
          loginAttemptsBeforeLockout: 3,
          maxActiveSessions: 0,
          remoteClientBitrateLimit: 0,
          authenticationProviderId:
            "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
          passwordResetProviderId:
            "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
          syncPlayAccess: "CreateAndJoinGroups",
          searchVector: null,
          inferWatchtimeOnMarkWatched: null,
          createdAt: stat.userCreatedAt || new Date(),
          updatedAt: stat.userUpdatedAt || new Date(),
        }
      : {
          id: stat.userId!,
          name: "Unknown User",
          serverId: 0,
          lastLoginDate: null,
          lastActivityDate: null,
          hasPassword: false,
          hasConfiguredPassword: false,
          hasConfiguredEasyPassword: false,
          enableAutoLogin: false,
          isAdministrator: false,
          isHidden: false,
          isDisabled: false,
          enableUserPreferenceAccess: true,
          enableRemoteControlOfOtherUsers: false,
          enableSharedDeviceControl: false,
          enableRemoteAccess: true,
          enableLiveTvManagement: false,
          enableLiveTvAccess: true,
          enableMediaPlayback: true,
          enableAudioPlaybackTranscoding: true,
          enableVideoPlaybackTranscoding: true,
          enablePlaybackRemuxing: true,
          enableContentDeletion: false,
          enableContentDownloading: false,
          enableSyncTranscoding: true,
          enableMediaConversion: false,
          enableAllDevices: true,
          enableAllChannels: true,
          enableAllFolders: true,
          enablePublicSharing: false,
          invalidLoginAttemptCount: 0,
          loginAttemptsBeforeLockout: 3,
          maxActiveSessions: 0,
          remoteClientBitrateLimit: 0,
          authenticationProviderId:
            "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
          passwordResetProviderId:
            "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
          syncPlayAccess: "CreateAndJoinGroups",
          searchVector: null,
          inferWatchtimeOnMarkWatched: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

    return {
      user: user,
      watchCount: stat.watch_count,
      totalWatchTime: Number(stat.total_watch_time || 0),
      completionRate: Math.round((Number(stat.completion_rate) || 0) * 10) / 10,
      firstWatched: stat.first_watched,
      lastWatched: stat.last_watched,
    };
  });

  return result; // No longer filtering out items - handle all users including unknown ones
};

/**
 * Get watch history for an item
 * If userId is provided, shows only that user's history
 * If userId is not provided, shows all users' history
 */
export const getItemWatchHistory = async ({
  itemId,
  userId,
  limit = 50,
}: {
  itemId: string;
  userId?: string;
  limit?: number;
}): Promise<ItemWatchHistory[]> => {
  // Get the item to check if it's a TV show
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });

  if (!item) {
    return [];
  }

  let itemIdsToQuery: string[] = [itemId];

  // If it's a TV show, get all episode IDs
  if (item.type === "Series") {
    itemIdsToQuery = await getEpisodeIdsForSeries({
      seriesId: itemId,
    });
    if (itemIdsToQuery.length === 0) {
      return [];
    }
  }

  // Build where condition based on whether userId is provided
  const whereCondition = userId
    ? and(
        inArray(sessions.itemId, itemIdsToQuery),
        eq(sessions.userId, userId),
        isNotNull(sessions.startTime),
      )
    : and(
        inArray(sessions.itemId, itemIdsToQuery),
        isNotNull(sessions.startTime),
      );

  const sessionData = await db
    .select()
    .from(sessions)
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(whereCondition)
    .orderBy(desc(sessions.startTime))
    .limit(limit);

  return sessionData.map((row) => ({
    session: row.sessions,
    user: row.users,
    watchDate: row.sessions
      .startTime!.toISOString()
      .replace(/\.(\d{3})Z$/, (_match, ms) => `.${ms}000Z`),
    watchDuration: row.sessions.playDuration || 0,
    completionPercentage: row.sessions.percentComplete || 0,
    playMethod: row.sessions.playMethod,
    deviceName: row.sessions.deviceName,
    clientName: row.sessions.clientName,
  }));
};

/**
 * Get watch count by month for an item
 * If userId is provided, scoped to that user only
 * If userId is not provided, fetch all data (global)
 */
export const getItemWatchCountByMonth = async ({
  itemId,
  userId,
}: {
  itemId: string;
  userId?: string;
}): Promise<ItemWatchCountByMonth[]> => {
  // Get the item to check if it's a TV show
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });

  if (!item) {
    return [];
  }

  let itemIdsToQuery: string[] = [itemId];

  // If it's a TV show, get all episode IDs
  if (item.type === "Series") {
    itemIdsToQuery = await getEpisodeIdsForSeries({
      seriesId: itemId,
    });
    if (itemIdsToQuery.length === 0) {
      return [];
    }
  }

  // Build the where condition: if userId is provided, filter by user; otherwise, return all users' data
  const whereCondition = userId
    ? and(
        inArray(sessions.itemId, itemIdsToQuery),
        eq(sessions.userId, userId),
        isNotNull(sessions.startTime),
      )
    : and(
        inArray(sessions.itemId, itemIdsToQuery),
        isNotNull(sessions.startTime),
      );

  const result = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${sessions.startTime})`,
      year: sql<number>`EXTRACT(YEAR FROM ${sessions.startTime})`,
      watch_count: count(sessions.id),
      unique_users: sql<number>`COUNT(DISTINCT ${sessions.userId})`,
      total_watch_time: sum(sessions.playDuration),
    })
    .from(sessions)
    .where(whereCondition)
    .groupBy(
      sql`EXTRACT(MONTH FROM ${sessions.startTime})`,
      sql`EXTRACT(YEAR FROM ${sessions.startTime})`,
    )
    .orderBy(
      sql`EXTRACT(YEAR FROM ${sessions.startTime})`,
      sql`EXTRACT(MONTH FROM ${sessions.startTime})`,
    );

  return result.map((row) => ({
    month: row.month,
    year: row.year,
    watchCount: row.watch_count,
    uniqueUsers: row.unique_users,
    totalWatchTime: Number(row.total_watch_time || 0),
  }));
};

/**
 * Get season and episode statistics for a series
 * If userId is provided, scoped to that user only
 * If userId is not provided, shows global data (for all users)
 */
export const getSeriesEpisodeStats = async ({
  itemId,
  userId,
}: {
  itemId: string;
  userId?: string;
}): Promise<SeriesEpisodeStats> => {
  // Get all episodes for this series
  const allEpisodes = await db
    .select({
      id: items.id,
      seasonNumber: items.parentIndexNumber,
      episodeNumber: items.indexNumber,
    })
    .from(items)
    .where(
      and(
        eq(items.type, "Episode"),
        eq(items.seriesId, itemId),
        isNotNull(items.parentIndexNumber),
        isNotNull(items.indexNumber),
      ),
    );

  const totalEpisodes = allEpisodes.length;
  const seasons = new Set(
    allEpisodes.map((ep) => ep.seasonNumber).filter(Boolean),
  );
  const totalSeasons = seasons.size;

  if (totalEpisodes === 0) {
    return {
      totalSeasons: totalSeasons,
      totalEpisodes: totalEpisodes,
      watchedEpisodes: 0,
      watchedSeasons: 0,
    };
  }

  // Get watched episodes for this series
  const episodeIds = allEpisodes.map((ep) => ep.id);

  const whereCondition = userId
    ? and(
        inArray(sessions.itemId, episodeIds),
        eq(sessions.userId, userId),
        isNotNull(sessions.playDuration),
      )
    : and(
        inArray(sessions.itemId, episodeIds),
        isNotNull(sessions.playDuration),
      );

  const watchedEpisodeIds = await db
    .selectDistinct({
      itemId: sessions.itemId,
    })
    .from(sessions)
    .where(whereCondition);

  const watchedEpisodeSet = new Set(
    watchedEpisodeIds.map((w) => w.itemId).filter(Boolean),
  );
  const watchedEpisodes = watchedEpisodeSet.size;

  // Calculate watched seasons (seasons with at least one watched episode)
  const watchedSeasonNumbers = new Set();
  for (const episode of allEpisodes) {
    if (watchedEpisodeSet.has(episode.id) && episode.seasonNumber !== null) {
      watchedSeasonNumbers.add(episode.seasonNumber);
    }
  }
  const watchedSeasons = watchedSeasonNumbers.size;

  return {
    totalSeasons: totalSeasons,
    totalEpisodes: totalEpisodes,
    watchedEpisodes: watchedEpisodes,
    watchedSeasons: watchedSeasons,
  };
};

export interface SeasonEpisode {
  seasonNumber: number;
  episodes: Item[];
}

/**
 * Get all seasons and episodes for a series, grouped by season
 */
export const getSeasonsAndEpisodes = async ({
  seriesId,
}: {
  seriesId: string;
}): Promise<SeasonEpisode[]> => {
  const allEpisodes = await db
    .select()
    .from(items)
    .where(
      and(
        eq(items.type, "Episode"),
        eq(items.seriesId, seriesId),
        isNotNull(items.parentIndexNumber),
        isNotNull(items.indexNumber),
      ),
    )
    .orderBy(asc(items.parentIndexNumber), asc(items.indexNumber));

  const seasonMap = new Map<number, Item[]>();

  for (const episode of allEpisodes) {
    const seasonNum = episode.parentIndexNumber!;
    if (!seasonMap.has(seasonNum)) {
      seasonMap.set(seasonNum, []);
    }
    seasonMap.get(seasonNum)!.push(episode);
  }

  const seasons: SeasonEpisode[] = Array.from(seasonMap.entries())
    .map(([seasonNumber, episodes]) => ({
      seasonNumber,
      episodes,
    }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);

  return seasons;
};

export interface SeasonProgress {
  seasonNumber: number;
  totalEpisodes: number;
  watchedEpisodes: number;
  episodes: Array<{
    episodeNumber: number;
    watched: boolean;
    episodeId: string;
    name: string | null;
  }>;
}

export interface AlmostDoneSeries {
  series: Item;
  totalEpisodes: number;
  watchedEpisodes: number;
  percentComplete: number;
  seasons: SeasonProgress[];
}

/**
 * Get series that the user has almost finished watching (between minPercent and maxPercent)
 * Default is 50-99% complete
 */
export const getAlmostDoneSeries = async ({
  serverId,
  userId,
  minPercent = 50,
  maxPercent = 99,
  limit = 10,
}: {
  serverId: number | string;
  userId: string;
  minPercent?: number;
  maxPercent?: number;
  limit?: number;
}): Promise<AlmostDoneSeries[]> => {
  const serverIdNum = Number(serverId);

  const { itemLibraryExclusion } = await getStatisticsExclusions(serverIdNum);

  // Step 1: Get all series that the user has watched at least one episode of
  const watchedSeriesQuery = await db
    .selectDistinct({
      seriesId: items.seriesId,
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .where(
      and(
        eq(sessions.serverId, serverIdNum),
        eq(sessions.userId, userId),
        eq(items.type, "Episode"),
        isNotNull(items.seriesId),
        isNotNull(sessions.playDuration),
        ...(itemLibraryExclusion ? [itemLibraryExclusion] : []),
      ),
    );

  const watchedSeriesIds = watchedSeriesQuery
    .map((row) => row.seriesId)
    .filter((id): id is string => id !== null);

  if (watchedSeriesIds.length === 0) {
    return [];
  }

  // Step 2: Get all episodes for these series
  const allEpisodesForSeries = await db
    .select({
      id: items.id,
      seriesId: items.seriesId,
      parentIndexNumber: items.parentIndexNumber,
      indexNumber: items.indexNumber,
      name: items.name,
    })
    .from(items)
    .where(
      and(
        eq(items.type, "Episode"),
        inArray(items.seriesId, watchedSeriesIds),
        isNotNull(items.parentIndexNumber),
        isNotNull(items.indexNumber),
        ...(itemLibraryExclusion ? [itemLibraryExclusion] : []),
      ),
    );

  // Step 3: Get all watched episode IDs for this user
  const episodeIds = allEpisodesForSeries.map((ep) => ep.id);
  if (episodeIds.length === 0) {
    return [];
  }

  const watchedEpisodesQuery = await db
    .selectDistinct({
      itemId: sessions.itemId,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.serverId, serverIdNum),
        eq(sessions.userId, userId),
        inArray(sessions.itemId, episodeIds),
        isNotNull(sessions.playDuration),
      ),
    );

  const watchedEpisodeIds = new Set(
    watchedEpisodesQuery
      .map((row) => row.itemId)
      .filter((id): id is string => id !== null),
  );

  // Step 4: Group episodes by series and calculate progress
  const seriesEpisodeMap = new Map<
    string,
    Array<{
      id: string;
      seasonNumber: number;
      episodeNumber: number;
      name: string | null;
    }>
  >();

  for (const episode of allEpisodesForSeries) {
    if (
      episode.seriesId === null ||
      episode.parentIndexNumber === null ||
      episode.indexNumber === null
    ) {
      continue;
    }

    if (!seriesEpisodeMap.has(episode.seriesId)) {
      seriesEpisodeMap.set(episode.seriesId, []);
    }
    seriesEpisodeMap.get(episode.seriesId)?.push({
      id: episode.id,
      seasonNumber: episode.parentIndexNumber,
      episodeNumber: episode.indexNumber,
      name: episode.name,
    });
  }

  // Step 5: Calculate completion percentage for each series
  const seriesProgress: Array<{
    seriesId: string;
    totalEpisodes: number;
    watchedEpisodes: number;
    percentComplete: number;
    episodes: Array<{
      id: string;
      seasonNumber: number;
      episodeNumber: number;
      name: string | null;
      watched: boolean;
    }>;
  }> = [];

  for (const [seriesId, episodes] of seriesEpisodeMap) {
    const totalEpisodes = episodes.length;
    const episodesWithWatchStatus = episodes.map((ep) => ({
      ...ep,
      watched: watchedEpisodeIds.has(ep.id),
    }));
    const watchedCount = episodesWithWatchStatus.filter(
      (ep) => ep.watched,
    ).length;
    const percentComplete =
      totalEpisodes > 0 ? (watchedCount / totalEpisodes) * 100 : 0;

    if (percentComplete >= minPercent && percentComplete <= maxPercent) {
      seriesProgress.push({
        seriesId,
        totalEpisodes,
        watchedEpisodes: watchedCount,
        percentComplete,
        episodes: episodesWithWatchStatus,
      });
    }
  }

  // Step 6: Sort by percent complete descending (closest to done first)
  seriesProgress.sort((a, b) => b.percentComplete - a.percentComplete);

  // Step 7: Limit results
  const limitedProgress = seriesProgress.slice(0, limit);

  if (limitedProgress.length === 0) {
    return [];
  }

  // Step 8: Fetch series metadata
  const seriesIdsToFetch = limitedProgress.map((p) => p.seriesId);
  const seriesItems = await db
    .select()
    .from(items)
    .where(and(eq(items.type, "Series"), inArray(items.id, seriesIdsToFetch)));

  const seriesMap = new Map<string, Item>();
  for (const series of seriesItems) {
    seriesMap.set(series.id, series);
  }

  // Step 9: Build final result with season breakdown
  const result: AlmostDoneSeries[] = [];

  for (const progress of limitedProgress) {
    const series = seriesMap.get(progress.seriesId);
    if (!series) {
      continue;
    }

    // Group episodes by season
    const seasonMap = new Map<
      number,
      Array<{
        episodeNumber: number;
        watched: boolean;
        episodeId: string;
        name: string | null;
      }>
    >();

    for (const ep of progress.episodes) {
      if (!seasonMap.has(ep.seasonNumber)) {
        seasonMap.set(ep.seasonNumber, []);
      }
      seasonMap.get(ep.seasonNumber)?.push({
        episodeNumber: ep.episodeNumber,
        watched: ep.watched,
        episodeId: ep.id,
        name: ep.name,
      });
    }

    const seasons: SeasonProgress[] = Array.from(seasonMap.entries())
      .map(([seasonNumber, episodes]) => ({
        seasonNumber,
        totalEpisodes: episodes.length,
        watchedEpisodes: episodes.filter((ep) => ep.watched).length,
        episodes: episodes.sort((a, b) => a.episodeNumber - b.episodeNumber),
      }))
      .sort((a, b) => a.seasonNumber - b.seasonNumber);

    result.push({
      series,
      totalEpisodes: progress.totalEpisodes,
      watchedEpisodes: progress.watchedEpisodes,
      percentComplete: Math.round(progress.percentComplete * 10) / 10,
      seasons,
    });
  }

  return result;
};
