import axios, { AxiosInstance, AxiosResponse } from "axios";
import Bottleneck from "bottleneck";
import pRetry from "p-retry";
import { Server } from "@streamystats/database";
import { JellyfinSession } from "./types";
import { getInternalUrl } from "../utils/server-url";

export interface JellyfinConfig {
  baseURL: string;
  apiKey: string;
  timeout?: number;
  rateLimitPerSecond?: number;
  maxRetries?: number;
}

export interface JellyfinUser {
  Id: string;
  Name: string;
  ServerId?: string;
  LastLoginDate?: string;
  LastActivityDate?: string;
  HasPassword: boolean;
  HasConfiguredPassword: boolean;
  HasConfiguredEasyPassword: boolean;
  EnableAutoLogin: boolean;
  IsAdministrator: boolean;
  IsHidden: boolean;
  IsDisabled: boolean;
  EnableUserPreferenceAccess: boolean;
  EnableRemoteControlOfOtherUsers: boolean;
  EnableSharedDeviceControl: boolean;
  EnableRemoteAccess: boolean;
  EnableLiveTvManagement: boolean;
  EnableLiveTvAccess: boolean;
  EnableMediaPlayback: boolean;
  EnableAudioPlaybackTranscoding: boolean;
  EnableVideoPlaybackTranscoding: boolean;
  EnablePlaybackRemuxing: boolean;
  EnableContentDeletion: boolean;
  EnableContentDownloading: boolean;
  EnableSyncTranscoding: boolean;
  EnableMediaConversion: boolean;
  EnableAllDevices: boolean;
  EnableAllChannels: boolean;
  EnableAllFolders: boolean;
  EnablePublicSharing: boolean;
  InvalidLoginAttemptCount: number;
  LoginAttemptsBeforeLockout: number;
  MaxActiveSessions: number;
  RemoteClientBitrateLimit: number;
  AuthenticationProviderId: string;
  PasswordResetProviderId: string;
  SyncPlayAccess: string;
}

export interface JellyfinLibrary {
  Id: string;
  Name: string;
  CollectionType?: string;
  LibraryOptions?: any;
  RefreshProgress?: number;
  RefreshStatus?: string;
  ServerId?: string;
  IsFolder: boolean;
  ParentId?: string;
  Type: string;
  LocationType: string;
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  ScreenshotImageTags?: string[];
  PrimaryImageAspectRatio?: number;
  Path?: string;
  EnableMediaSourceDisplay?: boolean;
  SortName?: string;
  ForcedSortName?: string;
  MediaType?: string;
}

