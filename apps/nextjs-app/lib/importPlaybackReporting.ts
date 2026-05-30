"use server";

import { createHash } from "node:crypto";
import { db } from "@streamystats/database";
import {
  items,
  type NewSession,
  sessions,
  users,
} from "@streamystats/database/schema";
import { eq } from "drizzle-orm";
import {
  parseDotNetTimestamp,
  parseEpisodeInfo,
  parsePlayMethod,
  parseTsvLine,
} from "./playbackReportingParsers";

// Re-export types for consumers
export type {
  EpisodeInfo,
  ItemType,
  PlaybackRow,
  PlayMethodParsed,
  PlayMode,
  PositionKind,
} from "./playbackReportingParsers";

// =============================================================================
// Types
// =============================================================================

export interface ImportError {
  reason: string;
  itemName?: string;
  timestamp?: string;
}

export interface ImportState {
  type: "success" | "error" | "info" | null;
  message: string;
  importedCount?: number;
  totalCount?: number;
  errorCount?: number;
  skippedCount?: number;
  errors?: ImportError[];
}

// Internal interface for DB mapping
interface PlaybackReportingData {
  timestamp: string;
  userId?: string;
  itemId?: string;
  itemType?: string;
  itemName?: string;
  playMethod?: string;
  clientName?: string;
  deviceName?: string;
  durationSeconds?: number;
}

// =============================================================================
// TSV Parsing
// =============================================================================

function parsePlaybackReportingTsv(text: string): PlaybackReportingData[] {
  const lines = text.split("\n");
  const data: PlaybackReportingData[] = [];

  for (const line of lines) {
    const row = parseTsvLine(line);
    if (!row) continue;

    // Skip rows with invalid position (INT32_MIN sentinel)
    if (row.positionKind === "invalid") continue;

    data.push({
      timestamp: row.timestampRaw,
      userId: row.userId,
      itemId: row.itemId,
      itemType: row.itemType,
      itemName: row.itemName,
      playMethod: row.playMethodRaw,
      clientName: row.client,
      deviceName: row.deviceName,
      durationSeconds: row.positionSeconds,
    });
  }

  return data;
}

// =============================================================================
// JSON Parsing
// =============================================================================

