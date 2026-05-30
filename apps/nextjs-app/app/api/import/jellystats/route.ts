import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { db } from "@streamystats/database";
import type { NewSession } from "@streamystats/database/schema";
import { sessions } from "@streamystats/database/schema";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
// @ts-expect-error - stream-json doesn't have types
import { parser } from "stream-json";
// @ts-expect-error - stream-json doesn't have types
import { streamArray } from "stream-json/streamers/StreamArray";
import { requireAdmin } from "@/lib/api-auth";

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

export async function POST(req: NextRequest) {
  try {
    // Require admin for data import
    const { error } = await requireAdmin();
    if (error) return error;

    const url = new URL(req.url);
    const serverId = url.searchParams.get("serverId");

    if (!serverId) {
      return NextResponse.json(
        { error: "Server ID is required" },
        { status: 400 },
      );
    }

    const serverIdNum = Number(serverId);
    if (Number.isNaN(serverIdNum)) {
      return NextResponse.json({ error: "Invalid server ID" }, { status: 400 });
    }

    if (!req.body) {
      return NextResponse.json({ error: "No body provided" }, { status: 400 });
    }

    const input = Readable.fromWeb(
      req.body as import("stream/web").ReadableStream,
    );
    let processedCount = 0;
    let importedCount = 0;
    let errorCount = 0;
    let isProcessingActivities = false;

    await pipeline(
      input,
      parser(),
      streamArray(),
      async (records: AsyncIterable<{ value: unknown }>) => {
        for await (const { value } of records) {
          // Handle the Jellystats structure: [{ "jf_playback_activity": [...] }]
          if (
            value &&
            typeof value === "object" &&
            "jf_playback_activity" in value
          ) {
            // Found the wrapper object, now process the activities array
            const activities = value.jf_playback_activity;
            if (Array.isArray(activities)) {
              isProcessingActivities = true;
              for (const session of activities) {
                try {
                  const imported = await importSession(
                    session as JellystatsSession,
                    serverIdNum,
                  );
                  if (imported) {
                    importedCount++;
                  }
                  processedCount++;
                } catch (error) {
                  console.error("Failed to import session:", error);
                  errorCount++;
                  processedCount++;
                }
              }
            }
          } else if (!isProcessingActivities) {
            // This might be a direct session object (fallback for different export formats)
            try {
              const imported = await importSession(
                value as JellystatsSession,
                serverIdNum,
              );
              if (imported) {
                importedCount++;
              }
              processedCount++;
            } catch (error) {
              console.error("Failed to import session:", error);
              errorCount++;
              processedCount++;
            }
          }
        }
      },
    );

    if (processedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No valid sessions found. Please check the file format.",
          message: "Import failed - no sessions found",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${importedCount} of ${processedCount} sessions from Jellystats`,
      imported_count: importedCount,
      total_count: processedCount,
      error_count: errorCount,
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

async function importSession(
  session: JellystatsSession,
  serverId: number,
): Promise<boolean> {
  // Skip if already imported
  if (session.imported) {
    return false;
  }

  // Validate only session ID is required - allow null user/item for old sessions
  if (!session.Id) {
    throw new Error("Missing required session ID");
  }

  // Determine item ID based on type - can be null for deleted items
  const itemId = session.EpisodeId || session.NowPlayingItemId || null;
  const itemName = session.NowPlayingItemName || null;

  // Extract media info
  const videoStream = session.MediaStreams?.find((s) => s.Type === "Video");
  const audioStream = session.MediaStreams?.find((s) => s.Type === "Audio");

  // Determine if transcoding occurred
  const isTranscoded =
    session.TranscodingInfo !== null || session.PlayMethod !== "DirectPlay";

  // Calculate play duration in seconds
  const playDuration = Number(session.PlaybackDuration) || 0;

  // Insert session
  const sessionData: NewSession = {
    id: session.Id,
    serverId: serverId,
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
    seriesId: session.EpisodeId ? session.NowPlayingItemId : null, // Use SeriesName as fallback if no proper ID
    seriesName: session.SeriesName || null,
    seasonId: session.SeasonId || null,

    // Playback position and timing
    positionTicks: session.PlayState?.PositionTicks || null,
    lastActivityDate: new Date(session.ActivityDateInserted),
    startTime: new Date(session.ActivityDateInserted),
    endTime: new Date(session.ActivityDateInserted),

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
    transcodingVideoCodec: isTranscoded ? videoStream?.Codec || null : null,
    transcodingAudioCodec: isTranscoded ? audioStream?.Codec || null : null,
    transcodingContainer: isTranscoded ? session.OriginalContainer : null,
    transcodeReasons: isTranscoded ? ["Unknown"] : null,

    // Complete session data for future reference
    rawData: session,
    createdAt: new Date(session.ActivityDateInserted),
  };

  await db.insert(sessions).values(sessionData).onConflictDoNothing();
  return true;
}
