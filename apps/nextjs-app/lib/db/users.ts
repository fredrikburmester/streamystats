"use server";

import { db, User, users, sessions, items } from "@streamystats/database";
import { and, eq, sum, inArray, gte, lte, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getServer } from "./server";

interface JellyfinUser {
  Id: string;
  Name: string;
  // IsAdministrator: boolean;
  IsDisabled: boolean;
  Policy: {
    IsAdministrator: boolean;
  };
  // Add other fields as needed
}

export const getUser = async ({
  name,
  serverId
}: {
  name: string;
  serverId: string | number;
}): Promise<User | null> => {
  const user = await db.query.users.findFirst({
    where: and(eq(users.name, name), eq(users.serverId, Number(serverId))),
  });
  return user || null;
};

export const getUserById = async ({
  userId,
  serverId
}: {
  userId: string;
  serverId: string | number;
}): Promise<User | null> => {
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.serverId, Number(serverId))),
  });
  return user || null;
};

export const getUsers = async ({
  serverId
}: {
  serverId: string | number;
}): Promise<User[]> => {
  return await db.query.users.findMany({
    where: eq(users.serverId, Number(serverId)),
  });
};

export interface WatchTimePerWeekDay {
  day: string;
  watchTime: number;
}

export const getWatchTimePerWeekDay = async ({
  serverId,
  userId
}: {
  serverId: string | number;
  userId?: string | number;
}): Promise<WatchTimePerWeekDay[]> => {
  // Build the where condition based on whether userId is provided
  const whereCondition = userId
    ? and(
        eq(sessions.serverId, Number(serverId)),
        eq(sessions.userId, String(userId))
      )
    : eq(sessions.serverId, Number(serverId));

  const sessionData = await db
    .select({
      weekDay: sql<string>`TO_CHAR(${sessions.startTime}, 'Day')`.as("weekDay"),
      dayOfWeek: sql<number>`EXTRACT(DOW FROM ${sessions.startTime})`.as(
        "dayOfWeek"
      ),
      playDuration: sessions.playDuration,
    })
    .from(sessions)
    .where(whereCondition);

  // Group and sum manually
  const resultMap: Record<string, number> = {};
  for (const session of sessionData) {
    if (session.weekDay && session.playDuration) {
      const day = session.weekDay.trim();
      resultMap[day] = (resultMap[day] || 0) + session.playDuration;
    }
  }

  // Return ordered array (Monday-Sunday)
  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return daysOfWeek.map((day) => ({
    day,
    watchTime: resultMap[day] || 0,
  }));
};

export interface WatchTimePerHour {
  hour: number;
  watchTime: number;
}

