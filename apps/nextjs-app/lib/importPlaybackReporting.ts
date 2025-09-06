"use server";

import { db } from "@streamystats/database";
import {
  sessions,
  type NewSession,
  items,
  users,
} from "@streamystats/database/schema";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

// Types for import state
export interface ImportState {
  type: "success" | "error" | "info" | null;
  message: string;
  importedCount?: number;
  totalCount?: number;
  errorCount?: number;
}

// Interface for Playback Reporting TSV data
interface PlaybackReportingData {
  timestamp: string; // Only timestamp is required
  userId?: string;
  itemId?: string;
  itemType?: string;
  itemName?: string;
  playMethod?: string;
  clientName?: string;
  deviceName?: string;
  durationSeconds?: number;
}

export async function importFromPlaybackReporting(
  prevState: ImportState,
  formData: FormData
): Promise<ImportState> {
  console.info("Starting Playback Reporting import process");

  // Internal validation function
  function validatePlaybackReportingData(data: PlaybackReportingData[]): {
    isValid: boolean;
    error?: string;
  } {
    console.info(
      `Validating playback reporting data with ${data.length} records`
    );

    if (!Array.isArray(data)) {
      const error = "Data must be an array";
      console.error(`Validation failed: ${error}`);
      return { isValid: false, error };
    }

    if (data.length === 0) {
      const error = "Data array is empty";
      console.error(`Validation failed: ${error}`);
      return { isValid: false, error };
    }

    // Check first few items for required fields - only timestamp is truly required
    const sampleSize = Math.min(5, data.length);
    const requiredFields: (keyof PlaybackReportingData)[] = [
      "timestamp", // Only timestamp is required
    ];

    console.info(
      `Validating sample of ${sampleSize} records for required fields: ${requiredFields.join(
        ", "
      )}`
    );

    for (let i = 0; i < sampleSize; i++) {
      const session = data[i];

      if (typeof session !== "object" || session === null) {
        const error = `Invalid session object at index ${i}`;
        console.error(`Validation failed: ${error}`, { session });
        return {
          isValid: false,
          error,
        };
      }

      for (const field of requiredFields) {
        if (!session[field] && session[field] !== 0) {
          const error = `Missing required field "${field}" in session at index ${i}`;
          console.error(`Validation failed: ${error}`, { session });
          return {
            isValid: false,
            error,
          };
        }
      }

      // Validate timestamp
      if (session.timestamp && isNaN(Date.parse(session.timestamp))) {
        const error = `Invalid timestamp format at index ${i}: ${session.timestamp}`;
        console.error(`Validation failed: ${error}`, { session });
        return {
          isValid: false,
          error,
        };
      }

      // Validate duration is a valid number if present
      if (
        session.durationSeconds !== undefined &&
        session.durationSeconds !== null &&
        (typeof session.durationSeconds !== "number" ||
          isNaN(session.durationSeconds))
      ) {
        const error = `Invalid duration format at index ${i}: ${session.durationSeconds}`;
        console.error(`Validation failed: ${error}`, { session });
        return {
          isValid: false,
          error,
        };
      }
    }

    console.info("Data validation completed successfully");
    return { isValid: true };
  }

  try {
    const serverId = formData.get("serverId");
    const file = formData.get("file") as File;

    console.info("Processing import request", {
      serverId,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
    });

    if (!serverId || !file) {
      const error = "Server ID and file are required";
      console.error(`Import failed: ${error}`, {
        serverId: !!serverId,
        file: !!file,
      });
      return {
        type: "error",
        message: error,
      };
    }

    const serverIdNum = Number(serverId);
    if (isNaN(serverIdNum)) {
      const error = "Invalid server ID";
      console.error(`Import failed: ${error}`, { serverId });
      return {
        type: "error",
        message: error,
      };
    }

    console.info(`Reading file content for server ${serverIdNum}`);
    const text = await file.text();
    let data: PlaybackReportingData[];

    // Check if file is JSON or TSV format
    const isJson =
      file.name.endsWith(".json") || file.type === "application/json";

    console.info(`Detected file format: ${isJson ? "JSON" : "TSV"}`);

    try {
      if (isJson) {
        // Parse JSON format
        console.info("Parsing JSON format");
        const jsonData = JSON.parse(text);
        data = parsePlaybackReportingJson(jsonData);
      } else {
        // Parse TSV format
        console.info("Parsing TSV format");
        data = parsePlaybackReportingTsv(text);
      }

      console.info(`Successfully parsed ${data.length} records from file`);
    } catch (error) {
      const errorMessage = `Failed to parse file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      console.error(errorMessage, {
        error,
        fileName: file.name,
        fileType: file.type,
        isJson,
      });
      return {
        type: "error",
        message: errorMessage,
      };
    }

    // Validate data format
    const validationResult = validatePlaybackReportingData(data);
    if (!validationResult.isValid) {
      const error = validationResult.error || "Invalid data format";
      console.error(`Data validation failed: ${error}`);
      return {
        type: "error",
        message: error,
      };
    }

    // Process import
    console.info(
      `Starting import of ${data.length} sessions for server ${serverIdNum}`
    );
    let importedCount = 0;
    const totalCount = data.length;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
      const playbackData = data[i];
      try {
        const imported = await importPlaybackReportingSession(
          playbackData,
          serverIdNum
        );
        if (imported) {
          importedCount++;
          if (importedCount % 100 === 0) {
            console.info(
              `Import progress: ${importedCount}/${totalCount} sessions imported`
            );
          }
        } else {
          console.warn(`Session ${i + 1} was skipped during import`, {
            playbackData,
          });
        }
      } catch (error) {
        errorCount++;
        console.error(`Failed to import session ${i + 1}:`, {
          error: error instanceof Error ? error.message : "Unknown error",
          playbackData,
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Continue with other sessions
      }
    }

    const successMessage = `Successfully imported ${importedCount} of ${totalCount} sessions from Playback Reporting`;
    console.info(successMessage, {
      importedCount,
      totalCount,
      errorCount,
      successRate: Math.round((importedCount / totalCount) * 100),
    });

    return {
      type: "success",
      message: successMessage,
      importedCount: importedCount,
      totalCount: totalCount,
      errorCount: errorCount,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Import failed";
    console.error("Playback Reporting import failed with unexpected error:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      type: "error",
      message: errorMessage,
    };
  }
}

function parsePlaybackReportingTsv(text: string): PlaybackReportingData[] {
  console.info("Starting TSV parsing");
  const lines = text.split("\n").filter((line) => line.trim());
  const data: PlaybackReportingData[] = [];
  let skippedLines = 0;

  console.info(`Processing ${lines.length} lines from TSV file`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split("\t");

    // Expected format: timestamp, userId, itemId, itemType, itemName, playMethod, clientName, deviceName, durationSeconds
    if (columns.length < 9) {
      skippedLines++;
      console.warn(
        `Skipping line ${i + 1}: insufficient columns (${columns.length}/9)`,
        { line: line.substring(0, 100) + (line.length > 100 ? "..." : "") }
      );
      continue;
    }

    try {
      const [
        timestamp,
        userId,
        itemId,
        itemType,
        itemName,
        playMethod,
        clientName,
        deviceName,
        durationSecondsStr,
      ] = columns;

      const durationSeconds = parseInt(durationSecondsStr, 10);
      if (isNaN(durationSeconds)) {
        skippedLines++;
        console.warn(
          `Skipping line ${i + 1}: invalid duration "${durationSecondsStr}"`,
          { line: line.substring(0, 100) + (line.length > 100 ? "..." : "") }
        );
        continue;
      }

      data.push({
        timestamp: timestamp.trim(),
        userId: userId.trim() || undefined,
        itemId: itemId.trim() || undefined,
        itemType: itemType.trim() || undefined,
        itemName: itemName.trim() || undefined,
        playMethod: playMethod.trim() || undefined,
        clientName: clientName.trim() || undefined,
        deviceName: deviceName.trim() || undefined,
        durationSeconds: isNaN(durationSeconds) ? undefined : durationSeconds,
      });
    } catch (error) {
      skippedLines++;
      console.warn(`Error parsing line ${i + 1}:`, {
        error: error instanceof Error ? error.message : "Unknown error",
        line: line.substring(0, 100) + (line.length > 100 ? "..." : ""),
      });
      continue;
    }
  }

  console.info(
    `TSV parsing completed: ${data.length} valid records, ${skippedLines} skipped lines`
  );
  return data;
}

function parsePlaybackReportingJson(jsonData: any): PlaybackReportingData[] {
  console.info("Starting JSON parsing", {
    dataType: typeof jsonData,
    isArray: Array.isArray(jsonData),
  });

  // Handle different JSON formats that might come from Playback Reporting
  if (Array.isArray(jsonData)) {
    console.info(`Processing JSON array with ${jsonData.length} items`);
    return jsonData.map((item, index) => {
      try {
        const durationValue =
          item.durationSeconds || item.duration_seconds || item.Duration || "0";
        const parsedDuration = parseInt(durationValue, 10);

        return {
          timestamp: item.timestamp || item.date || item.time,
          userId: item.userId || item.user_id || item.UserId || undefined,
          itemId: item.itemId || item.item_id || item.ItemId || undefined,
          itemType: item.itemType || item.item_type || item.Type || undefined,
          itemName: item.itemName || item.item_name || item.Name || undefined,
          playMethod:
            item.playMethod || item.play_method || item.PlayMethod || undefined,
          clientName:
            item.clientName || item.client_name || item.Client || undefined,
          deviceName:
            item.deviceName || item.device_name || item.Device || undefined,
          durationSeconds: isNaN(parsedDuration) ? undefined : parsedDuration,
        };
      } catch (error) {
        console.error(`Error parsing JSON item at index ${index}:`, {
          error: error instanceof Error ? error.message : "Unknown error",
          item,
        });
        throw error;
      }
    });
  }

  // If it's not an array, try to extract from a nested structure
  if (jsonData.sessions || jsonData.data) {
    console.info("Found nested data structure, extracting sessions/data");
    return parsePlaybackReportingJson(jsonData.sessions || jsonData.data);
  }

  console.error("Unrecognized JSON format", {
    jsonData: typeof jsonData === "object" ? Object.keys(jsonData) : jsonData,
  });
  throw new Error("Unrecognized JSON format");
}

async function importPlaybackReportingSession(
  playbackData: PlaybackReportingData,
  serverId: number
): Promise<boolean> {
  // Only validate timestamp as required - allow missing users or items
  if (!playbackData.timestamp) {
    console.warn("Skipping session: missing timestamp", { playbackData });
    return false;
  }

  // Parse timestamp
  let sessionTime: Date;
  try {
    sessionTime = new Date(playbackData.timestamp);
    if (isNaN(sessionTime.getTime())) {
      throw new Error("Invalid date");
    }
  } catch (error) {
    console.warn(
      `Skipping session: invalid timestamp "${playbackData.timestamp}"`,
      { playbackData, error }
    );
    return false;
  }

  try {
    // Check if referenced entities exist in the database and handle missing references
    let finalItemId = playbackData.itemId || null;
    let finalUserId = playbackData.userId || null;
    let userName = "Unknown User"; // Default fallback
    const missingReferences: string[] = [];

    // Check if itemId exists in items table
    if (playbackData.itemId) {
      try {
        const existingItem = await db
          .select({ id: items.id })
          .from(items)
          .where(eq(items.id, playbackData.itemId))
          .limit(1);

        if (existingItem.length === 0) {
          missingReferences.push(
            `itemId '${playbackData.itemId}' not found in items table - setting to null`
          );
          finalItemId = null; // Set to null instead of failing
          console.warn("Item reference not found, setting to null:", {
            missingItemId: playbackData.itemId,
            itemName: playbackData.itemName,
            itemType: playbackData.itemType,
          });
        }
      } catch (error) {
        console.error("Error checking itemId existence:", {
          itemId: playbackData.itemId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        missingReferences.push(
          `Failed to verify itemId '${playbackData.itemId}', setting to null: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        finalItemId = null; // Set to null on error
      }
    }

    // Check if userId exists in users table and fetch the user name
    if (playbackData.userId) {
      try {
        const existingUser = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, playbackData.userId))
          .limit(1);

        if (existingUser.length === 0) {
          missingReferences.push(
            `userId '${playbackData.userId}' not found in users table - setting to null`
          );
          finalUserId = null; // Set to null instead of failing
          console.warn("User reference not found, setting to null:", {
            missingUserId: playbackData.userId,
          });
        } else {
          // User exists, use their actual name
          userName = existingUser[0].name;
          console.debug("Found user name for playback reporting session:", {
            userId: playbackData.userId,
            userName: userName,
          });
        }
      } catch (error) {
        console.error("Error checking userId existence:", {
          userId: playbackData.userId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        missingReferences.push(
          `Failed to verify userId '${playbackData.userId}', setting to null: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        finalUserId = null; // Set to null on error
      }
    }

    // Log missing references but continue with the import
    if (missingReferences.length > 0) {
      console.info("Handling missing foreign key references:", {
        originalItemId: playbackData.itemId,
        originalUserId: playbackData.userId,
        finalItemId,
        finalUserId,
        missingReferences,
        itemName: playbackData.itemName,
        timestamp: playbackData.timestamp,
      });
    }

    // Calculate end time based on duration
    const endTime = new Date(
      sessionTime.getTime() + (playbackData.durationSeconds || 0) * 1000
    );

    // Determine if transcoding based on play method
    const playMethod = playbackData.playMethod?.toLowerCase();
    const isTranscoded = playMethod?.includes("transcode") ?? false;

    let videoCodec = null;
    let audioCodec = null;
    if (isTranscoded && playMethod) {
      const videoCodecIdx = playMethod.indexOf("v:");
      if (videoCodecIdx !== -1) {
        videoCodec = playMethod.substring(
          videoCodecIdx + 2, // Skip "v:"
          playMethod.indexOf(" ", videoCodecIdx)
        );
      }
      const audioCodecIdx = playMethod.indexOf("a:");
      if (audioCodecIdx !== -1) {
        audioCodec = playMethod.substring(
          audioCodecIdx + 2, // Skip "a:"
          playMethod.indexOf(")", audioCodecIdx)
        );
      }
    }
    const isVideoDirect = videoCodec === "direct";
    const isAudioDirect = audioCodec === "direct";

    // Extract series information from item name if it's an episode
    let seriesName: string | null = null;
    let seasonInfo: string | null = null;
    if (
      playbackData.itemType?.toLowerCase() === "episode" &&
      playbackData.itemName
    ) {
      // Try to extract series name from patterns like "Series Name - s01e01 - Episode Title"
      const seriesMatch = playbackData.itemName.match(/^(.+?)\s*-\s*s\d+e\d+/i);
      if (seriesMatch) {
        seriesName = seriesMatch[1].trim();
      }

      // Extract season info
      const seasonMatch = playbackData.itemName.match(/s(\d+)e\d+/i);
      if (seasonMatch) {
        seasonInfo = `Season ${seasonMatch[1]}`;
      }
    }

    // Generate a unique session ID
    const sessionId = randomUUID();

    // Convert play duration to position ticks (assuming full playback)
    // Jellyfin uses 10,000,000 ticks per second
    const runtimeTicks = (playbackData.durationSeconds || 0) * 10000000;
    const positionTicks = runtimeTicks; // Assume full playback for completed sessions

    // Create session data - use the validated/nullified itemId and userId
    const sessionData: NewSession = {
      id: sessionId,
      serverId: serverId,
      userId: finalUserId, // Use the validated userId (could be null)
      itemId: finalItemId, // Use the validated itemId (could be null)
      userName: userName, // Fetched from users table or "Unknown User" as fallback
      userServerId: finalUserId, // Use the same validated userId

      // Item information
      itemName: playbackData.itemName || "Unknown Item",
      seriesName: seriesName,

      // Device information
      clientName: playbackData.clientName || "Unknown Client",
      deviceName: playbackData.deviceName || "Unknown Device",

      // Playback information
      playMethod: playbackData.playMethod || "Unknown",
      playDuration: playbackData.durationSeconds || 0,

      // Timing information
      startTime: sessionTime,
      endTime: endTime,
      lastActivityDate: endTime,

      // Playback position
      runtimeTicks: runtimeTicks,
      positionTicks: positionTicks,
      percentComplete: playbackData.durationSeconds ? 100 : 0, // Assume completed sessions if duration exists

      // Playback state - assume completed sessions
      completed: true,
      isPaused: false,
      isMuted: false,
      isActive: false,

      // Transcoding information
      isTranscoded: isTranscoded,
      transcodingIsVideoDirect: isVideoDirect,
      transcodingVideoCodec: isVideoDirect ? null : videoCodec,
      transcodingIsAudioDirect: isAudioDirect,
      transcodingAudioCodec: isAudioDirect ? null : audioCodec,

      // Store the original playback reporting data
      rawData: {
        source: "playback_reporting",
        originalData: playbackData,
        importedAt: new Date().toISOString(),
        missingReferences:
          missingReferences.length > 0 ? missingReferences : undefined,
      },

      // Timestamps
      createdAt: sessionTime,
      updatedAt: new Date(),

      // Fields not available in Playback Reporting data - set to null
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

    await db.insert(sessions).values(sessionData).onConflictDoNothing();

    console.debug("Successfully imported session", {
      sessionId,
      itemName: playbackData.itemName,
      originalUserId: playbackData.userId,
      finalUserId,
      userName,
      originalItemId: playbackData.itemId,
      finalItemId,
      duration: playbackData.durationSeconds,
      timestamp: playbackData.timestamp,
      hadMissingReferences: missingReferences.length > 0,
    });

    return true;
  } catch (error) {
    // Enhanced error logging with foreign key constraint details
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;

    console.error("Database error while importing session:", {
      error: errorMessage,
      stack,
      playbackData,
      serverId,
      foreignKeyAnalysis: {
        itemId: playbackData.itemId,
        userId: playbackData.userId,
        itemName: playbackData.itemName,
        itemType: playbackData.itemType,
        isForeignKeyError: errorMessage.includes("foreign key constraint"),
        constraintName:
          errorMessage.match(/constraint "([^"]+)"/)?.[1] || "unknown",
      },
    });

    // If this is a foreign key constraint error, provide additional context
    if (errorMessage.includes("foreign key constraint")) {
      console.error("Foreign key constraint violation details:", {
        constraintViolated:
          errorMessage.match(/constraint "([^"]+)"/)?.[1] || "unknown",
        attemptedValues: {
          itemId: playbackData.itemId,
          userId: playbackData.userId,
          serverId: serverId,
        },
        suggestion:
          "Even after checking for missing references, a foreign key constraint was violated. This might indicate a constraint on serverId or another field that wasn't checked.",
      });
    }

    throw error; // Re-throw to be caught by the caller
  }
}
