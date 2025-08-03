import { ActiveSession } from "@/lib/db/active-sessions";
import { getServer } from "@/lib/db/server";
import { getMe, isUserAdmin } from "@/lib/db/users";
import { db, items, users } from "@streamystats/database";
import { eq } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serverId = searchParams.get("serverId");
  const requestedUserId = searchParams.get("userId");

  if (!serverId) {
    return new Response("Server ID is required", { status: 400 });
  }

  // Get current user and check admin status
  const currentUser = await getMe();
  const isAdmin = await isUserAdmin();
  
  // Determine which user's sessions to show
  let filterUserId: string | null = null;
  
  if (!isAdmin) {
    // Non-admin users can only see their own sessions
    if (!currentUser) {
      return new Response("Unauthorized", { status: 401 });
    }
    filterUserId = currentUser.id;
  } else if (requestedUserId) {
    // Admin users can request specific user's sessions
    filterUserId = requestedUserId;
  }
  // If admin and no specific user requested, show all sessions (filterUserId remains null)

  const server = await getServer({ serverId });

  if (!server) {
    return new Response(
      JSON.stringify({
        error: "Server not found",
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const response = await fetch(`${server.url}/Sessions`, {
      method: "GET",
      headers: {
        "X-Emby-Token": server.apiKey,
        "Content-Type": "application/json",
      },
    });

    // Pass through the actual status code from Jellyfin for better error handling on the client
    if (!response.ok) {
      const status = response.status;
      let errorMessage = `Jellyfin API returned ${status}`;

      // For common server errors, provide more descriptive messages
      if (status === 502) {
        errorMessage = "Jellyfin server is currently unreachable (Bad Gateway)";
      } else if (status === 503) {
        errorMessage =
          "Jellyfin server is temporarily unavailable (Service Unavailable)";
      } else if (status === 504) {
        errorMessage = "Jellyfin server request timed out (Gateway Timeout)";
      } else if (status === 401) {
        errorMessage =
          "Unauthorized access to Jellyfin server (API key may be invalid)";
      }

      return new Response(
        JSON.stringify({
          error: errorMessage,
          jellyfin_status: status,
          server_connectivity_issue: status >= 500,
        }),
        {
          status: status >= 500 ? 503 : status, // Use 503 for server errors to indicate temporary unavailability
          headers: {
            "Content-Type": "application/json",
            "x-server-connectivity-error": status >= 500 ? "true" : "false",
          },
        }
      );
    }

    const jellyfinSessions: JellyfinSession[] = await response.json();

    // Ensure we have valid data - if not, return an empty array
    if (!Array.isArray(jellyfinSessions)) {
      console.error(
        "Unexpected response format from Jellyfin:",
        jellyfinSessions
      );
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    // Filter sessions by user if required
    const filteredSessions = filterUserId 
      ? jellyfinSessions.filter(session => session.UserId === filterUserId)
      : jellyfinSessions;

    const activeSessions = await Promise.all(
      filteredSessions.map(mapJellyfinSessionToActiveSession)
    );

    return new Response(JSON.stringify(activeSessions), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error fetching Jellyfin sessions:", error);

    // Network errors (like connection refused) will end up here
    return new Response(
      JSON.stringify({
        error: "Failed to fetch sessions from Jellyfin server",
        message: error instanceof Error ? error.message : "Unknown error",
        server_connectivity_issue: true,
      }),
      {
        status: 503, // Service Unavailable
        headers: {
          "Content-Type": "application/json",
          "x-server-connectivity-error": "true",
        },
      }
    );
  }
}

/**
 * Maps a JellyfinSession to an ActiveSession
 */
async function mapJellyfinSessionToActiveSession(
  session: JellyfinSession
): Promise<ActiveSession | null> {
  // Skip sessions without NowPlayingItem
  if (!session.NowPlayingItem) {
    return null;
  }

  const id = session.NowPlayingItem.Id;

  const item = await db.query.items.findFirst({
    where: eq(items.id, id),
  });

  if (!item) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.UserId),
  });

  const positionTicks = session.PlayState.PositionTicks;
  const runtimeTicks = session.NowPlayingItem.RunTimeTicks;

  // Calculate progress percentage
  const progressPercent =
    runtimeTicks > 0 ? Math.round((positionTicks / runtimeTicks) * 100) : 0;

  // Calculate playback duration in seconds
  const playbackDuration = Math.floor(positionTicks / 10000000);

  return {
    sessionKey: session.Id,
    user: user ?? null,
    item,
    client: session.Client,
    deviceName: session.DeviceName,
    deviceId: session.DeviceId,
    positionTicks: positionTicks,
    formattedPosition: formatTicks(positionTicks),
    runtimeTicks: runtimeTicks,
    formattedRuntime: formatTicks(runtimeTicks),
    progressPercent: progressPercent,
    playbackDuration: playbackDuration,
    lastActivityDate: session.LastActivityDate,
    isPaused: session.PlayState.IsPaused,
    playMethod: session.PlayState.PlayMethod || null,
    transcodingInfo: session.TranscodingInfo
      ? {
          videoCodec: session.TranscodingInfo.VideoCodec,
          audioCodec: session.TranscodingInfo.AudioCodec,
          container: session.TranscodingInfo.Container,
          isVideoDirect: session.TranscodingInfo.IsVideoDirect,
          isAudioDirect: session.TranscodingInfo.IsAudioDirect,
          bitrate: session.TranscodingInfo.Bitrate,
          width: session.TranscodingInfo.Width,
          height: session.TranscodingInfo.Height,
          audioChannels: session.TranscodingInfo.AudioChannels,
          hardwareAccelerationType:
            session.TranscodingInfo.HardwareAccelerationType,
          transcodeReasons: session.TranscodingInfo.TranscodeReasons,
        }
      : undefined,
    ipAddress: session.RemoteEndPoint || undefined,
  };
}

export interface JellyfinSession {
  PlayState: {
    PositionTicks: number;
    CanSeek: boolean;
    IsPaused: boolean;
    IsMuted: boolean;
    VolumeLevel: number;
    AudioStreamIndex: number;
    SubtitleStreamIndex: number;
    MediaSourceId: string;
    PlayMethod: string;
    RepeatMode: string;
    PlaybackOrder: string;
  };
  AdditionalUsers: any[];
  RemoteEndPoint: string;
  PlayableMediaTypes: string[];
  Id: string;
  UserId: string;
  UserName: string;
  Client: string;
  LastActivityDate: string;
  LastPlaybackCheckIn: string;
  DeviceName: string;
  NowPlayingItem?: {
    Name: string;
    ServerId: string;
    Id: string;
    DateCreated: string;
    HasSubtitles: boolean;
    Container: string;
    PremiereDate: string;
    ExternalUrls: {
      Name: string;
      Url: string;
    }[];
    Path: string;
    EnableMediaSourceDisplay: boolean;
    ChannelId: string | null;
    Overview: string;
    Taglines: string[];
    Genres: string[];
    CommunityRating: number;
    RunTimeTicks: number;
    ProductionYear: number;
    IndexNumber: number;
    ParentIndexNumber: number;
    ProviderIds: {
      Tvdb?: string;
      Imdb?: string;
      TvRage?: string;
      [key: string]: string | undefined;
    };
    IsHD: boolean;
    IsFolder: boolean;
    ParentId: string;
    Type: string;
    Studios: any[];
    GenreItems: {
      Name: string;
      Id: string;
    }[];
    ParentLogoItemId?: string;
    ParentBackdropItemId?: string;
    ParentBackdropImageTags?: string[];
    LocalTrailerCount: number;
    SeriesName?: string;
    SeriesId?: string;
    SeasonId?: string;
    SpecialFeatureCount: number;
    PrimaryImageAspectRatio: number;
    SeriesPrimaryImageTag?: string;
    SeasonName?: string;
    MediaStreams: any[]; // Simplified to save space
    VideoType: string;
    ImageTags: {
      Primary?: string;
      [key: string]: string | undefined;
    };
    BackdropImageTags: string[];
    ParentLogoImageTag?: string;
    ImageBlurHashes: {
      Primary?: Record<string, string>;
      Logo?: Record<string, string>;
      Thumb?: Record<string, string>;
      Backdrop?: Record<string, string>;
      [key: string]: Record<string, string> | undefined;
    };
    SeriesStudio?: string;
    ParentThumbItemId?: string;
    ParentThumbImageTag?: string;
    Chapters: any[];
    Trickplay?: Record<
      string,
      Record<
        string,
        {
          Width: number;
          Height: number;
          TileWidth: number;
          TileHeight: number;
          ThumbnailCount: number;
          Interval: number;
          Bandwidth: number;
        }
      >
    >;
    LocationType: string;
    MediaType: string;
    Width: number;
    Height: number;
  };
  DeviceId: string;
  ApplicationVersion: string;
  TranscodingInfo?: {
    AudioCodec: string;
    VideoCodec: string;
    Container: string;
    IsVideoDirect: boolean;
    IsAudioDirect: boolean;
    Bitrate: number;
    Width: number;
    Height: number;
    AudioChannels: number;
    HardwareAccelerationType: string;
    TranscodeReasons: string[];
  };
  IsActive: boolean;
  SupportsMediaControl: boolean;
  SupportsRemoteControl: boolean;
  HasCustomDeviceName: boolean;
  PlaylistItemId?: string;
  ServerId: string;
}

/**
 * Formats ticks (100-nanosecond units) to HH:MM:SS format
 */
function formatTicks(ticks: number): string {
  const totalSeconds = Math.floor(ticks / 10000000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