export const getWatchTimePerHour = async ({
  serverId,
  userId
}: {
  serverId: string | number;
  userId?: string | number;
}): Promise<WatchTimePerHour[]> => {
  // Build the where condition based on whether userId is provided
  const whereCondition = userId
    ? and(
        eq(sessions.serverId, Number(serverId)),
        eq(sessions.userId, String(userId))
      )
    : eq(sessions.serverId, Number(serverId));

  // Get sessions with their hour information
  const sessionData = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${sessions.startTime})`.as("hour"),
      playDuration: sessions.playDuration,
    })
    .from(sessions)
    .where(whereCondition);

  // Group and sum manually
  const hourMap: Record<number, number> = {};
  for (const session of sessionData) {
    if (session.hour !== null && session.playDuration) {
      hourMap[session.hour] =
        (hourMap[session.hour] || 0) + session.playDuration;
    }
  }

  // Convert to array and sort by hour
  return Object.entries(hourMap)
    .map(([hour, watchTime]) => ({
      hour: Number(hour),
      watchTime: watchTime,
    }))
    .sort((a, b) => a.hour - b.hour);
};

export const getTotalWatchTime = async ({
  serverId,
  userId
}: {
  serverId: string | number;
  userId?: string | number;
}): Promise<number> => {
  // Build the where condition based on whether userId is provided
  const whereCondition = userId
    ? and(
        eq(sessions.serverId, Number(serverId)),
        eq(sessions.userId, String(userId))
      )
    : eq(sessions.serverId, Number(serverId));

  const result = await db
    .select({
      playDuration: sum(sessions.playDuration),
    })
    .from(sessions)
    .where(whereCondition);

  return Number(result[0]?.playDuration || 0);
};

interface UserWithWatchTime {
  [key: string]: number;
}

export const getTotalWatchTimeForUsers = async ({
  userIds
}: {
  userIds: string[] | number[];
}): Promise<UserWithWatchTime> => {
  if (userIds.length === 0) {
    return {};
  }

  const stringUserIds = userIds.map((id) => String(id));

  const results = await db
    .select({
      userId: sessions.userId,
      totalWatchTime: sum(sessions.playDuration),
    })
    .from(sessions)
    .where(inArray(sessions.userId, stringUserIds))
    .groupBy(sessions.userId);

  const watchTimeMap: UserWithWatchTime = {};

  for (const result of results) {
    if (result.userId) {
      watchTimeMap[result.userId] = Number(result.totalWatchTime || 0);
    }
  }

  // Ensure all requested users are included, even if they have no sessions
  for (const userId of stringUserIds) {
    if (!(userId in watchTimeMap)) {
      watchTimeMap[userId] = 0;
    }
  }

  return watchTimeMap;
};

export type UserActivityPerDay = Record<string, number>;

export const getUserActivityPerDay = async ({
  serverId,
  startDate,
  endDate
}: {
  serverId: string | number;
  startDate: string;
  endDate: string;
}): Promise<UserActivityPerDay> => {
  // Get sessions with date and user information
  const sessionData = await db
    .select({
      date: sql<string>`DATE(${sessions.startTime})`.as("date"),
      userId: sessions.userId,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.serverId, Number(serverId)),
        gte(sessions.startTime, new Date(startDate)),
        lte(sessions.startTime, new Date(endDate))
      )
    );

  // Group by date and count distinct users manually
  const activityMap: UserActivityPerDay = {};
  const dateUserSets: Record<string, Set<string>> = {};

  for (const session of sessionData) {
    if (session.date && session.userId) {
      if (!dateUserSets[session.date]) {
        dateUserSets[session.date] = new Set();
      }
      dateUserSets[session.date].add(session.userId);
    }
  }

  // Convert sets to counts
  for (const [date, userSet] of Object.entries(dateUserSets)) {
    activityMap[date] = userSet.size;
  }

  return activityMap;
};

export const logout = async (): Promise<void> => {
  (await cookies()).delete("streamystats-token");
  (await cookies()).delete("streamystats-user");
};

export const getMe = async (): Promise<User | null> => {
  const c = await cookies();
  const userStr = c.get("streamystats-user");
  const user = userStr?.value ? JSON.parse(userStr.value) : undefined;

  return user ? (user as User) : null;
};

export const isUserAdmin = async (): Promise<boolean> => {
  const me = await getMe();

  if (!me) {
    return false;
  }

  // Get the server configuration for this user
  const server = await getServer({ serverId: me.serverId });
  if (!server) {
    return false;
  }

  const c = await cookies();
  const token = c.get("streamystats-token");

  try {
    // Make a request to the Jellyfin server to get current user details
    const response = await fetch(`${server.url}/Users/Me`, {
      method: "GET",
      headers: {
        "X-Emby-Token": token?.value || "",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      // If the request fails, fall back to false for security
      return false;
    }

    const jellyfinUser: JellyfinUser = await response.json();

    // Verify the user ID matches what we expect
    if (jellyfinUser.Id !== me.id) {
      return false;
    }

    // Return the actual admin status from Jellyfin
    return jellyfinUser.Policy.IsAdministrator === true;
  } catch (error) {
    // If there's any error (network, timeout, etc.), return false for security
    console.error("Error checking admin status with Jellyfin server:", error);
    return false;
  }
};

// Server-level statistics functions for admin users

export interface UserStatsSummary {
  userId: string;
  userName: string;
  totalWatchTime: number;
  sessionCount: number;
}

export const getUserStatsSummaryForServer = async ({
  serverId
}: {
  serverId: string | number;
}): Promise<UserStatsSummary[]> => {
  const results = await db
    .select({
      userId: sessions.userId,
      userName: users.name,
      totalWatchTime: sum(sessions.playDuration),
      sessionCount: sql<number>`COUNT(${sessions.id})`.as("sessionCount"),
    })
    .from(sessions)
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.serverId, Number(serverId)))
    .groupBy(sessions.userId, users.name)
    .orderBy(sql`SUM(${sessions.playDuration}) DESC`);

  return results.map(
    (result: {
      userId: string | null;
      userName: string | null;
      totalWatchTime: string | null;
      sessionCount: number;
    }) => ({
      userId: result.userId || "",
      userName: result.userName || "Unknown",
      totalWatchTime: Number(result.totalWatchTime || 0),
      sessionCount: Number(result.sessionCount || 0),
    })
  );
};

export const getServerStatistics = async ({
  serverId
}: {
  serverId: string | number;
}) => {
  const [
    totalWatchTime,
    watchTimePerWeekDay,
    watchTimePerHour,
    userStatsSummary,
  ] = await Promise.all([
    getTotalWatchTime({ serverId }),
    getWatchTimePerWeekDay({ serverId }),
    getWatchTimePerHour({ serverId }),
    getUserStatsSummaryForServer({ serverId }),
  ]);

  return {
    totalWatchTime,
    watchTimePerWeekDay,
    watchTimePerHour,
    userStatsSummary,
    totalUsers: userStatsSummary.length,
    totalSessions: userStatsSummary.reduce(
      (sum, user) => sum + user.sessionCount,
      0
    ),
  };
};

export interface UserWatchStats {
  total_watch_time: number;
  total_plays: number;
  longest_streak: number;
}

export interface UserWithStats extends User {
  watch_stats: UserWatchStats;
  longest_streak: number;
}

export const getUserWatchStats = async ({
  serverId,
  userId
}: {
  serverId: string | number;
  userId: string;
}): Promise<UserWatchStats> => {
  if (!userId) {
    throw new Error("userId is required for getUserWatchStats");
  }

  const [totalWatchTime, userSessions] = await Promise.all([
    getTotalWatchTime({ serverId, userId }),
    db
      .select({
        playDuration: sessions.playDuration,
        startTime: sessions.startTime,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.serverId, Number(serverId))
        )
      )
      .orderBy(sessions.startTime),
  ]);

  // Calculate longest streak (consecutive days with activity)
  let longestStreak = 0;
  let currentStreak = 0;
  let lastDate: string | null = null;

  for (const session of userSessions) {
    if (session.startTime && session.playDuration && session.playDuration > 0) {
      const currentDate = session.startTime.toISOString().split("T")[0];

      if (lastDate) {
        const daysDiff = Math.floor(
          (new Date(currentDate).getTime() - new Date(lastDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (daysDiff === 1) {
          currentStreak++;
        } else if (daysDiff > 1) {
          longestStreak = Math.max(longestStreak, currentStreak);
          currentStreak = 1;
        }
        // If daysDiff === 0, we're still on the same day, don't change streak
      } else {
        currentStreak = 1;
      }

      lastDate = currentDate;
    }
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  return {
    total_watch_time: totalWatchTime,
    total_plays: userSessions.filter(
      (s: { playDuration: number | null }) =>
        s.playDuration && s.playDuration > 0
    ).length,
    longest_streak: longestStreak, // Return the number of days directly
  };
};

export const getUsersWithStats = async ({
  serverId
}: {
  serverId: string | number;
}): Promise<UserWithStats[]> => {
  const users = await getUsers({ serverId });

  // Get watch stats for all users in parallel
  const userStatsPromises = users.map(async (user) => {
    const watchStats = await getUserWatchStats({ serverId, userId: user.id });
    return {
      ...user,
      watch_stats: watchStats,
      longest_streak: watchStats.longest_streak,
    };
  });

  return Promise.all(userStatsPromises);
};

export interface GenreStat {
  genre: string;
  watchTime: number;
  playCount: number;
}

export const getUserGenreStats = async ({
  userId,
  serverId
}: {
  userId: string;
  serverId: string | number;
}): Promise<GenreStat[]> => {
  const sessionItems = await db
    .select({
      playDuration: sessions.playDuration,
      genres: items.genres,
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.serverId, Number(serverId)),
        inArray(items.type, ["Movie", "Episode", "Series"])
      )
    );

  const genreMap: Record<string, { watchTime: number; playCount: number }> = {};

  for (const row of sessionItems) {
    if (Array.isArray(row.genres)) {
      for (const genre of row.genres) {
        if (!genre) continue;
        if (!genreMap[genre]) {
          genreMap[genre] = { watchTime: 0, playCount: 0 };
        }
        genreMap[genre].watchTime += row.playDuration || 0;
        genreMap[genre].playCount += 1;
      }
    }
  }

  return Object.entries(genreMap).map(([genre, stats]) => ({
    genre,
    watchTime: stats.watchTime,
    playCount: stats.playCount,
  }));
};