function getValue(
  record: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function buildPlaybackData(
  timestamp: string,
  record: Record<string, unknown>,
  durationSeconds?: number,
): PlaybackReportingData {
  const data: PlaybackReportingData = { timestamp };

  const userId = getValue(record, "userId", "user_id", "UserId");
  if (userId) data.userId = userId;

  const itemId = getValue(record, "itemId", "item_id", "ItemId");
  if (itemId) data.itemId = itemId;

  const itemType = getValue(record, "itemType", "item_type", "Type");
  if (itemType) data.itemType = itemType;

  const itemName = getValue(record, "itemName", "item_name", "Name");
  if (itemName) data.itemName = itemName;

  const playMethod = getValue(
    record,
    "playMethod",
    "play_method",
    "PlayMethod",
  );
  if (playMethod) data.playMethod = playMethod;

  const clientName = getValue(record, "clientName", "client_name", "Client");
  if (clientName) data.clientName = clientName;

  const deviceName = getValue(record, "deviceName", "device_name", "Device");
  if (deviceName) data.deviceName = deviceName;

  if (durationSeconds !== undefined && !Number.isNaN(durationSeconds)) {
    data.durationSeconds = durationSeconds;
  }

  return data;
}

function parsePlaybackReportingJson(
  jsonData: unknown,
): PlaybackReportingData[] {
  if (Array.isArray(jsonData)) {
    return jsonData
      .map((item: unknown) => {
        if (typeof item !== "object" || item === null) {
          return null;
        }

        const record = item as Record<string, unknown>;
        const timestamp =
          getValue(record, "timestamp", "date", "time") ||
          new Date().toISOString();

        const durationValue =
          getValue(record, "durationSeconds", "duration_seconds", "Duration") ||
          "0";
        const parsedDuration = Number.parseInt(durationValue, 10);

        if (Number.isNaN(parsedDuration) || parsedDuration < 0) {
          return null;
        }

        return buildPlaybackData(timestamp, record, parsedDuration);
      })
      .filter((item): item is PlaybackReportingData => item !== null);
  }

  if (
    typeof jsonData === "object" &&
    jsonData !== null &&
    !Array.isArray(jsonData)
  ) {
    const obj = jsonData as Record<string, unknown>;
    if (obj.sessions || obj.data) {
      return parsePlaybackReportingJson(obj.sessions || obj.data);
    }
  }

  throw new Error("Unrecognized JSON format");
}

// =============================================================================
// Validation
// =============================================================================

function validatePlaybackReportingData(data: PlaybackReportingData[]): {
  isValid: boolean;
  error?: string;
} {
  if (!Array.isArray(data)) {
    return { isValid: false, error: "Data must be an array" };
  }

  if (data.length === 0) {
    return { isValid: false, error: "Data array is empty" };
  }

  const sampleSize = Math.min(5, data.length);

  for (let i = 0; i < sampleSize; i++) {
    const session = data[i];

    if (typeof session !== "object" || session === null) {
      return { isValid: false, error: `Invalid session object at index ${i}` };
    }

    if (!session.timestamp) {
      return {
        isValid: false,
        error: `Missing required field "timestamp" in session at index ${i}`,
      };
    }

    // Use our custom timestamp parser for validation
    const parsed = parseDotNetTimestamp(session.timestamp);
    if (parsed === undefined && Number.isNaN(Date.parse(session.timestamp))) {
      return {
        isValid: false,
        error: `Invalid timestamp format at index ${i}: ${session.timestamp}`,
      };
    }
  }

  return { isValid: true };
}

// =============================================================================
// Main Import Function
// =============================================================================

export async function importFromPlaybackReporting(
  prevState: ImportState,
  formData: FormData,
): Promise<ImportState> {
  try {
    const serverId = formData.get("serverId");
    const file = formData.get("file") as File;

    if (!serverId || !file) {
      return {
        type: "error",
        message: "Server ID and file are required",
      };
    }

    const serverIdNum = Number(serverId);
    if (Number.isNaN(serverIdNum)) {
      return {
        type: "error",
        message: "Invalid server ID",
      };
    }

    const text = await file.text();
    let data: PlaybackReportingData[];

    const isJson =
      file.name.endsWith(".json") || file.type === "application/json";

    try {
      data = isJson
        ? parsePlaybackReportingJson(JSON.parse(text))
        : parsePlaybackReportingTsv(text);
    } catch (error) {
      return {
        type: "error",
        message: `Failed to parse file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }

    const validationResult = validatePlaybackReportingData(data);
    if (!validationResult.isValid) {
      return {
        type: "error",
        message: validationResult.error || "Invalid data format",
      };
    }

    let importedCount = 0;
    const totalCount = data.length;
    let errorCount = 0;
    let skippedCount = 0;
    const errors: ImportError[] = [];
    const maxErrors = 50; // Limit error list size

    for (const playbackData of data) {
      try {
        const result = await importPlaybackReportingSession(
          playbackData,
          serverIdNum,
        );
        if (result.success) {
          importedCount++;
        } else {
          skippedCount++;
          if (errors.length < maxErrors) {
            errors.push({
              reason: result.reason,
              itemName: playbackData.itemName,
              timestamp: playbackData.timestamp,
            });
          }
        }
      } catch (error) {
        errorCount++;
        if (errors.length < maxErrors) {
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";
          errors.push({
            reason: errorMsg.slice(0, 150),
            itemName: playbackData.itemName,
            timestamp: playbackData.timestamp,
          });
        }
      }
    }

    return {
      type: "success",
      message: `Successfully imported ${importedCount} of ${totalCount} sessions from Playback Reporting`,
      importedCount,
      totalCount,
      errorCount,
      skippedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    return {
      type: "error",
      message: error instanceof Error ? error.message : "Import failed",
    };
  }
}

// =============================================================================
// Session Import
// =============================================================================

interface ImportResult {
  success: boolean;
  reason: string;
}

async function importPlaybackReportingSession(
  playbackData: PlaybackReportingData,
  serverId: number,
): Promise<ImportResult> {
  if (!playbackData.timestamp) {
    return { success: false, reason: "Missing timestamp" };
  }

  // Parse timestamp using our custom parser first, fallback to Date
  let sessionTime: Date;
  const parsedMs = parseDotNetTimestamp(playbackData.timestamp);
  if (parsedMs !== undefined) {
    sessionTime = new Date(parsedMs);
  } else {
    sessionTime = new Date(playbackData.timestamp);
    if (Number.isNaN(sessionTime.getTime())) {
      return {
        success: false,
        reason: `Invalid timestamp: ${playbackData.timestamp}`,
      };
    }
  }

  // Skip sessions with no duration or invalid duration
  if (playbackData.durationSeconds === undefined) {
    return { success: false, reason: "Missing duration" };
  }

  if (playbackData.durationSeconds <= 0) {
    return {
      success: false,
      reason: `Invalid duration: ${playbackData.durationSeconds}s`,
    };
  }

  let finalItemId = playbackData.itemId || null;
  let finalUserId = playbackData.userId || null;
  let userName = "Unknown User";
  const missingReferences: string[] = [];

  // Check if itemId exists
  if (playbackData.itemId) {
    try {
      const existingItem = await db
        .select({ id: items.id })
        .from(items)
        .where(eq(items.id, playbackData.itemId))
        .limit(1);

      if (existingItem.length === 0) {
        missingReferences.push(`itemId '${playbackData.itemId}' not found`);
        finalItemId = null;
      }
    } catch {
      finalItemId = null;
    }
  }

  // Check if userId exists
  if (playbackData.userId) {
    try {
      const existingUser = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, playbackData.userId))
        .limit(1);

      if (existingUser.length === 0) {
        missingReferences.push(`userId '${playbackData.userId}' not found`);
        finalUserId = null;
      } else {
        userName = existingUser[0].name;
      }
    } catch {
      finalUserId = null;
    }
  }

  // Round duration to integer (database column is integer)
  const durationSeconds = Math.round(playbackData.durationSeconds);

  const endTime = new Date(sessionTime.getTime() + durationSeconds * 1000);

  // Parse play method using new function
  const playParsed = parsePlayMethod(playbackData.playMethod || "");
  const isTranscoded = playParsed.mode === "Transcode";
  const isVideoDirect = playParsed.video === "direct";
  const isAudioDirect = playParsed.audio === "direct";

  // Extract series info for episodes
  let seriesName: string | null = null;
  if (
    playbackData.itemType?.toLowerCase() === "episode" &&
    playbackData.itemName
  ) {
    const episodeInfo = parseEpisodeInfo(playbackData.itemName);
    seriesName = episodeInfo.seriesName;
  }

  // Deterministic ID from content fields so re-importing the same file
  // produces the same IDs and onConflictDoNothing() prevents duplicates
  const sessionId = createHash("sha256")
    .update(
      `${serverId}|${playbackData.userId ?? ""}|${playbackData.itemId ?? ""}|${playbackData.timestamp}|${durationSeconds}`,
    )
    .digest("hex")
    .slice(0, 32);
  const runtimeTicks = durationSeconds * 10000000;
  const positionTicks = runtimeTicks;

  const sessionData: NewSession = {
    id: sessionId,
    serverId: serverId,
    userId: finalUserId,
    itemId: finalItemId,
    userName: userName,
    userServerId: finalUserId,
    itemName: playbackData.itemName || "Unknown Item",
    seriesName: seriesName,
    clientName: playbackData.clientName || "Unknown Client",
    deviceName: playbackData.deviceName || "Unknown Device",
    playMethod: playbackData.playMethod || "Unknown",
    playDuration: durationSeconds,
    startTime: sessionTime,
    endTime: endTime,
    lastActivityDate: endTime,
    runtimeTicks: runtimeTicks,
    positionTicks: positionTicks,
    percentComplete: 100,
    completed: true,
    isPaused: false,
    isMuted: false,
    isActive: false,
    isTranscoded: isTranscoded,
    transcodingIsVideoDirect: isVideoDirect,
    transcodingVideoCodec: isVideoDirect ? null : (playParsed.video ?? null),
    transcodingIsAudioDirect: isAudioDirect,
    transcodingAudioCodec: isAudioDirect ? null : (playParsed.audio ?? null),
    rawData: {
      source: "playback_reporting",
      originalData: playbackData,
      importedAt: new Date().toISOString(),
      missingReferences:
        missingReferences.length > 0 ? missingReferences : undefined,
    },
    createdAt: sessionTime,
    updatedAt: new Date(),
    deviceId: null,
    applicationVersion: null,
    remoteEndPoint: null,
    seriesId: null,
    seasonId: null,
    lastPlaybackCheckIn: null,
    volumeLevel: null,
    audioStreamIndex: null,
    subtitleStreamIndex: null,
    mediaSourceId: null,
    repeatMode: null,
    playbackOrder: null,
    videoCodec: null,
    audioCodec: null,
    resolutionWidth: null,
    resolutionHeight: null,
    videoBitRate: null,
    audioBitRate: null,
    audioChannels: null,
    audioSampleRate: null,
    videoRangeType: null,
    transcodingWidth: null,
    transcodingHeight: null,
    transcodingContainer: null,
    transcodeReasons: null,
  };

  try {
    await db.insert(sessions).values(sessionData).onConflictDoNothing();
  } catch (dbError) {
    const errorMsg =
      dbError instanceof Error ? dbError.message : "Unknown database error";
    return {
      success: false,
      reason: `DB error: ${errorMsg.slice(0, 100)}`,
    };
  }

  return { success: true, reason: "Imported" };
}