export interface JellyfinBaseItemDto {
  Id: string;
  Name: string;
  OriginalTitle?: string;
  ServerId?: string;
  ParentId?: string;
  Type: string;
  IsFolder: boolean;
  UserData?: any;
  Video3DFormat?: string;
  PremiereDate?: string;
  CriticRating?: number;
  ProductionYear?: number;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  ProviderIds?: Record<string, string>;
  IsHD?: boolean;
  IsFolder2?: boolean;
  ParentLogoItemId?: string;
  ParentBackdropItemId?: string;
  ParentBackdropImageTags?: string[];
  LocalTrailerCount?: number;
  RemoteTrailerCount?: number;
  SeriesName?: string;
  SeriesId?: string;
  SeasonId?: string;
  SpecialFeatureCount?: number;
  DisplayPreferencesId?: string;
  Status?: string;
  AirTime?: string;
  AirDays?: string[];
  Tags?: string[];
  PrimaryImageAspectRatio?: number;
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  ScreenshotImageTags?: string[];
  ParentLogoImageTag?: string;
  ParentArtItemId?: string;
  ParentArtImageTag?: string;
  SeriesPrimaryImageTag?: string;
  SeriesThumbImageTag?: string;
  ImageBlurHashes?: Record<string, Record<string, string>>;
  SeriesStudio?: string;
  ParentThumbItemId?: string;
  ParentThumbImageTag?: string;
  ParentPrimaryImageItemId?: string;
  ParentPrimaryImageTag?: string;
  Chapters?: any[];
  LocationType: string;
  IsoType?: string;
  MediaType?: string;
  EndDate?: string;
  LockedFields?: string[];
  TrailerCount?: number;
  MovieCount?: number;
  SeriesCount?: number;
  ProgramCount?: number;
  EpisodeCount?: number;
  SongCount?: number;
  AlbumCount?: number;
  ArtistCount?: number;
  MusicVideoCount?: number;
  LockData?: boolean;
  Width?: number;
  Height?: number;
  CameraMake?: string;
  CameraModel?: string;
  Software?: string;
  ExposureTime?: number;
  FocalLength?: number;
  ImageOrientation?: string;
  Aperture?: number;
  ShutterSpeed?: number;
  Latitude?: number;
  Longitude?: number;
  Altitude?: number;
  IsoSpeedRating?: number;
  SeriesTimerId?: string;
  ProgramId?: string;
  ChannelName?: string;
  ChannelNumber?: string;
  ChannelId?: string;
  TimerId?: string;
  ProgramInfo?: any;
  DateCreated?: string;
  Etag?: string;
  Path?: string;
  EnableMediaSourceDisplay?: boolean;
  Overview?: string;
  Taglines?: string[];
  Genres?: string[];
  CommunityRating?: number;
  CumulativeRunTimeTicks?: number;
  RunTimeTicks?: number;
  PlayAccess?: string;
  AspectRatio?: string;
  Resolution?: string;
  OfficialRating?: string;
  CustomRating?: string;
  ChannelType?: string;
  TargetWidth?: number;
  TargetHeight?: number;
  NormalizationGain?: number;
  DefaultIndex?: number;
  HasSubtitles?: boolean;
  PreferredMetadataLanguage?: string;
  PreferredMetadataCountryCode?: string;
  Container?: string;
  SortName?: string;
  ForcedSortName?: string;
  Video3DFormat2?: string;
  DateLastMediaAdded?: string;
  Album?: string;
  CriticRating2?: number;
  ProductionYear2?: number;
  AirsBeforeSeasonNumber?: number;
  AirsAfterSeasonNumber?: number;
  AirsBeforeEpisodeNumber?: number;
  CanDelete?: boolean;
  CanDownload?: boolean;
  HasLyrics?: boolean;
  HasSubtitles2?: boolean;
  PreferredMetadataLanguage2?: string;
  PreferredMetadataCountryCode2?: string;
  SupportsSync?: boolean;
  Container2?: string;
  SortName2?: string;
  ForcedSortName2?: string;
  ExternalUrls?: any[];
  MediaSources?: any[];
  People?: any[];
  Studios?: any[];
  GenreItems?: any[];
  TagItems?: any[];
  ParentId2?: string;
  RemoteTrailers?: any[];
  ProviderIds2?: Record<string, string>;
  IsFolder3?: boolean;
  ParentId3?: string;
  Type2?: string;
  People2?: any[];
  Studios2?: any[];
  GenreItems2?: any[];
  ParentLogoItemId2?: string;
  ParentBackdropItemId2?: string;
  ParentBackdropImageTags2?: string[];
  LocalTrailerCount2?: number;
  UserData2?: any;
  RecursiveItemCount?: number;
  ChildCount?: number;
  SeriesName2?: string;
  SeriesId2?: string;
  SeasonId2?: string;
  SpecialFeatureCount2?: number;
  DisplayPreferencesId2?: string;
  Status2?: string;
  AirTime2?: string;
  AirDays2?: string[];
  Tags2?: string[];
  PrimaryImageAspectRatio2?: number;
  Artists?: string[];
  ArtistItems?: any[];
  AlbumArtist?: string;
  AlbumArtists?: any[];
  SeasonName?: string;
  MediaStreams?: any[];
  VideoType?: string;
  PartCount?: number;
  MediaSourceCount?: number;
  ImageTags2?: Record<string, string>;
  BackdropImageTags2?: string[];
  ScreenshotImageTags2?: string[];
  ParentLogoImageTag2?: string;
  ParentArtItemId2?: string;
  ParentArtImageTag2?: string;
  SeriesPrimaryImageTag2?: string;
  CollectionType?: string;
  DisplayOrder?: string;
  AlbumId?: string;
  AlbumPrimaryImageTag?: string;
  SeriesThumbImageTag2?: string;
  AlbumArtist2?: string;
  AlbumArtists2?: any[];
  SeasonName2?: string;
  MediaStreams2?: any[];
  VideoType2?: string;
  PartCount2?: number;
  MediaSourceCount2?: number;
  // Add any other fields as needed
}

export interface JellyfinActivity {
  Id: string;
  Name: string;
  ShortOverview?: string;
  Type: string;
  Date: string;
  Severity: string;
  UserId?: string;
  ItemId?: string;
}

