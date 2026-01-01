import { db } from "@streamystats/database";
import {
  hiddenRecommendations,
  items,
  type NewSession,
  servers,
  sessions,
  users,
} from "@streamystats/database/schema";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getServerWithSecrets } from "@/lib/db/server";
import { getAuthHeaders } from "@/lib/jellyfin-headers";

type JellyfinSystemInfo = { Id?: string };

function normalizeUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function tryFetchJellyfinSystemId({
  url,
  apiKey,
  server,
}: {
  url: string;
  apiKey: string;
  server?: { id: number; version: string | null };
}): Promise<string | null> {
  try {
    const res = await fetch(`${normalizeUrl(url)}/System/Info`, {
      method: "GET",
      headers: getAuthHeaders(apiKey, server ?? null),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as JellyfinSystemInfo;
    return payload.Id ?? null;
  } catch {
    return null;
  }
}

// Types for the import data format
interface ExportInfo {
  timestamp: string;
  serverName: string;
  serverId: number;
  version: string;
  exportType: string;
}

interface ImportSession {
  id: string;
  serverId: number;
  userId: string | null;
  itemId: string | null;
  userName: string;
  userServerId: string | null;
  deviceId: string | null;
  deviceName: string | null;
  clientName: string | null;
  applicationVersion: string | null;
  remoteEndPoint: string | null;
  itemName: string | null;
  seriesId: string | null;
  seriesName: string | null;
  seasonId: string | null;
  playDuration: number | null;
  startTime: string | null;
  endTime: string | null;
  lastActivityDate: string | null;
  lastPlaybackCheckIn: string | null;
  runtimeTicks: number | null;
  positionTicks: number | null;
  percentComplete: number | null;
  completed: boolean;
  isPaused: boolean;
  isMuted: boolean;
  isActive: boolean;
  volumeLevel: number | null;
  audioStreamIndex: number | null;
  subtitleStreamIndex: number | null;
  playMethod: string | null;
  mediaSourceId: string | null;
  repeatMode: string | null;
  playbackOrder: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  resolutionWidth: number | null;
  resolutionHeight: number | null;
  videoBitRate: number | null;
  audioBitRate: number | null;
  audioChannels: number | null;
  audioSampleRate: number | null;
  videoRangeType: string | null;
  isTranscoded: boolean;
  transcodingWidth: number | null;
  transcodingHeight: number | null;
  transcodingVideoCodec: string | null;
  transcodingAudioCodec: string | null;
  transcodingContainer: string | null;
  transcodingIsVideoDirect: boolean | null;
  transcodingIsAudioDirect: boolean | null;
  transcodingBitrate: number | null;
  transcodingCompletionPercentage: number | null;
  transcodingAudioChannels: number | null;
  transcodingHardwareAccelerationType: string | null;
  transcodeReasons: string[] | null;
  rawData: any;
  createdAt: string;
  updatedAt: string;
}

interface ImportHiddenRecommendation {
  id: number;
  serverId: number;
  userId: string;
  itemId: string;
  createdAt: string;
}

interface ImportData {
  exportInfo: ExportInfo;
  sessions: ImportSession[];
  hiddenRecommendations?: ImportHiddenRecommendation[];
  server: {
    id: number;
    name: string;
    url: string;
    version?: string;
    localAddress?: string | null;
    productName?: string | null;
    operatingSystem?: string | null;
    jellyfinSystemId?: string | null;

    startupWizardCompleted?: boolean;
    autoGenerateEmbeddings?: boolean;
    embeddingProvider?: string | null;
    embeddingBaseUrl?: string | null;
    embeddingModel?: string | null;
    embeddingDimensions?: number | null;
    chatProvider?: string | null;
    chatBaseUrl?: string | null;
    chatModel?: string | null;
    disabledHolidays?: string[] | null;
    excludedUserIds?: string[] | null;
    excludedLibraryIds?: string[] | null;
  };
}

export async function POST(req: NextRequest) {
  try {
    // Require admin for data import
    const { error } = await requireAdmin();
    if (error) return error;

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const serverId = formData.get("serverId") as string;

    if (!file || !serverId) {
      return NextResponse.json(
        { error: "File and serverId are required" },
        { status: 400 },
      );
    }

    // Validate serverId
    const serverIdNum = Number(serverId);
    if (Number.isNaN(serverIdNum)) {
      return NextResponse.json({ error: "Invalid server ID" }, { status: 400 });
    }

    // Verify the target server exists
    const targetServer = await getServerWithSecrets({ serverId: serverIdNum });
    if (!targetServer) {
      return NextResponse.json(
        { error: "Target server not found" },
        { status: 404 },
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".json")) {
      return NextResponse.json(
        { error: "Only JSON files are supported" },
        { status: 400 },
      );
    }

    // Parse the JSON file
    const fileContent = await file.text();
    let importData: ImportData;

    try {
      importData = JSON.parse(fileContent);
    } catch (_error) {
      return NextResponse.json(
        { error: "Invalid JSON format" },
        { status: 400 },
      );
    }

    // Validate the import data structure
    if (
      !importData.exportInfo ||
      !importData.sessions ||
      !Array.isArray(importData.sessions)
    ) {
      return NextResponse.json(
        { error: "Invalid import file format - missing required fields" },
        { status: 400 },
      );
    }

    // Validate export version/type (single supported format)
    const exportVersion = importData.exportInfo.version;
    const exportType = importData.exportInfo.exportType;

    if (exportVersion !== "streamystats") {
      return NextResponse.json(
        {
          error: `Unsupported export version: ${exportVersion}. Expected: streamystats`,
        },
        { status: 400 },
      );
    }

    if (exportType !== "backup") {
      return NextResponse.json(
        {
          error: `Unsupported export type: ${exportType}. Expected: backup`,
        },
        { status: 400 },
      );
    }

    const warnings: string[] = [];

    // Optional: verify this backup targets the same Jellyfin server (preferred over URL matching)
    const forceDifferentServer = formData.get("force") === "true";
    const sourceJellyfinSystemId = importData.server?.jellyfinSystemId ?? null;
    const targetJellyfinSystemId = await tryFetchJellyfinSystemId({
      url: targetServer.url,
      apiKey: targetServer.apiKey,
      server: { id: targetServer.id, version: targetServer.version },
    });

    if (
      sourceJellyfinSystemId &&
      targetJellyfinSystemId &&
      sourceJellyfinSystemId !== targetJellyfinSystemId &&
      !forceDifferentServer
    ) {
      return NextResponse.json(
        {
          error:
            "Backup appears to be from a different Jellyfin server than the selected target. If you're sure, re-run import with force=true.",
        },
        { status: 400 },
      );
    }

    if (!sourceJellyfinSystemId || !targetJellyfinSystemId) {
      warnings.push(
        "Could not verify Jellyfin server identity (missing System/Info Id). Import proceeded without identity validation.",
      );
    }

    // Restore server settings from the backup (never overwrite connection secrets)
    if (exportType === "backup") {
      const update: Partial<typeof servers.$inferInsert> = {};

      if (typeof importData.server.startupWizardCompleted === "boolean") {
        update.startupWizardCompleted =
          importData.server.startupWizardCompleted;
      }
      if (typeof importData.server.autoGenerateEmbeddings === "boolean") {
        update.autoGenerateEmbeddings =
          importData.server.autoGenerateEmbeddings;
      }

      if (importData.server.embeddingProvider !== undefined) {
        update.embeddingProvider = importData.server.embeddingProvider ?? null;
      }
      if (importData.server.embeddingBaseUrl !== undefined) {
        update.embeddingBaseUrl = importData.server.embeddingBaseUrl ?? null;
      }
      if (importData.server.embeddingModel !== undefined) {
        update.embeddingModel = importData.server.embeddingModel ?? null;
      }
      if (importData.server.embeddingDimensions !== undefined) {
        update.embeddingDimensions =
          importData.server.embeddingDimensions ?? null;
      }

      if (importData.server.chatProvider !== undefined) {
        update.chatProvider = importData.server.chatProvider ?? null;
      }
      if (importData.server.chatBaseUrl !== undefined) {
        update.chatBaseUrl = importData.server.chatBaseUrl ?? null;
      }
      if (importData.server.chatModel !== undefined) {
        update.chatModel = importData.server.chatModel ?? null;
      }

      if (Array.isArray(importData.server.disabledHolidays)) {
        update.disabledHolidays = importData.server.disabledHolidays;
      }
      if (Array.isArray(importData.server.excludedUserIds)) {
        update.excludedUserIds = importData.server.excludedUserIds;
      }
      if (Array.isArray(importData.server.excludedLibraryIds)) {
        update.excludedLibraryIds = importData.server.excludedLibraryIds;
      }

      if (Object.keys(update).length > 0) {
        await db
          .update(servers)
          .set({ ...update, updatedAt: new Date() })
          .where(eq(servers.id, serverIdNum));
      }
    }

    // Pre-fetch existing users and items for the target server to avoid FK violations
    const existingUsers = await db.query.users.findMany({
      where: eq(users.serverId, serverIdNum),
      columns: { id: true },
    });
    const existingUserIds = new Set(existingUsers.map((u) => u.id));

    const existingItems = await db.query.items.findMany({
      where: eq(items.serverId, serverIdNum),
      columns: { id: true },
    });
    const existingItemIds = new Set(existingItems.map((i) => i.id));
    // Restore hidden recommendations (non-Jellyfin derived user preferences)
    let hiddenRecommendationsImported = 0;
    let hiddenRecommendationsSkipped = 0;

    if (!Array.isArray(importData.hiddenRecommendations)) {
      warnings.push(
        "Backup file is missing hiddenRecommendations. Skipped restoring hidden recommendations.",
      );
    } else {
      await db
        .delete(hiddenRecommendations)
        .where(eq(hiddenRecommendations.serverId, serverIdNum));

      const rows = importData.hiddenRecommendations
        .filter((r) => existingItemIds.has(r.itemId))
        .map((r) => ({
          serverId: serverIdNum,
          userId: r.userId,
          itemId: r.itemId,
          createdAt: new Date(r.createdAt),
        })) satisfies Array<typeof hiddenRecommendations.$inferInsert>;

      hiddenRecommendationsSkipped =
        importData.hiddenRecommendations.length - rows.length;
      hiddenRecommendationsImported = rows.length;

      if (rows.length > 0) {
        await db.insert(hiddenRecommendations).values(rows);
      }
    }

    // Process and import sessions
    let processedCount = 0;
    let importedCount = 0;
    let errorCount = 0;
    let userIdNullified = 0;
    let itemIdNullified = 0;
    const batchSize = 100; // Process in batches to avoid memory issues

    for (let i = 0; i < importData.sessions.length; i += batchSize) {
      const batch = importData.sessions.slice(i, i + batchSize);
      const sessionBatch: NewSession[] = [];

      for (const importSession of batch) {
        try {
          // Validate foreign key references and nullify if they don't exist
          const validUserId =
            importSession.userId && existingUserIds.has(importSession.userId)
              ? importSession.userId
              : null;

          const validItemId =
            importSession.itemId && existingItemIds.has(importSession.itemId)
              ? importSession.itemId
              : null;

          // Track nullifications for reporting
          if (importSession.userId && !validUserId) {
            userIdNullified++;
          }
          if (importSession.itemId && !validItemId) {
            itemIdNullified++;
          }

          // Convert the import session to the database format
          const sessionData: NewSession = {
            // Keep the original ID to avoid duplicates
            id: importSession.id,

            // Use the target server ID instead of the original
            serverId: serverIdNum,

            // User and item references - use validated IDs or null
            userId: validUserId,
            itemId: validItemId,
            userName: importSession.userName,
            userServerId: importSession.userServerId, // This is not a FK, keep original

            // Device information
            deviceId: importSession.deviceId,
            deviceName: importSession.deviceName,
            clientName: importSession.clientName,
            applicationVersion: importSession.applicationVersion,
            remoteEndPoint: importSession.remoteEndPoint,

            // Media information
            itemName: importSession.itemName,
            seriesId: importSession.seriesId, // Not a FK, keep original
            seriesName: importSession.seriesName,
            seasonId: importSession.seasonId, // Not a FK, keep original

            // Playback timing
            playDuration: importSession.playDuration,
            startTime: importSession.startTime
              ? new Date(importSession.startTime)
              : null,
            endTime: importSession.endTime
              ? new Date(importSession.endTime)
              : null,
            lastActivityDate: importSession.lastActivityDate
              ? new Date(importSession.lastActivityDate)
              : null,
            lastPlaybackCheckIn: importSession.lastPlaybackCheckIn
              ? new Date(importSession.lastPlaybackCheckIn)
              : null,

            // Playback position and progress
            runtimeTicks: importSession.runtimeTicks,
            positionTicks: importSession.positionTicks,
            percentComplete: importSession.percentComplete,

            // Playback state
            completed: importSession.completed,
            isPaused: importSession.isPaused,
            isMuted: importSession.isMuted,
            isActive: importSession.isActive,

            // Audio/Video settings
            volumeLevel: importSession.volumeLevel,
            audioStreamIndex: importSession.audioStreamIndex,
            subtitleStreamIndex: importSession.subtitleStreamIndex,
            playMethod: importSession.playMethod,
            mediaSourceId: importSession.mediaSourceId,
            repeatMode: importSession.repeatMode,
            playbackOrder: importSession.playbackOrder,

            // Media stream information
            videoCodec: importSession.videoCodec,
            audioCodec: importSession.audioCodec,
            resolutionWidth: importSession.resolutionWidth,
            resolutionHeight: importSession.resolutionHeight,
            videoBitRate: importSession.videoBitRate,
            audioBitRate: importSession.audioBitRate,
            audioChannels: importSession.audioChannels,
            audioSampleRate: importSession.audioSampleRate,
            videoRangeType: importSession.videoRangeType,

            // Transcoding information
            isTranscoded: importSession.isTranscoded,
            transcodingWidth: importSession.transcodingWidth,
            transcodingHeight: importSession.transcodingHeight,
            transcodingVideoCodec: importSession.transcodingVideoCodec,
            transcodingAudioCodec: importSession.transcodingAudioCodec,
            transcodingContainer: importSession.transcodingContainer,
            transcodingIsVideoDirect: importSession.transcodingIsVideoDirect,
            transcodingIsAudioDirect: importSession.transcodingIsAudioDirect,
            transcodingBitrate: importSession.transcodingBitrate,
            transcodingCompletionPercentage:
              importSession.transcodingCompletionPercentage,
            transcodingAudioChannels: importSession.transcodingAudioChannels,
            transcodingHardwareAccelerationType:
              importSession.transcodingHardwareAccelerationType,
            transcodeReasons: importSession.transcodeReasons,

            // Raw data and timestamps
            rawData: importSession.rawData,
            createdAt: new Date(importSession.createdAt),
            updatedAt: new Date(importSession.updatedAt),
          };

          sessionBatch.push(sessionData);
          processedCount++;
        } catch (error) {
          console.error(
            `Failed to process session ${importSession.id}:`,
            error,
          );
          errorCount++;
          processedCount++;
        }
      }

      // Insert the batch
      if (sessionBatch.length > 0) {
        try {
          await db.insert(sessions).values(sessionBatch).onConflictDoNothing();
          importedCount += sessionBatch.length;
        } catch (error) {
          console.error("Failed to insert batch:", error);
          errorCount += sessionBatch.length;
        }
      }
    }

    const message =
      `Successfully imported ${importedCount} of ${processedCount} sessions` +
      ` and restored ${hiddenRecommendationsImported} hidden recommendations` +
      ` from ${importData.server.name} to ${targetServer.name}`;

    if (errorCount > 0) {
      console.warn(`Import had ${errorCount} errors`);
    }
    if (userIdNullified > 0) {
      console.warn(
        `Nullified ${userIdNullified} user references (users not found on target server)`,
      );
    }
    if (itemIdNullified > 0) {
      console.warn(
        `Nullified ${itemIdNullified} item references (items not found on target server)`,
      );
    }

    return NextResponse.json({
      success: true,
      message,
      warnings: warnings.length > 0 ? warnings : undefined,
      export_version: importData.exportInfo.version,
      export_type: importData.exportInfo.exportType,
      imported: {
        sessions: importedCount,
        hidden_recommendations: hiddenRecommendationsImported,
      },
      skipped: {
        sessions_processing_errors: errorCount,
        hidden_recommendations: hiddenRecommendationsSkipped,
      },
      imported_count: importedCount,
      total_count: processedCount,
      error_count: errorCount,
      user_references_nullified: userIdNullified,
      item_references_nullified: itemIdNullified,
      source_server: importData.server.name,
      target_server: targetServer.name,
      export_timestamp: importData.exportInfo.timestamp,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Import failed",
        success: false,
      },
      { status: 500 },
    );
  }
}
