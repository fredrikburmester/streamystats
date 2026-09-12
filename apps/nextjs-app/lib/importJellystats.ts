// DEPRECATED: This server action has been replaced by the streaming API route at /api/import/jellystats
// This file is kept for backward compatibility but should not be used for new implementations.
// The new streaming implementation can handle large files (200MB+) efficiently.

import { db } from "@streamystats/database";
import { type NewSession, sessions } from "@streamystats/database/schema";

interface ImportState {
  type: "success" | "error" | "info" | null;
  message: string;
  imported_count?: number;
  total_count?: number;
}

/** ISO-8601 timestamp */
type ISODate = string & { __iso: undefined };

/** Emby/Jellyfin playback methods */
type PlaybackMethod = "DirectPlay" | "DirectStream" | "Transcode";

/** Repeat modes returned by the API */
type RepeatMode = "RepeatNone" | "RepeatOne" | "RepeatAll";

/** Order in which the player advances */
type PlaybackOrder = "Default" | "Shuffle";

/** Core media-stream description (merged superset of all observed keys). */
interface MediaStream {
  Codec: string;
  Type: "Video" | "Audio" | "Subtitle" | "EmbeddedImage" | "Data";
  Index: number;

  Title?: string; // eg. "English Stereo AAC"
  ColorSpace?: string; // bt709 …
  ColorTransfer?: string;
  ColorPrimaries?: string;

  /* optional, sparsely present */
  DisplayTitle?: string;
  CodecTag?: string;
  BitRate?: number;
  BitDepth?: number;
  Height?: number;
  Width?: number;
  Channels?: number;
  ChannelLayout?: string;
  SampleRate?: number;
  Language?: string;
  Profile?: string;
  Level?: number;
  AspectRatio?: string;
  VideoRange?: string;
  AudioSpatialFormat?: string;
  TimeBase?: string;
  IsDefault?: boolean;
  IsForced?: boolean;
  IsInterlaced?: boolean;
  IsAVC?: boolean;
  IsHearingImpaired?: boolean;
  AverageFrameRate?: number;
  RealFrameRate?: number;
  ReferenceFrameRate?: number;
  IsExternal?: boolean;
  IsTextSubtitleStream?: boolean;
  SupportsExternalStream?: boolean;
  PixelFormat?: string;
  RefFrames?: number;
  IsAnamorphic?: boolean;

  NalLengthSize?: string;

  /* local-string labels occasionally present on subtitle/audio tracks */
  LocalizedUndefined?: string;
  LocalizedDefault?: string;
  LocalizedForced?: string;
  LocalizedExternal?: string;
  LocalizedHearingImpaired?: string;

  /** room for yet-unknown properties without losing type-safety elsewhere */
  [k: string]: unknown;
}

interface TranscodingInfo {
  // structure differs per media; use loose typing but avoid `any`
  AudioCodec?: string;
  VideoCodec?: string;
  Container?: string;
  IsVideoDirect?: boolean;
  IsAudioDirect?: boolean;
  [k: string]: unknown;
}

interface PlayState {
  PositionTicks: number; // 100-ns ticks
  CanSeek: boolean;
  IsPaused: boolean;
  IsMuted: boolean;
  AudioStreamIndex: number; // −1 no selection
  SubtitleStreamIndex: number; // −1 no selection
  MediaSourceId: string;
  PlayMethod: PlaybackMethod;
  RepeatMode: RepeatMode;
  PlaybackOrder: PlaybackOrder;
}

interface JellystatsSession {
  Id: string;
  IsPaused: boolean;
  UserId: string;
  UserName: string;
  Client: string;
  DeviceName: string;
  DeviceId: string;
  ApplicationVersion: string;
  NowPlayingItemId: string;
  NowPlayingItemName: string;
  SeasonId?: string | null;
  SeriesName?: string | null;
  EpisodeId?: string | null;
  PlaybackDuration: number; // seconds
  ActivityDateInserted: ISODate;
  PlayMethod: PlaybackMethod;
  MediaStreams: readonly MediaStream[];
  TranscodingInfo?: TranscodingInfo | null;
  PlayState: PlayState;
  OriginalContainer: string; // e.g. "mov,mp4,..."
  RemoteEndPoint: string; // ip/host
  ServerId: string;
  imported?: boolean;
}

