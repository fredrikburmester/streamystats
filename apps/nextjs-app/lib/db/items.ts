import "server-only";
import {
  db,
  sessions,
  items,
  users,
  Item,
  Session,
  User,
} from "@streamystats/database";
import {
  and,
  eq,
  desc,
  count,
  sum,
  sql,
  isNotNull,
  gte,
  lte,
  asc,
  inArray,
} from "drizzle-orm";

export interface ItemStats {
  totalViews: number;
  totalWatchTime: number;
  completionRate: number;
  firstWatched: Date | null;
  lastWatched: Date | null;
  usersWatched: ItemUserStats[];
  watchHistory: ItemWatchHistory[];
  watchCountByMonth: ItemWatchCountByMonth[];
}

export interface ItemUserStats {
  user: User;
  watchCount: number;
  totalWatchTime: number;
  completionRate: number;
  firstWatched: Date | null;
  lastWatched: Date | null;
}

export interface ItemWatchHistory {
  session: Session;
  user: User | null;
  watchDate: Date;
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
  firstWatched: Date | null;
  lastWatched: Date | null;
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
        isNotNull(sessions.playDuration)
      )
    : and(
        inArray(sessions.itemId, itemIdsToQuery),
        isNotNull(sessions.playDuration)
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
}): Promise<{ first_watched: Date | null; last_watched: Date | null }> => {
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
        isNotNull(sessions.startTime)
      )
    : and(
        inArray(sessions.itemId, itemIdsToQuery),
        isNotNull(sessions.startTime)
      );

  const result = await db
    .select({
      first_watched: sql<Date>`MIN(${sessions.startTime})`,
      last_watched: sql<Date>`MAX(${sessions.startTime})`,
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
        isNotNull(sessions.percentComplete)
      )
    : and(
        inArray(sessions.itemId, itemIdsToQuery),
        isNotNull(sessions.percentComplete)
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
}: {
  itemId: string;
  userId?: string;
}): Promise<ItemUserStats[]> => {
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
        isNotNull(sessions.userId)
      )
    : and(inArray(sessions.itemId, itemIdsToQuery), isNotNull(sessions.userId));

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
      first_watched: sql<Date>`MIN(${sessions.startTime})`,
      last_watched: sql<Date>`MAX(${sessions.startTime})`,
    })
    .from(sessions)
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(whereCondition)
    .groupBy(
      sessions.userId,
      users.name,
      users.serverId,
      users.createdAt,
      users.updatedAt
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
        isNotNull(sessions.startTime)
      )
    : and(
        inArray(sessions.itemId, itemIdsToQuery),
        isNotNull(sessions.startTime)
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
    watchDate: row.sessions.startTime!,
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
        isNotNull(sessions.startTime)
      )
    : and(
        inArray(sessions.itemId, itemIdsToQuery),
        isNotNull(sessions.startTime)
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
      sql`EXTRACT(YEAR FROM ${sessions.startTime})`
    )
    .orderBy(
      sql`EXTRACT(YEAR FROM ${sessions.startTime})`,
      sql`EXTRACT(MONTH FROM ${sessions.startTime})`
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
        isNotNull(items.indexNumber)
      )
    );

  const totalEpisodes = allEpisodes.length;
  const seasons = new Set(
    allEpisodes.map((ep) => ep.seasonNumber).filter(Boolean)
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
        isNotNull(sessions.playDuration)
      )
    : and(
        inArray(sessions.itemId, episodeIds),
        isNotNull(sessions.playDuration)
      );

  const watchedEpisodeIds = await db
    .selectDistinct({
      itemId: sessions.itemId,
    })
    .from(sessions)
    .where(whereCondition);

  const watchedEpisodeSet = new Set(
    watchedEpisodeIds.map((w) => w.itemId).filter(Boolean)
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