export interface ItemsResponse {
  Items: JellyfinBaseItemDto[];
  TotalRecordCount: number;
  StartIndex: number;
}

export interface JellyfinItemPeopleDto {
  Id: string;
  People?: any[];
}

export interface MinimalJellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  ProviderIds?: Record<string, string>;
  SeriesId?: string;
  SeriesName?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  ProductionYear?: number;
}

const DEFAULT_ITEM_FIELDS = [
  "DateCreated",
  "Etag",
  "ExternalUrls",
  "Genres",
  "MediaSources",
  "OriginalTitle",
  "Overview",
  "ParentId",
  "Path",
  "PrimaryImageAspectRatio",
  "ProductionYear",
  "SortName",
  "Width",
  "Height",
  "ImageTags",
  "ImageBlurHashes",
  "BackdropImageTags",
  "ParentBackdropImageTags",
  "ParentThumbImageTags",
  "SeriesThumbImageTag",
  "SeriesPrimaryImageTag",
  "Container",
  "PremiereDate",
  "CommunityRating",
  "RunTimeTicks",
  "IsFolder",
  "MediaType",
  "SeriesName",
  "SeriesId",
  "SeasonId",
  "SeasonName",
  "IndexNumber",
  "ParentIndexNumber",
  "VideoType",
  "HasSubtitles",
  "ChannelId",
  "ParentBackdropItemId",
  "ParentThumbItemId",
  "LocationType",
  "ProviderIds",
];

const DEFAULT_IMAGE_TYPES = "Primary,Backdrop,Banner,Thumb";

export class JellyfinClient {
  private client: AxiosInstance;
  private limiter: Bottleneck;
  private config: JellyfinConfig;

  private static readonly RETRY_CONFIG = {
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 10_000,
  } as const;

