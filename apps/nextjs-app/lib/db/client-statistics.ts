// Client statistics types and functions

import { db, sessions, users } from "@streamystats/database";
import {
  and,
  count,
  eq,
  gte,
  isNotNull,
  lte,
  type SQL,
  sql,
  sum,
} from "drizzle-orm";

import { getStatisticsExclusions } from "./exclusions";

export interface ClientStat {
  clientName: string;
  sessionCount: number;
  totalWatchTime: number; // in seconds
  uniqueUsers: number;
  uniqueDevices: number;
  transcodedSessions: number;
  directPlaySessions: number;
  transcodingRate: number; // percentage
}

export interface ClientPerUserStat {
  userId: string;
  userName: string;
  clientName: string;
  sessionCount: number;
  totalWatchTime: number;
}

export interface ClientPerDeviceStat {
  deviceName: string;
  deviceId: string;
  clientName: string;
  sessionCount: number;
  totalWatchTime: number;
}

export interface ClientTranscodingStat {
  clientName: string;
  totalSessions: number;
  transcodedSessions: number;
  directPlaySessions: number;
  transcodingRate: number;
}

export interface ClientStatisticsResponse {
  clientBreakdown: ClientStat[];
  clientsPerUser: ClientPerUserStat[];
  clientsPerDevice: ClientPerDeviceStat[];
  mostPopularClients: ClientStat[];
  transcodingByClient: ClientTranscodingStat[];
  totalSessions: number;
  uniqueClients: number;
  uniqueUsers: number;
  uniqueDevices: number;
}