export async function importFromJellystats(
  _prevState: ImportState,
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
    let data: JellystatsSession[];

    try {
      data = JSON.parse(text);
    } catch {
      return {
        type: "error",
        message: "Invalid JSON file",
      };
    }

    // Handle Jellystats structure: [{ "jf_playback_activity": [...] }]
    let sessionData: JellystatsSession[];
    if (
      Array.isArray(data) &&
      data.length > 0 &&
      "jf_playback_activity" in data[0]
    ) {
      // Extract sessions from the wrapper structure
      const activities = data[0].jf_playback_activity;
      if (!Array.isArray(activities)) {
        return {
          type: "error",
          message:
            "Invalid Jellystats format: jf_playback_activity is not an array",
        };
      }
      sessionData = activities as JellystatsSession[];
    } else if (Array.isArray(data)) {
      // Fallback for direct array format
      sessionData = data as JellystatsSession[];
    } else {
      return {
        type: "error",
        message:
          "Expected Jellystats export format or array of session objects",
      };
    }

    // Validate data format
    const validationResult = validateJellystatsData(sessionData);
    if (!validationResult.isValid) {
      return {
        type: "error",
        message: validationResult.error || "Invalid data format",
      };
    }

    // Process import
    let importedCount = 0;
    const totalCount = sessionData.length;

    for (const session of sessionData) {
      try {
        // Skip if already imported
        if (session.imported) {
          continue;
        }

        // Validate only session ID is required - allow null user/item for old sessions
        if (!session.Id) {
          console.warn(`Skipping session ${session.Id} - missing session ID`);
          continue;
        }

        // Determine item ID based on type - can be null for deleted items
        const itemId = session.EpisodeId || session.NowPlayingItemId || null;
        const itemName = session.NowPlayingItemName || null;
        const _itemType = session.EpisodeId ? "Episode" : "Movie";

        // Extract media info
        const videoStream = session.MediaStreams?.find(
          (s) => s.Type === "Video",
        );
        const audioStream = session.MediaStreams?.find(
          (s) => s.Type === "Audio",
        );

        // Determine if transcoding occurred
        const isTranscoded =
          session.TranscodingInfo !== null ||
          session.PlayMethod !== "DirectPlay";

        // Calculate play duration in seconds
        const playDuration = Number(session.PlaybackDuration) || 0;

        // Insert session
        const sessionData: NewSession = {
          id: session.Id,
          serverId: serverIdNum,
          userId: session.UserId || null,
          itemId: itemId,
          userName: session.UserName || "Unknown User",
          userServerId: session.UserId || null, // User ID from Jellyfin server
          itemName: itemName,
          clientName: session.Client,
          deviceName: session.DeviceName,
          deviceId: session.DeviceId,
          applicationVersion: session.ApplicationVersion,
          playMethod: session.PlayMethod,
          playDuration: playDuration,
          remoteEndPoint: session.RemoteEndPoint,

          // Series/Season information
          seriesId: session.EpisodeId ? session.SeriesName : null, // Use SeriesName as fallback if no proper ID
          seriesName: session.SeriesName || null,
          seasonId: session.SeasonId || null,

          // Playback position and timing
          positionTicks: session.PlayState?.PositionTicks || null,
          lastActivityDate: new Date(session.ActivityDateInserted),

          // Audio/Video settings from PlayState
          audioStreamIndex: session.PlayState?.AudioStreamIndex ?? null,
          subtitleStreamIndex: session.PlayState?.SubtitleStreamIndex ?? null,
          mediaSourceId: session.PlayState?.MediaSourceId || null,
          repeatMode: session.PlayState?.RepeatMode || null,
          playbackOrder: session.PlayState?.PlaybackOrder || null,

          // Playback state
          completed: false,
          isPaused: session.IsPaused || session.PlayState?.IsPaused || false,
          isMuted: session.PlayState?.IsMuted || false,
          isActive: true,
          isTranscoded: isTranscoded,

          // Media stream information
          videoCodec: videoStream?.Codec || null,
          audioCodec: audioStream?.Codec || null,
          resolutionWidth: videoStream?.Width || null,
          resolutionHeight: videoStream?.Height || null,
          videoBitRate: videoStream?.BitRate || null,
          audioBitRate: audioStream?.BitRate || null,
          audioChannels: audioStream?.Channels || null,
          audioSampleRate: audioStream?.SampleRate || null,
          videoRangeType: videoStream?.VideoRange || null,

          // Transcoding information
          transcodingWidth: isTranscoded ? videoStream?.Width || null : null,
          transcodingHeight: isTranscoded ? videoStream?.Height || null : null,
          transcodingVideoCodec: isTranscoded
            ? videoStream?.Codec || null
            : null,
          transcodingAudioCodec: isTranscoded
            ? audioStream?.Codec || null
            : null,
          transcodingContainer: isTranscoded ? session.OriginalContainer : null,
          transcodeReasons: isTranscoded ? ["Unknown"] : null,

          // Complete session data for future reference
          rawData: session,
          createdAt: new Date(session.ActivityDateInserted),
        };

        await db.insert(sessions).values(sessionData).onConflictDoNothing();

        importedCount++;
      } catch (error) {
        console.error(`Failed to import session ${session.Id}:`, error);
        // Continue with other sessions
      }
    }

    return {
      type: "success",
      message: `Successfully imported ${importedCount} of ${totalCount} sessions from Jellystats`,
      imported_count: importedCount,
      total_count: totalCount,
    };
  } catch (error) {
    return {
      type: "error",
      message: error instanceof Error ? error.message : "Import failed",
    };
  }
}

function validateJellystatsData(data: unknown): {
  isValid: boolean;
  error?: string;
} {
  if (!Array.isArray(data)) {
    return { isValid: false, error: "Data must be an array" };
  }

  if (data.length === 0) {
    return { isValid: false, error: "Data array is empty" };
  }

  // Check first few items for required fields
  const sampleSize = Math.min(5, data.length);
  const requiredFields = [
    "Id",
    "UserName", // Keep UserName as fallback even if UserId is missing
    "PlaybackDuration",
    "ActivityDateInserted",
    "PlayMethod",
  ];

  for (let i = 0; i < sampleSize; i++) {
    const item = data[i];
    if (typeof item !== "object" || item === null) {
      return {
        isValid: false,
        error: `Item at index ${i} is not an object`,
      };
    }

    const session = item as Record<string, unknown>;

    for (const field of requiredFields) {
      if (!(field in session)) {
        return {
          isValid: false,
          error: `Missing required field "${field}" in session at index ${i}`,
        };
      }
    }

    // Validate date format
    if (
      session.ActivityDateInserted &&
      typeof session.ActivityDateInserted === "string" &&
      Number.isNaN(Date.parse(session.ActivityDateInserted))
    ) {
      return {
        isValid: false,
        error: `Invalid date format for ActivityDateInserted at index ${i}`,
      };
    }

    // Validate duration is a number
    if (
      session.PlaybackDuration &&
      Number.isNaN(Number(session.PlaybackDuration))
    ) {
      return {
        isValid: false,
        error: `Invalid PlaybackDuration format at index ${i}`,
      };
    }
  }

  return { isValid: true };
}