  constructor(config: JellyfinConfig) {
    this.config = {
      timeout: 60000,
      rateLimitPerSecond: 4,
      maxRetries: 3,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        "X-Emby-Token": this.config.apiKey,
        "Content-Type": "application/json",
      },
    });

    // Set up rate limiting
    this.limiter = new Bottleneck({
      minTime: 1000 / (this.config.rateLimitPerSecond || 10),
      maxConcurrent: 5,
    });
  }

  private async request<T>(
    method: "get" | "post" | "put" | "delete",
    url: string,
    options?: {
      params?: Record<string, unknown>;
      data?: unknown;
      timeoutMs?: number;
      signal?: AbortSignal;
      retries?: number;
    }
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? this.config.timeout;
    const retries = options?.retries ?? (this.config.maxRetries || 3);

    const attempt = async () => {
      const response: AxiosResponse<T> = await this.limiter.schedule(() =>
        this.client.request<T>({
          method,
          url,
          params: options?.params,
          data: options?.data,
          timeout: timeoutMs,
          signal: options?.signal,
        })
      );
      return response.data;
    };

    if (retries <= 0) return attempt();
    return pRetry(attempt, { retries, ...JellyfinClient.RETRY_CONFIG });
  }

  private async makeRequest<T>(
    method: "get" | "post" | "put" | "delete",
    url: string,
    options: { params?: any; data?: any } = {}
  ): Promise<T> {
    return this.request<T>(method, url, {
      params: options.params,
      data: options.data,
    });
  }

  async getUsers(): Promise<JellyfinUser[]> {
    return this.makeRequest<JellyfinUser[]>("get", "/Users");
  }

  async getUser(userId: string): Promise<JellyfinUser> {
    return this.makeRequest<JellyfinUser>("get", `/Users/${userId}`);
  }

  async getLibraries(): Promise<JellyfinLibrary[]> {
    const response = await this.makeRequest<{ Items: JellyfinLibrary[] }>(
      "get",
      "/Library/MediaFolders"
    );

    // Filter out boxsets and playlists like in the Elixir code
    return response.Items.filter(
      (library) =>
        !["boxsets", "playlists"].includes(library.CollectionType || "")
    );
  }

  async getItem(itemId: string): Promise<JellyfinBaseItemDto> {
    return this.makeRequest<JellyfinBaseItemDto>("get", `/Items/${itemId}`, {
      params: {
        Fields: DEFAULT_ITEM_FIELDS.join(","),
        EnableImageTypes: DEFAULT_IMAGE_TYPES,
      },
    });
  }

  async getLibraryId(itemId: string): Promise<string> {
    // First get all libraries to compare against
    const libraries = await this.getLibraries();
    const libraryIds = new Set(libraries.map((lib) => lib.Id));

    return this.findLibraryRecursive(itemId, libraryIds);
  }

  private async findLibraryRecursive(
    itemId: string,
    libraryIds: Set<string>
  ): Promise<string> {
    const response = await this.makeRequest<ItemsResponse>("get", "/Items", {
      params: {
        Fields: "ParentId",
        ids: itemId,
      },
    });

    if (!response.Items.length) {
      throw new Error(`Item not found: ${itemId}`);
    }

    const item = response.Items[0];

    // Check if current item is a library we know about
    if (libraryIds.has(item.Id)) {
      return item.Id;
    }

    // Not a library - check if it has a parent
    if (!item.ParentId) {
      throw new Error("Reached root item without finding a library match");
    }

    // Continue up the hierarchy
    return this.findLibraryRecursive(item.ParentId, libraryIds);
  }

  async getRecentlyAddedItems(
    limit: number = 20
  ): Promise<JellyfinBaseItemDto[]> {
    const response = await this.makeRequest<ItemsResponse>("get", "/Items", {
      params: {
        SortBy: "DateCreated",
        SortOrder: "Descending",
        Recursive: "true",
        Fields: DEFAULT_ITEM_FIELDS.join(","),
        ImageTypeLimit: "1",
        EnableImageTypes: DEFAULT_IMAGE_TYPES,
        Limit: limit.toString(),
      },
    });

    return response.Items;
  }

  async getRecentlyAddedItemsByLibrary(
    libraryId: string,
    limit: number = 20
  ): Promise<JellyfinBaseItemDto[]> {
    const response = await this.makeRequest<ItemsResponse>("get", "/Items", {
      params: {
        SortBy: "DateCreated",
        SortOrder: "Descending",
        Recursive: "true",
        ParentId: libraryId,
        Fields: DEFAULT_ITEM_FIELDS.join(","),
        ImageTypeLimit: "1",
        EnableImageTypes: DEFAULT_IMAGE_TYPES,
        Limit: limit.toString(),
      },
    });

    return response.Items;
  }

  async getItemsPage(
    libraryId: string,
    startIndex: number,
    limit: number,
    imageTypes?: string[]
  ): Promise<{ items: JellyfinBaseItemDto[]; totalCount: number }> {
    const params: any = {
      ParentId: libraryId,
      Recursive: true,
      Fields: DEFAULT_ITEM_FIELDS.join(","),
      StartIndex: startIndex,
      Limit: limit,
      EnableImageTypes: DEFAULT_IMAGE_TYPES,
      IsFolder: false,
      IsPlaceHolder: false,
    };

    if (imageTypes) {
      params.ImageTypes = Array.isArray(imageTypes)
        ? imageTypes.join(",")
        : imageTypes;
    }

    const response = await this.makeRequest<ItemsResponse>("get", "/Items", {
      params,
    });

    return {
      items: response.Items || [],
      totalCount: response.TotalRecordCount || 0,
    };
  }

  async getItemsPeople(ids: string[]): Promise<JellyfinItemPeopleDto[]> {
    if (ids.length === 0) {
      return [];
    }

    const response = await this.makeRequest<ItemsResponse>("get", "/Items", {
      params: {
        ids: ids.join(","),
        Fields: "People",
      },
    });

    return (response.Items || []).map((item) => ({
      Id: item.Id,
      People: item.People,
    }));
  }

  async getItemsWithImages(
    libraryId: string,
    startIndex: number,
    limit: number,
    imageTypes: string[] = ["Primary", "Thumb", "Backdrop"]
  ): Promise<{ items: JellyfinBaseItemDto[]; totalCount: number }> {
    return this.getItemsPage(libraryId, startIndex, limit, imageTypes);
  }

  async getActivities(
    startIndex: number,
    limit: number,
    options?: {
      timeoutMs?: number;
      signal?: AbortSignal;
      retries?: number;
    }
  ): Promise<JellyfinActivity[]> {
    const response = await this.request<{ Items: JellyfinActivity[] }>(
      "get",
      "/System/ActivityLog/Entries",
      {
        params: { startIndex, limit },
        timeoutMs: options?.timeoutMs,
        signal: options?.signal,
        retries: options?.retries,
      }
    );

    return response.Items;
  }

  async getInstalledPlugins(): Promise<any[]> {
    return this.makeRequest<any[]>("get", "/Plugins");
  }

  /**
   * Get server system info. Useful for health checks.
   */
  async getServerInfo(): Promise<{
    ServerName: string;
    Version: string;
    Id: string;
  }> {
    return this.makeRequest<{
      ServerName: string;
      Version: string;
      Id: string;
    }>("get", "/System/Info");
  }

  /**
   * Check if the Jellyfin server is reachable and responding.
   * Returns true if server is healthy, false otherwise.
   */
  async isServerHealthy(): Promise<boolean> {
    try {
      const info = await this.getServerInfo();
      return !!info?.Id;
    } catch {
      return false;
    }
  }

  /**
   * Get active sessions.
   *
   * NOTE: This is used by the session poller and needs to fail fast.
   * We intentionally support per-call timeout/signal and allow overriding retries.
   */
  async getSessions(options?: {
    timeoutMs?: number;
    signal?: AbortSignal;
    retries?: number;
  }): Promise<JellyfinSession[]> {
    return this.request<JellyfinSession[]>("get", "/Sessions", {
      timeoutMs: options?.timeoutMs,
      signal: options?.signal,
      retries: options?.retries ?? 0,
    });
  }

  /**
   * Fetch all items from a library with minimal fields for comparison.
   * Used for detecting deleted items without fetching full metadata.
   */
  async getAllItemsMinimal(
    libraryId: string,
    pageSize: number = 1000
  ): Promise<MinimalJellyfinItem[]> {
    const minimalFields = [
      "ProviderIds",
      "SeriesId",
      "SeriesName",
      "IndexNumber",
      "ParentIndexNumber",
      "ProductionYear",
    ];

    const allItems: MinimalJellyfinItem[] = [];
    let startIndex = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeRequest<ItemsResponse>("get", "/Items", {
        params: {
          ParentId: libraryId,
          Recursive: true,
          Fields: minimalFields.join(","),
          StartIndex: startIndex,
          Limit: pageSize,
          IsFolder: false,
          IsPlaceHolder: false,
        },
      });

      const items = response.Items || [];
      for (const item of items) {
        allItems.push({
          Id: item.Id,
          Name: item.Name,
          Type: item.Type,
          ProviderIds: item.ProviderIds,
          SeriesId: item.SeriesId,
          SeriesName: item.SeriesName,
          IndexNumber: item.IndexNumber,
          ParentIndexNumber: item.ParentIndexNumber,
          ProductionYear: item.ProductionYear,
        });
      }

      startIndex += items.length;
      hasMore = startIndex < response.TotalRecordCount && items.length > 0;
    }

    return allItems;
  }

  /**
   * Fetch all played items for a specific user with UserData.
   * Used for inferring watch history from Jellyfin's played status.
   * Uses minimal fields for efficiency - only what's needed for session creation.
   */
  async getUserPlayedItems(
    userId: string,
    options?: {
      includeItemTypes?: string[];
      pageSize?: number;
    }
  ): Promise<JellyfinBaseItemDto[]> {
    const itemTypes = options?.includeItemTypes ?? ["Movie", "Episode"];
    const pageSize = options?.pageSize ?? 1000; // Match sync page size

    // Minimal fields needed for inferring sessions
    const minimalFields = [
      "UserData", // Contains Played, LastPlayedDate, PlayCount
      "RunTimeTicks", // For calculating play duration
      "SeriesId", // For TV show context
      "SeriesName",
      "SeasonId",
    ];

    const allItems: JellyfinBaseItemDto[] = [];
    let startIndex = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeRequest<ItemsResponse>("get", "/Items", {
        params: {
          UserId: userId,
          Recursive: true,
          Fields: minimalFields.join(","),
          IncludeItemTypes: itemTypes.join(","),
          IsPlayed: true,
          StartIndex: startIndex,
          Limit: pageSize,
          IsFolder: false,
          IsPlaceHolder: false,
        },
      });

      const items = response.Items || [];
      allItems.push(...items);

      startIndex += items.length;
      hasMore = startIndex < response.TotalRecordCount && items.length > 0;
    }

    return allItems;
  }

  // Helper method to create client from server configuration
  static fromServer(server: Server): JellyfinClient {
    return new JellyfinClient({
      baseURL: getInternalUrl(server),
      apiKey: server.apiKey,
    });
  }
}