export async function getClientStatistics(
  serverId: number,
  startDate?: string,
  endDate?: string,
  userId?: string,
): Promise<ClientStatisticsResponse> {
  // Get exclusion settings
  const { userExclusion } = await getStatisticsExclusions(serverId);

  const whereConditions: SQL[] = [
    eq(sessions.serverId, serverId),
    isNotNull(sessions.clientName),
  ];

  if (startDate) {
    whereConditions.push(gte(sessions.startTime, new Date(startDate)));
  }
  if (endDate) {
    whereConditions.push(lte(sessions.startTime, new Date(endDate)));
  }
  if (userId) {
    whereConditions.push(eq(sessions.userId, userId));
  }

  // Add exclusion filters
  if (userExclusion) {
    whereConditions.push(userExclusion);
  }

  // Get all client statistics
  const clientStats = await db
    .select({
      clientName: sessions.clientName,
      sessionCount: count(sessions.id),
      totalWatchTime: sum(sessions.playDuration),
      uniqueUsers: sql<number>`COUNT(DISTINCT ${sessions.userId})`,
      uniqueDevices: sql<number>`COUNT(DISTINCT ${sessions.deviceId})`,
      transcodedSessions: sql<number>`COUNT(CASE WHEN ${sessions.isTranscoded} IS TRUE THEN 1 END)`,
      directPlaySessions: sql<number>`COUNT(CASE WHEN ${sessions.isTranscoded} IS FALSE OR ${sessions.playMethod} = 'DirectPlay' THEN 1 END)`,
    })
    .from(sessions)
    .where(and(...whereConditions))
    .groupBy(sessions.clientName)
    .orderBy(sql`COUNT(${sessions.id}) DESC`);

  // Get clients per user
  const clientsPerUser = await db
    .select({
      userId: sessions.userId,
      userName: users.name,
      clientName: sessions.clientName,
      sessionCount: count(sessions.id),
      totalWatchTime: sum(sessions.playDuration),
    })
    .from(sessions)
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(and(...whereConditions))
    .groupBy(sessions.userId, users.name, sessions.clientName)
    .orderBy(sql`COUNT(${sessions.id}) DESC`);

  // Get clients per device
  const clientsPerDevice = await db
    .select({
      deviceName: sessions.deviceName,
      deviceId: sessions.deviceId,
      clientName: sessions.clientName,
      sessionCount: count(sessions.id),
      totalWatchTime: sum(sessions.playDuration),
    })
    .from(sessions)
    .where(and(...whereConditions))
    .groupBy(sessions.deviceName, sessions.deviceId, sessions.clientName)
    .orderBy(sql`COUNT(${sessions.id}) DESC`);

  // Get transcoding stats by client
  const transcodingByClient = await db
    .select({
      clientName: sessions.clientName,
      totalSessions: count(sessions.id),
      transcodedSessions: sql<number>`COUNT(CASE WHEN ${sessions.isTranscoded} IS TRUE THEN 1 END)`,
      directPlaySessions: sql<number>`COUNT(CASE WHEN ${sessions.isTranscoded} IS FALSE OR ${sessions.playMethod} = 'DirectPlay' THEN 1 END)`,
    })
    .from(sessions)
    .where(and(...whereConditions))
    .groupBy(sessions.clientName)
    .orderBy(sql`COUNT(${sessions.id}) DESC`);

  // Get total counts
  const totalSessionsResult = await db
    .select({
      total: count(sessions.id),
      uniqueClients: sql<number>`COUNT(DISTINCT ${sessions.clientName})`,
      uniqueUsers: sql<number>`COUNT(DISTINCT ${sessions.userId})`,
      uniqueDevices: sql<number>`COUNT(DISTINCT ${sessions.deviceId})`,
    })
    .from(sessions)
    .where(and(...whereConditions));

  const totalSessions = Number(totalSessionsResult[0]?.total || 0);
  const uniqueClients = Number(totalSessionsResult[0]?.uniqueClients || 0);
  const uniqueUsersCount = Number(totalSessionsResult[0]?.uniqueUsers || 0);
  const uniqueDevicesCount = Number(totalSessionsResult[0]?.uniqueDevices || 0);

  // Process client stats
  const processedClientStats: ClientStat[] = clientStats
    .filter((stat) => stat.clientName)
    .map((stat) => {
      const sessionCount = Number(stat.sessionCount || 0);
      const transcoded = Number(stat.transcodedSessions || 0);
      const transcodingRate =
        sessionCount > 0 ? (transcoded / sessionCount) * 100 : 0;

      return {
        clientName: stat.clientName || "Unknown",
        sessionCount,
        totalWatchTime: Number(stat.totalWatchTime || 0),
        uniqueUsers: Number(stat.uniqueUsers || 0),
        uniqueDevices: Number(stat.uniqueDevices || 0),
        transcodedSessions: transcoded,
        directPlaySessions: Number(stat.directPlaySessions || 0),
        transcodingRate,
      };
    });

  // Process clients per user
  const processedClientsPerUser: ClientPerUserStat[] = clientsPerUser
    .filter((stat) => stat.clientName && stat.userId)
    .map((stat) => ({
      userId: stat.userId || "",
      userName: stat.userName || "Unknown User",
      clientName: stat.clientName || "Unknown",
      sessionCount: Number(stat.sessionCount || 0),
      totalWatchTime: Number(stat.totalWatchTime || 0),
    }));

  // Process clients per device
  const processedClientsPerDevice: ClientPerDeviceStat[] = clientsPerDevice
    .filter((stat) => stat.clientName && stat.deviceId)
    .map((stat) => ({
      deviceName: stat.deviceName || "Unknown Device",
      deviceId: stat.deviceId || "",
      clientName: stat.clientName || "Unknown",
      sessionCount: Number(stat.sessionCount || 0),
      totalWatchTime: Number(stat.totalWatchTime || 0),
    }));

  // Process transcoding by client
  const processedTranscodingByClient: ClientTranscodingStat[] =
    transcodingByClient
      .filter((stat) => stat.clientName)
      .map((stat) => {
        const total = Number(stat.totalSessions || 0);
        const transcoded = Number(stat.transcodedSessions || 0);
        const transcodingRate = total > 0 ? (transcoded / total) * 100 : 0;

        return {
          clientName: stat.clientName || "Unknown",
          totalSessions: total,
          transcodedSessions: transcoded,
          directPlaySessions: Number(stat.directPlaySessions || 0),
          transcodingRate,
        };
      });

  return {
    clientBreakdown: processedClientStats,
    clientsPerUser: processedClientsPerUser,
    clientsPerDevice: processedClientsPerDevice,
    mostPopularClients: processedClientStats.slice(0, 10), // Top 10
    transcodingByClient: processedTranscodingByClient,
    totalSessions,
    uniqueClients,
    uniqueUsers: uniqueUsersCount,
    uniqueDevices: uniqueDevicesCount,
  };
}
