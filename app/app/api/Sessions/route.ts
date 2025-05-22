import { ActiveSession, Item, getServer } from "@/lib/db";

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

/**
 * Maps a JellyfinSession to an ActiveSession
 */
function mapJellyfinSessionToActiveSession(
  session: JellyfinSession
): ActiveSession | null {
  // Skip sessions without NowPlayingItem
  if (!session.NowPlayingItem) {
    return null;
  }

  const item: Item = {
    name: session.NowPlayingItem.Name,
    type: session.NowPlayingItem.Type as Item["type"],
    overview: session.NowPlayingItem.Overview || null,
    series_name: session.NowPlayingItem.SeriesName || null,
    season_name: session.NowPlayingItem.SeasonName || null,
    jellyfin_id: session.NowPlayingItem.Id,
    parent_index_number: session.NowPlayingItem.ParentIndexNumber || null,
    index_number: session.NowPlayingItem.IndexNumber || null,
    primary_image_tag: session.NowPlayingItem.ImageTags?.Primary || null,
    backdrop_image_tags: session.NowPlayingItem.BackdropImageTags?.length
      ? session.NowPlayingItem.BackdropImageTags
      : null,
    primary_image_thumb_tag: session.NowPlayingItem.ParentThumbImageTag || null,
    primary_image_logo_tag: session.NowPlayingItem.ParentLogoImageTag || null,
    image_blur_hashes: session.NowPlayingItem.ImageBlurHashes || null,
    primary_image_aspect_ratio:
      session.NowPlayingItem.PrimaryImageAspectRatio || null,
    parent_backdrop_item_id:
      session.NowPlayingItem.ParentBackdropItemId || null,
    parent_backdrop_image_tags: session.NowPlayingItem.ParentBackdropImageTags
      ?.length
      ? session.NowPlayingItem.ParentBackdropImageTags
      : null,
    parent_thumb_item_id: session.NowPlayingItem.ParentThumbItemId || null,
    parent_thumb_image_tag: session.NowPlayingItem.ParentThumbImageTag || null,
    series_primary_image_tag:
      session.NowPlayingItem.SeriesPrimaryImageTag || null,
  };

  const positionTicks = session.PlayState.PositionTicks;
  const runtimeTicks = session.NowPlayingItem.RunTimeTicks;

  // Calculate progress percentage
  const progressPercent =
    runtimeTicks > 0 ? Math.round((positionTicks / runtimeTicks) * 100) : 0;

  // Calculate playback duration in seconds
  const playbackDuration = Math.floor(positionTicks / 10000000);

  return {
    session_key: session.Id,
    user: {
      id: 0, // We don't have this information from Jellyfin directly
      name: session.UserName,
      jellyfin_id: session.UserId,
    },
    item,
    client: session.Client,
    device_name: session.DeviceName,
    device_id: session.DeviceId,
    position_ticks: positionTicks,
    formatted_position: formatTicks(positionTicks),
    runtime_ticks: runtimeTicks,
    formatted_runtime: formatTicks(runtimeTicks),
    progress_percent: progressPercent,
    playback_duration: playbackDuration,
    last_activity_date: session.LastActivityDate,
    is_paused: session.PlayState.IsPaused,
    play_method: session.PlayState.PlayMethod || null,
    transcoding_info: session.TranscodingInfo
      ? {
          video_codec: session.TranscodingInfo.VideoCodec,
          audio_codec: session.TranscodingInfo.AudioCodec,
          container: session.TranscodingInfo.Container,
          is_video_direct: session.TranscodingInfo.IsVideoDirect,
          is_audio_direct: session.TranscodingInfo.IsAudioDirect,
          bitrate: session.TranscodingInfo.Bitrate,
          width: session.TranscodingInfo.Width,
          height: session.TranscodingInfo.Height,
          audio_channels: session.TranscodingInfo.AudioChannels,
          hardware_acceleration_type:
            session.TranscodingInfo.HardwareAccelerationType,
          transcode_reasons: session.TranscodingInfo.TranscodeReasons,
        }
      : undefined,
    ip_address: session.RemoteEndPoint || undefined,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serverId = searchParams.get("serverId");

  if (!serverId) {
    return new Response("Server ID is required", { status: 400 });
  }

  const server = await getServer(serverId);

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
    const response = await fetch(
      `${server.external_url || server.url}/Sessions`,
      {
        method: "GET",
        headers: {
          "X-Emby-Token": server.api_key,
          "Content-Type": "application/json",
        },
      }
    );

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

    const activeSessions = jellyfinSessions
      .map(mapJellyfinSessionToActiveSession)
      .filter((session): session is ActiveSession => session !== null);

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
