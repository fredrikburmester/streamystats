// Transcoding statistics types and functions

import type { Session } from "@streamystats/database";
import { db, items, sessions } from "@streamystats/database";
import {
  and,
  count,
  eq,
  gte,
  isNotNull,
  lte,
  notInArray,
  type SQL,
  sql,
} from "drizzle-orm";
import { getExclusionSettings, getStatisticsExclusions } from "./exclusions";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getNestedTranscodingInfo(value: unknown): unknown {
  if (!isRecord(value)) return null;
  return value.TranscodingInfo ?? value.transcodingInfo ?? value.transcodeInfo;
}

export interface NumericStat {
  label: string;
  value: number;
  count: number;
  distribution?: number[];
  avg?: number;
  min?: number;
  max?: number;
}

export interface CategoryStat {
  label: string;
  count: number;
  percentage: number;
  value: number; // Added for component compatibility
}

export interface DirectnessStat {
  label: string; // Added for component compatibility
  direct: number;
  transcoded: number;
  total: number;
  value: number; // Added for component compatibility
  count: number; // Added for component compatibility
  percentage: number; // Added for component compatibility
}

export interface TranscodingStatistics {
  bitrateDistribution: NumericStat[];
  codecDistribution: { [codec: string]: number };
  resolutionDistribution: { [resolution: string]: number };
  directPlayVsTranscode: {
    directPlay: number;
    transcode: number;
  };
}

export interface TranscodingStatisticsResponse {
  statistics: TranscodingStatistics;
  totalSessions: number;
  dateRange: {
    start: string;
    end: string;
  };
  // Additional properties for component compatibility
  directness: DirectnessStat[];
  transcodingReasons: CategoryStat[];
  transcodingBitrate: NumericStat;
  transcodingAudioCodec: CategoryStat[];
  transcodingVideoCodec: CategoryStat[];
  transcodingContainer: CategoryStat[];
  transcodingWidth: NumericStat;
  transcodingHeight: NumericStat;
  transcodingHardwareAccelerationType: CategoryStat[];
}

