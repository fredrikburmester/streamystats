// Transcoding statistics types and functions
import { db, Session, sessions } from "@streamystats/database";
import { and, eq, gte, lte, isNotNull } from "drizzle-orm";

export interface NumericStat {
  label: string;
  value: number;
  count: number;
  distribution?: any[];
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
  userId?: string
): Promise<TranscodingStatisticsResponse> {
  // Get all sessions with transcoding data for the specified date range
  const whereConditions = [eq(sessions.serverId, serverId)];

  if (startDate) {
    whereConditions.push(gte(sessions.startTime, new Date(startDate)));
  }
  if (endDate) {
    whereConditions.push(lte(sessions.startTime, new Date(endDate)));
  }
  if (userId) {
    whereConditions.push(eq(sessions.userId, userId));
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
    let transcodingInfo: any = null;
    if (session.rawData && typeof session.rawData === "object") {
      // Look for transcoding info in various possible locations
      transcodingInfo =
        (session.rawData as any).TranscodingInfo ||
        (session.rawData as any).transcodingInfo ||
        (session.rawData as any).transcodeInfo;
    }

    if (isDirectPlay) {
      directPlayCount++;
    } else {
      transcodeCount++;

      // Collect transcoding data only for transcoded sessions
      if (session.transcodingVideoCodec) {
        videoCodecMap.set(
          session.transcodingVideoCodec,
          (videoCodecMap.get(session.transcodingVideoCodec) || 0) + 1
        );
      }

      if (session.transcodingAudioCodec) {
        audioCodecMap.set(
          session.transcodingAudioCodec,
          (audioCodecMap.get(session.transcodingAudioCodec) || 0) + 1
        );
      }

      if (session.transcodingContainer) {
        containerMap.set(
          session.transcodingContainer,
          (containerMap.get(session.transcodingContainer) || 0) + 1
        );
      }

      // Try to get hardware acceleration type from rawData
      if (
        session.hardwareAccelType ||
        transcodingInfo?.HardwareAccelerationType ||
        transcodingInfo?.hardwareAccelerationType
      ) {
        const hwType =
          session.hardwareAccelType ||
          transcodingInfo.HardwareAccelerationType ||
          transcodingInfo.hardwareAccelerationType;
        hardwareAccelMap.set(hwType, (hardwareAccelMap.get(hwType) || 0) + 1);
      }

      // Collect transcoding reasons
      if (session.transcodingReasons && session.transcodingReasons.length > 0) {
        session.transcodingReasons.forEach((reason) => {
          transcodingReasonsMap.set(
            reason,
            (transcodingReasonsMap.get(reason) || 0) + 1
          );
        });
      }

      // Collect bitrate data (try rawData first, then fallback to video bitrate)
      let bitrate =
        transcodingInfo?.Bitrate ||
        transcodingInfo?.bitrate ||
        session.transcodingBitrate ||
        session.videoBitRate;
      if (bitrate) {
        bitrates.push(bitrate);
      }

      if (session.transcodingWidth) {
        widths.push(session.transcodingWidth);
      }

      if (session.transcodingHeight) {
        heights.push(session.transcodingHeight);
      }

      // Try to get audio channels from transcoding info or session data
      const channels =
        transcodingInfo?.AudioChannels ||
        transcodingInfo?.audioChannels ||
        session.audioChannels;
      if (channels) {
        audioChannels.push(channels);
      }
    }
  }

  // Calculate bitrate statistics
  const bitrateStats = calculateNumericStats("Bitrate", bitrates);
  const widthStats = calculateNumericStats("Width", widths);
  const heightStats = calculateNumericStats("Height", heights);
  const audioChannelStats = calculateNumericStats(
    "Audio Channels",
    audioChannels
  );

  // Convert codec maps to CategoryStat arrays
  const videoCodecStats = mapToCategoryStats(videoCodecMap, transcodeCount);
  const audioCodecStats = mapToCategoryStats(audioCodecMap, transcodeCount);
  const containerStats = mapToCategoryStats(containerMap, transcodeCount);
  const hardwareAccelStats = mapToCategoryStats(
    hardwareAccelMap,
    transcodeCount
  );
  const transcodingReasonsStats = mapToCategoryStats(
    transcodingReasonsMap,
    transcodeCount
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
  total: number
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
  endDate?: string
): Promise<NumericStat[]> {
  const whereConditions = [
    eq(sessions.serverId, serverId),
    isNotNull(sessions.videoBitRate),
  ];

  if (startDate) {
    whereConditions.push(gte(sessions.startTime, new Date(startDate)));
  }
  if (endDate) {
    whereConditions.push(lte(sessions.startTime, new Date(endDate)));
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
      if (s.rawData && typeof s.rawData === "object") {
        const transcodingInfo =
          (s.rawData as any).TranscodingInfo ||
          (s.rawData as any).transcodingInfo;
        if (transcodingInfo?.Bitrate || transcodingInfo?.bitrate) {
          return transcodingInfo.Bitrate || transcodingInfo.bitrate;
        }
      }
      return s.videoBitRate;
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
    { label: "20+ Mbps", min: 20000000, max: Infinity },
  ];

  return ranges
    .map((range) => {
      const valuesInRange = bitrates.filter(
        (b) => b >= range.min && b < range.max
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
  endDate?: string
): Promise<{ [codec: string]: number }> {
  const whereConditions = [eq(sessions.serverId, serverId)];

  if (startDate) {
    whereConditions.push(gte(sessions.startTime, new Date(startDate)));
  }
  if (endDate) {
    whereConditions.push(lte(sessions.startTime, new Date(endDate)));
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
  endDate?: string
): Promise<{ [resolution: string]: number }> {
  const whereConditions = [
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
      const resolution = `${session.transcodingWidth}x${session.transcodingHeight}`;

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