// Main transcoding statistics function
export async function getTranscodingStatistics(
  serverId: number,
  startDate?: string,
  endDate?: string,
  userId?: string,
): Promise<TranscodingStatisticsResponse> {
  // Get exclusion settings
  const { userExclusion, itemLibraryExclusion } =
    await getStatisticsExclusions(serverId);

  // Get all sessions with transcoding data for the specified date range
  const whereConditions: SQL[] = [eq(sessions.serverId, serverId)];

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
  if (itemLibraryExclusion) {
    whereConditions.push(itemLibraryExclusion);
  }

  const sessionData = await db
    .select({
      isTranscoded: sessions.isTranscoded,
      playMethod: sessions.playMethod,
      transcodingVideoCodec: sessions.transcodingVideoCodec,
      transcodingAudioCodec: sessions.transcodingAudioCodec,
      transcodingContainer: sessions.transcodingContainer,
      transcodingWidth: sessions.transcodingWidth,
      transcodingHeight: sessions.transcodingHeight,
      transcodingReasons: sessions.transcodeReasons,
      transcodingBitrate: sessions.transcodingBitrate,
      hardwareAccelType: sessions.transcodingHardwareAccelerationType,
      videoBitRate: sessions.videoBitRate,
      audioBitRate: sessions.audioBitRate,
      audioChannels: sessions.audioChannels,
      rawData: sessions.rawData,
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .where(and(...whereConditions));

  const totalSessions = sessionData.length;

  // Analyze direct play vs transcode
  let directPlayCount = 0;
  let transcodeCount = 0;

  // Codec distributions
  const videoCodecMap = new Map<string, number>();
  const audioCodecMap = new Map<string, number>();
  const containerMap = new Map<string, number>();
  const hardwareAccelMap = new Map<string, number>();
  const transcodingReasonsMap = new Map<string, number>();

  // Bitrate analysis
  const bitrates: number[] = [];
  const widths: number[] = [];
  const heights: number[] = [];
  const audioChannels: number[] = [];

  for (const session of sessionData) {
    // Determine if session is direct play or transcode using multiple indicators
    let isDirectPlay = false;

    // Priority 1: Use isTranscoded flag
    if (session.isTranscoded !== null) {
      isDirectPlay = !session.isTranscoded;
    }
    // Priority 2: Use playMethod
    else if (session.playMethod) {
      isDirectPlay = session.playMethod === "DirectPlay";
    }
    // Priority 3: Check if any transcoding fields are populated
    else {
      isDirectPlay = !(
        session.transcodingVideoCodec ||
        session.transcodingAudioCodec ||
        session.transcodingContainer
      );
    }

    // Try to extract additional info from rawData
    let transcodingInfo: unknown = null;
    transcodingInfo = getNestedTranscodingInfo(session.rawData);

    if (isDirectPlay) {
      directPlayCount++;
    } else {
      transcodeCount++;

      // Collect transcoding data only for transcoded sessions
      if (session.transcodingVideoCodec) {
        videoCodecMap.set(
          session.transcodingVideoCodec,
          (videoCodecMap.get(session.transcodingVideoCodec) || 0) + 1,
        );
      }

      if (session.transcodingAudioCodec) {
        audioCodecMap.set(
          session.transcodingAudioCodec,
          (audioCodecMap.get(session.transcodingAudioCodec) || 0) + 1,
        );
      }

      if (session.transcodingContainer) {
        containerMap.set(
          session.transcodingContainer,
          (containerMap.get(session.transcodingContainer) || 0) + 1,
        );
      }

      // Try to get hardware acceleration type from rawData
      const hwTypeRaw =
        session.hardwareAccelType ??
        (isRecord(transcodingInfo)
          ? (transcodingInfo.HardwareAccelerationType ??
            transcodingInfo.hardwareAccelerationType)
          : null);
      if (typeof hwTypeRaw === "string" && hwTypeRaw.length > 0) {
        hardwareAccelMap.set(
          hwTypeRaw,
          (hardwareAccelMap.get(hwTypeRaw) || 0) + 1,
        );
      }

      // Collect transcoding reasons
      if (session.transcodingReasons && session.transcodingReasons.length > 0) {
        for (const reason of session.transcodingReasons) {
          transcodingReasonsMap.set(
            reason,
            (transcodingReasonsMap.get(reason) || 0) + 1,
          );
        }
      }

      // Collect bitrate data (try rawData first, then fallback to video bitrate)
      const bitrateRaw =
        (isRecord(transcodingInfo)
          ? (transcodingInfo.Bitrate ?? transcodingInfo.bitrate)
          : null) ??
        session.transcodingBitrate ??
        session.videoBitRate;
      const bitrate = toFiniteNumber(bitrateRaw);
      if (bitrate !== null) {
        bitrates.push(bitrate);
      }

      if (session.transcodingWidth) {
        widths.push(session.transcodingWidth);
      }

      if (session.transcodingHeight) {
        heights.push(session.transcodingHeight);
      }

      // Try to get audio channels from transcoding info or session data
      const channelsRaw =
        (isRecord(transcodingInfo)
          ? (transcodingInfo.AudioChannels ?? transcodingInfo.audioChannels)
          : null) ?? session.audioChannels;
      const channels = toFiniteNumber(channelsRaw);
      if (channels !== null) {
        audioChannels.push(channels);
      }
    }
  }

  // Calculate bitrate statistics
  const bitrateStats = calculateNumericStats("Bitrate", bitrates);
  const widthStats = calculateNumericStats("Width", widths);
  const heightStats = calculateNumericStats("Height", heights);
  const _audioChannelStats = calculateNumericStats(
    "Audio Channels",
    audioChannels,
  );

  // Convert codec maps to CategoryStat arrays
  const videoCodecStats = mapToCategoryStats(videoCodecMap, transcodeCount);
  const audioCodecStats = mapToCategoryStats(audioCodecMap, transcodeCount);
  const containerStats = mapToCategoryStats(containerMap, transcodeCount);
  const hardwareAccelStats = mapToCategoryStats(
    hardwareAccelMap,
    transcodeCount,
  );
  const transcodingReasonsStats = mapToCategoryStats(
    transcodingReasonsMap,
    transcodeCount,
  );

  // Calculate percentages for directness
  const directPlayPercentage =
    totalSessions > 0 ? (directPlayCount / totalSessions) * 100 : 0;
  const transcodePercentage =
    totalSessions > 0 ? (transcodeCount / totalSessions) * 100 : 0;

  return {
    statistics: {
      bitrateDistribution: [bitrateStats],
      codecDistribution: Object.fromEntries(videoCodecMap),
      resolutionDistribution: {},
      directPlayVsTranscode: {
        directPlay: directPlayCount,
        transcode: transcodeCount,
      },
    },
    totalSessions,
    dateRange: {
      start: startDate || new Date().toISOString().split("T")[0],
      end: endDate || new Date().toISOString().split("T")[0],
    },
    directness: [
      {
        label: "Direct Play",
        direct: directPlayCount,
        transcoded: 0,
        total: totalSessions,
        value: directPlayCount,
        count: directPlayCount,
        percentage: directPlayPercentage,
      },
      {
        label: "Transcode",
        direct: 0,
        transcoded: transcodeCount,
        total: totalSessions,
        value: transcodeCount,
        count: transcodeCount,
        percentage: transcodePercentage,
      },
    ],
    transcodingReasons: transcodingReasonsStats,
    transcodingBitrate: bitrateStats,
    transcodingAudioCodec: audioCodecStats,
    transcodingVideoCodec: videoCodecStats,
    transcodingContainer: containerStats,
    transcodingWidth: widthStats,
    transcodingHeight: heightStats,
    transcodingHardwareAccelerationType: hardwareAccelStats,
  };
}

// Helper function to calculate numeric statistics
function calculateNumericStats(label: string, values: number[]): NumericStat {
  if (values.length === 0) {
    return {
      label,
      value: 0,
      count: 0,
      distribution: [],
      avg: 0,
      min: 0,
      max: 0,
    };
  }

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    label,
    value: avg,
    count: values.length,
    distribution: values,
    avg,
    min,
    max,
  };
}

// Helper function to convert Map to CategoryStat array
function mapToCategoryStats(
  map: Map<string, number>,
  total: number,
): CategoryStat[] {
  return Array.from(map.entries()).map(([label, count]) => ({
    label,
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
    value: count,
  }));
}

export async function getBitrateDistribution(
  serverId: number,
  startDate?: string,
  endDate?: string,
): Promise<NumericStat[]> {
  // Get exclusion settings
  const { excludedUserIds } = await getExclusionSettings(serverId);

  const whereConditions: SQL[] = [
    eq(sessions.serverId, serverId),
    isNotNull(sessions.videoBitRate),
  ];

  if (startDate) {
    whereConditions.push(gte(sessions.startTime, new Date(startDate)));
  }
  if (endDate) {
    whereConditions.push(lte(sessions.startTime, new Date(endDate)));
  }

  // Add exclusion filters
  if (excludedUserIds.length > 0) {
    whereConditions.push(notInArray(sessions.userId, excludedUserIds));
  }

  const sessionData = (await db
    .select({
      videoBitRate: sessions.videoBitRate,
      audioBitRate: sessions.audioBitRate,
      rawData: sessions.rawData,
    })
    .from(sessions)
    .where(and(...whereConditions))) as Session[];

  const bitrates = sessionData
    .map((s) => {
      // Try to get transcoding bitrate from rawData first, then fall back to video bitrate
      const transcodingInfo = getNestedTranscodingInfo(s.rawData);
      if (isRecord(transcodingInfo)) {
        const bitrate = toFiniteNumber(
          transcodingInfo.Bitrate ?? transcodingInfo.bitrate,
        );
        if (bitrate !== null) return bitrate;
      }
      return s.videoBitRate ?? null;
    })
    .filter((bitrate): bitrate is number => bitrate !== null);

  if (bitrates.length === 0) {
    return [];
  }

  // Group bitrates into ranges (e.g., 0-1Mbps, 1-5Mbps, 5-10Mbps, 10+Mbps)
  const ranges = [
    { label: "0-1 Mbps", min: 0, max: 1000000 },
    { label: "1-5 Mbps", min: 1000000, max: 5000000 },
    { label: "5-10 Mbps", min: 5000000, max: 10000000 },
    { label: "10-20 Mbps", min: 10000000, max: 20000000 },
    { label: "20+ Mbps", min: 20000000, max: Number.POSITIVE_INFINITY },
  ];

  return ranges
    .map((range) => {
      const valuesInRange = bitrates.filter(
        (b) => b >= range.min && b < range.max,
      );
      const avg =
        valuesInRange.length > 0
          ? valuesInRange.reduce((a, b) => a + b, 0) / valuesInRange.length
          : 0;

      return {
        label: range.label,
        value: avg,
        count: valuesInRange.length,
        distribution: valuesInRange,
        avg,
        min: valuesInRange.length > 0 ? Math.min(...valuesInRange) : 0,
        max: valuesInRange.length > 0 ? Math.max(...valuesInRange) : 0,
      };
    })
    .filter((stat) => stat.count > 0);
}

export async function getCodecDistribution(
  serverId: number,
  startDate?: string,
  endDate?: string,
): Promise<{ [codec: string]: number }> {
  // Get exclusion settings
  const { excludedUserIds } = await getExclusionSettings(serverId);

  const whereConditions: SQL[] = [eq(sessions.serverId, serverId)];

  if (startDate) {
    whereConditions.push(gte(sessions.startTime, new Date(startDate)));
  }
  if (endDate) {
    whereConditions.push(lte(sessions.startTime, new Date(endDate)));
  }

  // Add exclusion filters
  if (excludedUserIds.length > 0) {
    whereConditions.push(notInArray(sessions.userId, excludedUserIds));
  }

  const sessionData = await db
    .select({
      transcodingVideoCodec: sessions.transcodingVideoCodec,
      transcodingAudioCodec: sessions.transcodingAudioCodec,
      isTranscoded: sessions.isTranscoded,
      playMethod: sessions.playMethod,
      rawData: sessions.rawData,
    })
    .from(sessions)
    .where(and(...whereConditions));

  const codecDistribution: { [codec: string]: number } = {};

  for (const session of sessionData) {
    // Determine if this is a transcoding session
    let isTranscodingSession = false;
    if (session.isTranscoded !== null) {
      isTranscodingSession = session.isTranscoded;
    } else if (session.playMethod) {
      isTranscodingSession = session.playMethod !== "DirectPlay";
    } else {
      isTranscodingSession = !!(
        session.transcodingVideoCodec || session.transcodingAudioCodec
      );
    }

    // Only count codecs for transcoding sessions
    if (isTranscodingSession && session.transcodingVideoCodec) {
      const codec = `Video: ${session.transcodingVideoCodec}`;
      codecDistribution[codec] = (codecDistribution[codec] || 0) + 1;
    }

    if (isTranscodingSession && session.transcodingAudioCodec) {
      const codec = `Audio: ${session.transcodingAudioCodec}`;
      codecDistribution[codec] = (codecDistribution[codec] || 0) + 1;
    }
  }

  return codecDistribution;
}

export async function getResolutionDistribution(
  serverId: number,
  startDate?: string,
  endDate?: string,
): Promise<{ [resolution: string]: number }> {
  // Get exclusion settings
  const { excludedUserIds } = await getExclusionSettings(serverId);

  const whereConditions: SQL[] = [
    eq(sessions.serverId, serverId),
    isNotNull(sessions.transcodingWidth),
    isNotNull(sessions.transcodingHeight),
  ];

  if (startDate) {
    whereConditions.push(gte(sessions.startTime, new Date(startDate)));
  }
  if (endDate) {
    whereConditions.push(lte(sessions.startTime, new Date(endDate)));
  }

  // Add exclusion filters
  if (excludedUserIds.length > 0) {
    whereConditions.push(notInArray(sessions.userId, excludedUserIds));
  }

  const sessionData = await db
    .select({
      transcodingWidth: sessions.transcodingWidth,
      transcodingHeight: sessions.transcodingHeight,
      isTranscoded: sessions.isTranscoded,
      playMethod: sessions.playMethod,
    })
    .from(sessions)
    .where(and(...whereConditions));

  const resolutionDistribution: { [resolution: string]: number } = {};

  for (const session of sessionData) {
    // Determine if this is a transcoding session
    let isTranscodingSession = false;
    if (session.isTranscoded !== null) {
      isTranscodingSession = session.isTranscoded;
    } else if (session.playMethod) {
      isTranscodingSession = session.playMethod !== "DirectPlay";
    } else {
      isTranscodingSession = true; // If we have width/height data, assume it's transcoded
    }

    // Only count resolutions for video transcoding sessions
    if (
      isTranscodingSession &&
      session.transcodingWidth &&
      session.transcodingHeight
    ) {
      const _resolution = `${session.transcodingWidth}x${session.transcodingHeight}`;

      // Group into common resolution categories
      let category: string;
      if (session.transcodingHeight <= 480) {
        category = "SD (≤480p)";
      } else if (session.transcodingHeight <= 720) {
        category = "HD (720p)";
      } else if (session.transcodingHeight <= 1080) {
        category = "Full HD (1080p)";
      } else if (session.transcodingHeight <= 1440) {
        category = "QHD (1440p)";
      } else {
        category = "4K+ (>1440p)";
      }

      resolutionDistribution[category] =
        (resolutionDistribution[category] || 0) + 1;
    }
  }

  return resolutionDistribution;
}

export interface TranscodingHistoryStat {
  date: string;
  directPlay: number;
  transcode: number;
  total: number;
  reasons: Record<string, number>;
}

export async function getTranscodingStatisticsOverTime(
  serverId: number,
  startDate?: string,
  endDate?: string,
  userId?: string,
): Promise<TranscodingHistoryStat[]> {
  // Get exclusion settings
  const { userExclusion, itemLibraryExclusion } =
    await getStatisticsExclusions(serverId);

  const whereConditions: SQL[] = [eq(sessions.serverId, serverId)];

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
  if (itemLibraryExclusion) {
    whereConditions.push(itemLibraryExclusion);
  }

  // SQL CASE expression replicating the is-direct-play priority logic
  const isDirectPlayCase = sql`
    CASE
      WHEN ${sessions.isTranscoded} IS NOT NULL THEN
        CASE WHEN ${sessions.isTranscoded} = false THEN 1 ELSE 0 END
      WHEN ${sessions.playMethod} IS NOT NULL THEN
        CASE WHEN ${sessions.playMethod} = 'DirectPlay' THEN 1 ELSE 0 END
      ELSE
        CASE WHEN ${sessions.transcodingVideoCodec} IS NULL
              AND ${sessions.transcodingAudioCodec} IS NULL
              AND ${sessions.transcodingContainer} IS NULL
             THEN 1 ELSE 0 END
    END`;

  const filter = and(...whereConditions);

  // Query 1: Aggregate direct play vs transcode counts per day
  const dailyStats = await db
    .select({
      date: sql<string>`DATE(${sessions.startTime})`.as("date"),
      directPlay: sql<number>`COALESCE(SUM(${isDirectPlayCase}), 0)`.as(
        "direct_play",
      ),
      transcode: sql<number>`COALESCE(SUM(1 - (${isDirectPlayCase})), 0)`.as(
        "transcode",
      ),
      total: count().as("total"),
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .where(filter)
    .groupBy(sql`DATE(${sessions.startTime})`)
    .orderBy(sql`DATE(${sessions.startTime})`);

  // Query 2: Aggregate transcode reason counts per day
  // Only for sessions that are transcoded
  const reasonRows = await db
    .select({
      date: sql<string>`DATE(${sessions.startTime})`.as("date"),
      reason: sql<string>`unnest(${sessions.transcodeReasons})`.as("reason"),
      count: count().as("count"),
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .where(
      and(
        ...whereConditions,
        isNotNull(sessions.transcodeReasons),
        eq(sessions.isTranscoded, true),
      ),
    )
    .groupBy(
      sql`DATE(${sessions.startTime})`,
      sql`unnest(${sessions.transcodeReasons})`,
    );

  // Build a lookup of reasons per date
  const reasonsByDate = new Map<string, Record<string, number>>();
  for (const row of reasonRows) {
    if (!row.date || !row.reason) continue;
    const dateKey = row.date;
    if (!reasonsByDate.has(dateKey)) {
      reasonsByDate.set(dateKey, {});
    }
    const reasons = reasonsByDate.get(dateKey)!;
    reasons[row.reason] = Number(row.count);
  }

  return dailyStats.map((row) => ({
    date: row.date,
    directPlay: Number(row.directPlay),
    transcode: Number(row.transcode),
    total: Number(row.total),
    reasons: reasonsByDate.get(row.date) ?? {},
  }));
}
