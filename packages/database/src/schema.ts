import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  bigint,
  doublePrecision,
  index,
  unique,
  customType,
  primaryKey,
} from "drizzle-orm/pg-core";

// Custom vector type that supports variable dimensions
// This allows storing embeddings of any size without hardcoding dimensions
const vector = customType<{
  data: number[];
  driverData: string;
}>({
  dataType() {
    return "vector";
  },
  fromDriver(value: string): number[] {
    // pgvector returns vectors as strings like "[1,2,3]"
    return value
      .slice(1, -1)
      .split(",")
      .map((v) => Number.parseFloat(v.trim()));
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
});

// Custom tsvector type for full-text search
// This column is populated by triggers in the database
const tsvector = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return "tsvector";
  },
  fromDriver(value: string): string {
    return value;
  },
  toDriver(value: string): string {
    return value;
  },
});
import { relations } from "drizzle-orm";

// =============================================================================
// Shared JSON Types
// =============================================================================

/**
 * Image blur hashes from Jellyfin API - nested object structure where:
 * - First level keys are image types (Primary, Backdrop, Thumb, Logo, etc.)
 * - Second level keys are image tags (unique identifiers for each image)
 * - Values are blur hash strings
 */
export type ImageBlurHashes = {
  Primary?: Record<string, string>;
  Backdrop?: Record<string, string>;
  Thumb?: Record<string, string>;
  Logo?: Record<string, string>;
  Art?: Record<string, string>;
  Banner?: Record<string, string>;
  Disc?: Record<string, string>;
  Box?: Record<string, string>;
  Screenshot?: Record<string, string>;
  Menu?: Record<string, string>;
  Chapter?: Record<string, string>;
  BoxRear?: Record<string, string>;
  Profile?: Record<string, string>;
};

/**
 * Embedding job result data stored in job_results table
 */
export type EmbeddingJobResult = {
  serverId: number;
  processed?: number;
  total?: number;
  lastHeartbeat?: string;
  error?: string;
  cleanedAt?: string;
  staleDuration?: number;
  originalJobId?: string;
  staleSince?: string;
};

// =============================================================================
// Tables
// =============================================================================

// Servers table - main server configurations
export const servers = pgTable(
  "servers",
  {
    id: serial("id").primaryKey(),
    jellyfinId: text("jellyfin_id"), // Unique Jellyfin server ID from /System/Info
    name: text("name").notNull(),
    url: text("url").notNull(),
    apiKey: text("api_key").notNull(),
    lastSyncedPlaybackId: bigint("last_synced_playback_id", { mode: "number" })
      .notNull()
      .default(0),
    localAddress: text("local_address"),
    internalUrl: text("internal_url"),
    version: text("version"),
    productName: text("product_name"),
    operatingSystem: text("operating_system"),
    startupWizardCompleted: boolean("startup_wizard_completed")
      .notNull()
      .default(false),
    autoGenerateEmbeddings: boolean("auto_generate_embeddings")
      .notNull()
      .default(false),
    testMigrationField: text("test_migration_field"),

    // Generic embedding configuration
    // Supports any OpenAI-compatible API: OpenAI, Azure, Together AI, Fireworks, LocalAI, Ollama, vLLM, etc.
    embeddingProvider: text("embedding_provider"), // "openai-compatible" | "ollama"
    embeddingBaseUrl: text("embedding_base_url"),
    embeddingApiKey: text("embedding_api_key"),
    embeddingModel: text("embedding_model"),
    embeddingDimensions: integer("embedding_dimensions").default(1536),

    // AI Chat configuration (separate from embedding AI)
    // Supports OpenAI-compatible, Anthropic, Ollama, etc.
    chatProvider: text("chat_provider"), // "openai-compatible" | "ollama" | "anthropic"
    chatBaseUrl: text("chat_base_url"),
    chatApiKey: text("chat_api_key"),
    chatModel: text("chat_model"),

    // Sync status tracking
    syncStatus: text("sync_status").notNull().default("pending"), // pending, syncing, completed, failed
    syncProgress: text("sync_progress").notNull().default("not_started"), // not_started, users, libraries, items, activities, completed
    syncError: text("sync_error"),
    lastSyncStarted: timestamp("last_sync_started"),
    lastSyncCompleted: timestamp("last_sync_completed"),

    // Holiday/seasonal recommendations settings
    disabledHolidays: text("disabled_holidays").array().default([]),

    // Statistics exclusion settings
    // Users and libraries in these arrays will be hidden from all statistics
    excludedUserIds: text("excluded_user_ids").array().default([]),
    excludedLibraryIds: text("excluded_library_ids").array().default([]),

    // Embedding job control - set to true to stop a running embedding job
    embeddingStopRequested: boolean("embedding_stop_requested")
      .notNull()
      .default(false),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique("servers_url_unique").on(table.url)]
);

export const libraries = pgTable("libraries", {
  id: text("id").primaryKey(), // External library ID from server
  name: text("name").notNull(),
  type: text("type").notNull(), // Movie, TV, Music, etc.
  serverId: integer("server_id")
    .notNull()
    .references(() => servers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Users table - users from various servers
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // External user ID from server
    name: text("name").notNull(),
    serverId: integer("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    lastLoginDate: timestamp("last_login_date", { withTimezone: true }),
    lastActivityDate: timestamp("last_activity_date", { withTimezone: true }),
    hasPassword: boolean("has_password").notNull().default(false),
    hasConfiguredPassword: boolean("has_configured_password")
      .notNull()
      .default(false),
    hasConfiguredEasyPassword: boolean("has_configured_easy_password")
      .notNull()
      .default(false),
    enableAutoLogin: boolean("enable_auto_login").notNull().default(false),
    isAdministrator: boolean("is_administrator").notNull().default(false),
    isHidden: boolean("is_hidden").notNull().default(false),
    isDisabled: boolean("is_disabled").notNull().default(false),
    enableUserPreferenceAccess: boolean("enable_user_preference_access")
      .notNull()
      .default(true),
    enableRemoteControlOfOtherUsers: boolean(
      "enable_remote_control_of_other_users"
    )
      .notNull()
      .default(false),
    enableSharedDeviceControl: boolean("enable_shared_device_control")
      .notNull()
      .default(false),
    enableRemoteAccess: boolean("enable_remote_access").notNull().default(true),
    enableLiveTvManagement: boolean("enable_live_tv_management")
      .notNull()
      .default(false),
    enableLiveTvAccess: boolean("enable_live_tv_access").notNull().default(true),
    enableMediaPlayback: boolean("enable_media_playback").notNull().default(true),
    enableAudioPlaybackTranscoding: boolean("enable_audio_playback_transcoding")
      .notNull()
      .default(true),
    enableVideoPlaybackTranscoding: boolean("enable_video_playback_transcoding")
      .notNull()
      .default(true),
    enablePlaybackRemuxing: boolean("enable_playback_remuxing")
      .notNull()
      .default(true),
    enableContentDeletion: boolean("enable_content_deletion")
      .notNull()
      .default(false),
    enableContentDownloading: boolean("enable_content_downloading")
      .notNull()
      .default(false),
    enableSyncTranscoding: boolean("enable_sync_transcoding")
      .notNull()
      .default(true),
    enableMediaConversion: boolean("enable_media_conversion")
      .notNull()
      .default(false),
    enableAllDevices: boolean("enable_all_devices").notNull().default(true),
    enableAllChannels: boolean("enable_all_channels").notNull().default(true),
    enableAllFolders: boolean("enable_all_folders").notNull().default(true),
    enablePublicSharing: boolean("enable_public_sharing")
      .notNull()
      .default(false),
    invalidLoginAttemptCount: integer("invalid_login_attempt_count")
      .notNull()
      .default(0),
    loginAttemptsBeforeLockout: integer("login_attempts_before_lockout")
      .notNull()
      .default(3),
    maxActiveSessions: integer("max_active_sessions").notNull().default(0),
    remoteClientBitrateLimit: integer("remote_client_bitrate_limit")
      .notNull()
      .default(0),
    authenticationProviderId: text("authentication_provider_id")
      .notNull()
      .default(
        "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider"
      ),
    passwordResetProviderId: text("password_reset_provider_id")
      .notNull()
      .default(
        "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider"
      ),
    syncPlayAccess: text("sync_play_access")
      .notNull()
      .default("CreateAndJoinGroups"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),

    // Full-text search vector - populated by database trigger
    searchVector: tsvector("search_vector"),
  },
  (table) => [
    index("users_server_id_idx").on(table.serverId),
    index("users_search_vector_idx").using("gin", table.searchVector),
  ]
);

// Activities table - user activities and server events
export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(), // External activity ID from server
    name: text("name").notNull(),
    shortOverview: text("short_overview"),
    type: text("type").notNull(), // ActivityType enum from server
    date: timestamp("date", { withTimezone: true }).notNull(),
    severity: text("severity").notNull(), // Info, Warn, Error
    serverId: integer("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }), // Optional, some activities aren't user-specific
    itemId: text("item_id"), // Optional, media item ID from server
    createdAt: timestamp("created_at").defaultNow().notNull(),

    // Full-text search vector - populated by database trigger
    searchVector: tsvector("search_vector"),
  },
  (table) => [
    index("activities_server_id_idx").on(table.serverId),
    index("activities_search_vector_idx").using("gin", table.searchVector),
  ]
);

// Job results table
export const jobResults = pgTable("job_results", {
  id: serial("id").primaryKey(),
  jobId: varchar("job_id", { length: 255 }).notNull(),
  jobName: varchar("job_name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(), // 'completed', 'failed', 'processing'
  result: jsonb("result"),
  error: text("error"),
  processingTime: integer("processing_time"), // in milliseconds (capped at 1 hour)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Server job configurations table - per-server cron job settings
export const serverJobConfigurations = pgTable(
  "server_job_configurations",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    jobKey: text("job_key").notNull(),
    cronExpression: text("cron_expression"), // null = use default (for cron-based jobs)
    intervalSeconds: integer("interval_seconds"), // null = use default (for interval-based jobs like session-polling)
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("server_job_config_unique").on(table.serverId, table.jobKey),
    index("server_job_config_server_idx").on(table.serverId),
  ]
);

// Items table - media items within servers
export const items = pgTable(
  "items",
  {
    // Primary key and relationships
    id: text("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    libraryId: text("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),

    // Core metadata fields
    name: text("name").notNull(),
    type: text("type").notNull(), // Movie, Episode, Series, etc.
    originalTitle: text("original_title"),
    etag: text("etag"),
    dateCreated: timestamp("date_created", { withTimezone: true }),
    container: text("container"),
    sortName: text("sort_name"),
    premiereDate: timestamp("premiere_date", { withTimezone: true }),
    path: text("path"),
    officialRating: text("official_rating"),
    overview: text("overview"),

    // Ratings and metrics
    communityRating: doublePrecision("community_rating"),
    runtimeTicks: bigint("runtime_ticks", { mode: "number" }),
    productionYear: integer("production_year"),

    // Structure and hierarchy
    isFolder: boolean("is_folder").notNull(),
    parentId: text("parent_id"),
    mediaType: text("media_type"),

    // Video specifications
    width: integer("width"),
    height: integer("height"),

    // Series/TV specific fields
    seriesName: text("series_name"),
    seriesId: text("series_id"),
    seasonId: text("season_id"),
    seasonName: text("season_name"),
    indexNumber: integer("index_number"), // Episode number
    parentIndexNumber: integer("parent_index_number"), // Season number

    // Media details
    videoType: text("video_type"),
    hasSubtitles: boolean("has_subtitles"),
    channelId: text("channel_id"),
    locationType: text("location_type"),
    genres: text("genres").array(),

    // Image metadata
    primaryImageAspectRatio: doublePrecision("primary_image_aspect_ratio"),
    primaryImageTag: text("primary_image_tag"),
    seriesPrimaryImageTag: text("series_primary_image_tag"),
    primaryImageThumbTag: text("primary_image_thumb_tag"),
    primaryImageLogoTag: text("primary_image_logo_tag"),
    parentThumbItemId: text("parent_thumb_item_id"),
    parentThumbImageTag: text("parent_thumb_image_tag"),
    parentLogoItemId: text("parent_logo_item_id"),
    parentLogoImageTag: text("parent_logo_image_tag"),
    backdropImageTags: text("backdrop_image_tags").array(),
    parentBackdropItemId: text("parent_backdrop_item_id"),
    parentBackdropImageTags: text("parent_backdrop_image_tags").array(),
    imageBlurHashes: jsonb("image_blur_hashes").$type<ImageBlurHashes>(),
    imageTags: jsonb("image_tags").$type<Record<string, string>>(),

    // Media capabilities and permissions
    canDelete: boolean("can_delete"),
    canDownload: boolean("can_download"),
    playAccess: text("play_access"),
    isHD: boolean("is_hd"),

    // External metadata
    providerIds: jsonb("provider_ids"),
    tags: text("tags").array(),
    seriesStudio: text("series_studio"),

    // Hybrid approach - complete BaseItemDto storage
    rawData: jsonb("raw_data").notNull(), // Full Jellyfin BaseItemDto

    // AI and processing
    // Vector column without fixed dimension - supports any embedding model
    // Dimension is determined by the server's embeddingDimensions config
    embedding: vector("embedding"),
    processed: boolean("processed").default(false),
    peopleSynced: boolean("people_synced").default(false),
    mediaSourcesSynced: boolean("media_sources_synced").default(false),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),

    // Soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    // Full-text search vector - populated by database trigger
    // Contains: name, originalTitle, overview, seriesName, genres, people (actors/directors)
    searchVector: tsvector("search_vector"),
  },
  // Note: Vector index must be created manually per dimension using:
  // CREATE INDEX items_embedding_idx ON items USING hnsw ((embedding::vector(N)) vector_cosine_ops)
  // WHERE vector_dims(embedding) = N;
  (table) => [
    index("items_server_type_idx").on(table.serverId, table.type),
    index("items_series_id_idx").on(table.seriesId),
    index("items_search_vector_idx").using("gin", table.searchVector),
  ]
);

// Media sources table - file information for items (size, bitrate, etc.)
export const mediaSources = pgTable(
  "media_sources",
  {
    id: text("id").primaryKey(), // MediaSource ID from Jellyfin
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    serverId: integer("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),

    // Core fields for statistics
    size: bigint("size", { mode: "number" }), // File size in bytes
    bitrate: integer("bitrate"),
    container: text("container"),

    // Additional useful fields
    name: text("name"),
    path: text("path"),
    isRemote: boolean("is_remote"),
    runtimeTicks: bigint("runtime_ticks", { mode: "number" }),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("media_sources_item_id_idx").on(table.itemId),
    index("media_sources_server_id_idx").on(table.serverId),
  ]
);

// Sessions table - user sessions and playback information
export const sessions = pgTable(
  "sessions",
  {
    // Primary key and relationships
    id: text("id").primaryKey(), // Session ID from Jellyfin or generated UUID
    serverId: integer("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    itemId: text("item_id").references(() => items.id, {
      onDelete: "set null",
    }),

    // User information
    userName: text("user_name").notNull(),
    userServerId: text("user_server_id"), // User ID from Jellyfin server

    // Device information
    deviceId: text("device_id"),
    deviceName: text("device_name"),
    clientName: text("client_name"),
    applicationVersion: text("application_version"),
    remoteEndPoint: text("remote_end_point"),

    // Media item information
    itemName: text("item_name"),
    seriesId: text("series_id"),
    seriesName: text("series_name"),
    seasonId: text("season_id"),

    // Playback timing
    playDuration: integer("play_duration"), // in seconds
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    lastActivityDate: timestamp("last_activity_date", { withTimezone: true }),
    lastPlaybackCheckIn: timestamp("last_playback_check_in", {
      withTimezone: true,
    }),

    // Playback position and progress
    runtimeTicks: bigint("runtime_ticks", { mode: "number" }),
    positionTicks: bigint("position_ticks", { mode: "number" }),
    percentComplete: doublePrecision("percent_complete"),

    // Playback state
    completed: boolean("completed").notNull(),
    isPaused: boolean("is_paused").notNull(),
    isMuted: boolean("is_muted").notNull(),
    isActive: boolean("is_active").notNull(),

    // Audio/Video settings
    volumeLevel: integer("volume_level"),
    audioStreamIndex: integer("audio_stream_index"),
    subtitleStreamIndex: integer("subtitle_stream_index"),
    playMethod: text("play_method"), // DirectPlay, DirectStream, Transcode
    mediaSourceId: text("media_source_id"),
    repeatMode: text("repeat_mode"),
    playbackOrder: text("playback_order"),

    // Media stream information
    videoCodec: text("video_codec"),
    audioCodec: text("audio_codec"),
    resolutionWidth: integer("resolution_width"),
    resolutionHeight: integer("resolution_height"),
    videoBitRate: integer("video_bit_rate"),
    audioBitRate: integer("audio_bit_rate"),
    audioChannels: integer("audio_channels"),
    audioSampleRate: integer("audio_sample_rate"),
    videoRangeType: text("video_range_type"),

    // Inferred sessions (created from Jellyfin UserData.Played, not real playback)
    isInferred: boolean("is_inferred").notNull().default(false),

    // Transcoding information
    isTranscoded: boolean("is_transcoded").notNull().default(false),
    transcodingWidth: integer("transcoding_width"),
    transcodingHeight: integer("transcoding_height"),
    transcodingVideoCodec: text("transcoding_video_codec"),
    transcodingAudioCodec: text("transcoding_audio_codec"),
    transcodingContainer: text("transcoding_container"),
    transcodingIsVideoDirect: boolean("transcoding_is_video_direct"),
    transcodingIsAudioDirect: boolean("transcoding_is_audio_direct"),
    transcodingBitrate: integer("transcoding_bitrate"),
    transcodingCompletionPercentage: doublePrecision(
      "transcoding_completion_percentage"
    ),
    transcodingAudioChannels: integer("transcoding_audio_channels"),
    transcodingHardwareAccelerationType: text(
      "transcoding_hardware_acceleration_type"
    ),
    transcodeReasons: text("transcode_reasons").array(),

    // Hybrid approach - complete session data
    rawData: jsonb("raw_data").notNull(), // Full Jellyfin session data

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Performance indexes for common query patterns
    index("sessions_server_user_idx").on(table.serverId, table.userId),
    index("sessions_server_item_idx").on(table.serverId, table.itemId),
    index("sessions_server_created_at_idx").on(table.serverId, table.createdAt),
    index("sessions_server_start_time_idx").on(table.serverId, table.startTime),
    index("sessions_user_start_time_idx").on(table.userId, table.startTime),
  ]
);

// Active sessions table - durable storage for currently open sessions (poller state)
export const activeSessions = pgTable(
  "active_sessions",
  {
    serverId: integer("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    sessionKey: text("session_key").notNull(),
    payload: jsonb("payload").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.serverId, table.sessionKey] }),
    index("active_sessions_server_last_seen_idx").on(table.serverId, table.lastSeenAt),
  ]
);

// Activity log cursor per server - used to catch up Jellyfin activity log entries between polls
export const activityLogCursors = pgTable("activity_log_cursors", {
  serverId: integer("server_id")
    .primaryKey()
    .references(() => servers.id, { onDelete: "cascade" }),
  cursorDate: timestamp("cursor_date", { withTimezone: true }),
  cursorId: text("cursor_id"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Hidden recommendations table - stores user's hidden recommendations
export const hiddenRecommendations = pgTable("hidden_recommendations", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id")
    .references(() => servers.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id").notNull(), // Jellyfin user ID
  itemId: text("item_id")
    .references(() => items.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Activity locations table - geolocated IP data for activities
export const activityLocations = pgTable(
  "activity_locations",
  {
    id: serial("id").primaryKey(),
    activityId: text("activity_id")
      .references(() => activities.id, { onDelete: "cascade" })
      .notNull(),
    ipAddress: text("ip_address").notNull(),

    // Geolocation data
    countryCode: text("country_code"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    timezone: text("timezone"),

    // IP classification
    isPrivateIp: boolean("is_private_ip").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("activity_locations_activity_id_idx").on(table.activityId),
    index("activity_locations_ip_address_idx").on(table.ipAddress),
  ]
);

// User fingerprints table - aggregated behavioral patterns per user
export const userFingerprints = pgTable(
  "user_fingerprints",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    serverId: integer("server_id")
      .references(() => servers.id, { onDelete: "cascade" })
      .notNull(),

    // Known patterns (JSONB arrays)
    knownDeviceIds: jsonb("known_device_ids").$type<string[]>().default([]),
    knownCountries: jsonb("known_countries").$type<string[]>().default([]),
    knownCities: jsonb("known_cities").$type<string[]>().default([]),
    knownClients: jsonb("known_clients").$type<string[]>().default([]),

    // Location patterns with frequency
    locationPatterns: jsonb("location_patterns")
      .$type<
        Array<{
          country: string;
          city: string | null;
          latitude: number | null;
          longitude: number | null;
          sessionCount: number;
          lastSeenAt: string;
        }>
      >()
      .default([]),

    // Device patterns with frequency
    devicePatterns: jsonb("device_patterns")
      .$type<
        Array<{
          deviceId: string;
          deviceName: string | null;
          clientName: string | null;
          sessionCount: number;
          lastSeenAt: string;
        }>
      >()
      .default([]),

    // Behavioral patterns - hourly activity histogram (hour 0-23 -> session count)
    hourHistogram: jsonb("hour_histogram")
      .$type<Record<number, number>>()
      .default({}),
    avgSessionsPerDay: doublePrecision("avg_sessions_per_day"),
    totalSessions: integer("total_sessions").default(0),

    lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("user_fingerprints_user_id_idx").on(table.userId),
    index("user_fingerprints_server_id_idx").on(table.serverId),
    unique("user_fingerprints_user_server_unique").on(
      table.userId,
      table.serverId
    ),
  ]
);

// Anomaly events table - flagged suspicious activity
export const anomalyEvents = pgTable(
  "anomaly_events",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    serverId: integer("server_id")
      .references(() => servers.id, { onDelete: "cascade" })
      .notNull(),
    activityId: text("activity_id").references(() => activities.id, {
      onDelete: "set null",
    }),

    // Anomaly classification
    anomalyType: text("anomaly_type").notNull(), // 'impossible_travel', 'new_location', 'concurrent_streams', 'new_device', 'new_country'
    severity: text("severity").notNull(), // 'low', 'medium', 'high', 'critical'

    // Anomaly details
    details: jsonb("details")
      .$type<{
        description: string;
        previousLocation?: {
          country: string;
          city: string | null;
          latitude: number | null;
          longitude: number | null;
          activityId?: string;
          activityTime?: string;
        };
        currentLocation?: {
          country: string;
          city: string | null;
          latitude: number | null;
          longitude: number | null;
          activityId?: string;
          activityTime?: string;
        };
        distanceKm?: number;
        timeDiffMinutes?: number;
        speedKmh?: number;
        deviceId?: string;
        deviceName?: string;
        clientName?: string;
        previousActivityId?: string;
      }>()
      .notNull(),

    // Resolution status
    resolved: boolean("resolved").default(false).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
    resolutionNote: text("resolution_note"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("anomaly_events_user_id_idx").on(table.userId),
    index("anomaly_events_server_id_idx").on(table.serverId),
    index("anomaly_events_activity_id_idx").on(table.activityId),
    index("anomaly_events_anomaly_type_idx").on(table.anomalyType),
    index("anomaly_events_resolved_idx").on(table.resolved),
  ]
);

// People table - unique people (actors, directors, etc.) per server
// Note: type is stored per item-person relationship in item_people, not here
export const people = pgTable(
  "people",
  {
    id: text("id").notNull(), // Jellyfin person ID
    serverId: integer("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    primaryImageTag: text("primary_image_tag"),
    searchVector: tsvector("search_vector"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.serverId] }),
    index("people_name_trgm_idx").using(
      "gin",
      table.name
    ),
    index("people_search_vector_idx").using("gin", table.searchVector),
    index("people_server_id_idx").on(table.serverId),
  ]
);

// Item-People junction table - links items to people with role info
// type is stored here because same person can have different roles in different items
// (e.g., Clint Eastwood can be Actor in one movie and Director in another)
export const itemPeople = pgTable(
  "item_people",
  {
    id: serial("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull(),
    serverId: integer("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // Actor, Director, Writer, Producer, etc.
    role: text("role"), // Character name for actors
    sortOrder: integer("sort_order"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Unique per item+person+type (same person can be Actor AND Director in same item)
    unique("item_people_unique").on(table.itemId, table.personId, table.type),
    index("item_people_person_idx").on(table.personId, table.serverId),
    index("item_people_item_idx").on(table.itemId),
    index("item_people_type_idx").on(table.serverId, table.type),
  ]
);

// Watchlists table - user-created lists of media items
export const watchlists = pgTable(
  "watchlists",
  {
    id: serial("id").primaryKey(),
    serverId: integer("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(), // Jellyfin user ID who owns the list
    name: text("name").notNull(),
    description: text("description"),
    isPublic: boolean("is_public").notNull().default(false),
    isPromoted: boolean("is_promoted").notNull().default(false), // Admin-only: visible on all users' home screens in external clients
    allowedItemType: text("allowed_item_type"), // If set, only items of this type can be added (Movie, Series, Episode, etc.)
    defaultSortOrder: text("default_sort_order").notNull().default("custom"), // custom, name, dateAdded, releaseDate
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),

    // Full-text search vector - populated by database trigger
    searchVector: tsvector("search_vector"),
  },
  (table) => [
    index("watchlists_server_user_idx").on(table.serverId, table.userId),
    index("watchlists_server_public_idx").on(table.serverId, table.isPublic),
    index("watchlists_server_promoted_idx").on(table.serverId, table.isPromoted),
    index("watchlists_search_vector_idx").using("gin", table.searchVector),
  ]
);

// Watchlist items junction table - items within watchlists
export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: serial("id").primaryKey(),
    watchlistId: integer("watchlist_id")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0), // For custom ordering
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    index("watchlist_items_watchlist_idx").on(table.watchlistId),
    index("watchlist_items_item_idx").on(table.itemId),
    unique("watchlist_items_unique").on(table.watchlistId, table.itemId),
  ]
);

// Define relationships
export const serversRelations = relations(servers, ({ many }) => ({
  libraries: many(libraries),
  users: many(users),
  activities: many(activities),
  items: many(items),
  sessions: many(sessions),
  hiddenRecommendations: many(hiddenRecommendations),
  userFingerprints: many(userFingerprints),
  anomalyEvents: many(anomalyEvents),
  watchlists: many(watchlists),
  people: many(people),
  itemPeople: many(itemPeople),
  jobConfigurations: many(serverJobConfigurations),
}));

export const serverJobConfigurationsRelations = relations(
  serverJobConfigurations,
  ({ one }) => ({
    server: one(servers, {
      fields: [serverJobConfigurations.serverId],
      references: [servers.id],
    }),
  })
);

export const librariesRelations = relations(libraries, ({ one, many }) => ({
  server: one(servers, {
    fields: [libraries.serverId],
    references: [servers.id],
  }),
  items: many(items),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  server: one(servers, {
    fields: [users.serverId],
    references: [servers.id],
  }),
  activities: many(activities),
  sessions: many(sessions),
  fingerprints: many(userFingerprints),
  anomalyEvents: many(anomalyEvents),
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  server: one(servers, {
    fields: [activities.serverId],
    references: [servers.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
  location: one(activityLocations),
  anomalyEvents: many(anomalyEvents),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  server: one(servers, {
    fields: [items.serverId],
    references: [servers.id],
  }),
  library: one(libraries, {
    fields: [items.libraryId],
    references: [libraries.id],
  }),
  parent: one(items, {
    fields: [items.parentId],
    references: [items.id],
  }),
  sessions: many(sessions),
  hiddenRecommendations: many(hiddenRecommendations),
  watchlistItems: many(watchlistItems),
  itemPeople: many(itemPeople),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  server: one(servers, {
    fields: [sessions.serverId],
    references: [servers.id],
  }),
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  item: one(items, {
    fields: [sessions.itemId],
    references: [items.id],
  }),
}));

export const activityLocationsRelations = relations(
  activityLocations,
  ({ one }) => ({
    activity: one(activities, {
      fields: [activityLocations.activityId],
      references: [activities.id],
    }),
  })
);

export const userFingerprintsRelations = relations(
  userFingerprints,
  ({ one }) => ({
    user: one(users, {
      fields: [userFingerprints.userId],
      references: [users.id],
    }),
    server: one(servers, {
      fields: [userFingerprints.serverId],
      references: [servers.id],
    }),
  })
);

export const anomalyEventsRelations = relations(anomalyEvents, ({ one }) => ({
  user: one(users, {
    fields: [anomalyEvents.userId],
    references: [users.id],
  }),
  server: one(servers, {
    fields: [anomalyEvents.serverId],
    references: [servers.id],
  }),
  activity: one(activities, {
    fields: [anomalyEvents.activityId],
    references: [activities.id],
  }),
}));

export const hiddenRecommendationsRelations = relations(
  hiddenRecommendations,
  ({ one }) => ({
    server: one(servers, {
      fields: [hiddenRecommendations.serverId],
      references: [servers.id],
    }),
    item: one(items, {
      fields: [hiddenRecommendations.itemId],
      references: [items.id],
    }),
  })
);

export const watchlistsRelations = relations(watchlists, ({ one, many }) => ({
  server: one(servers, {
    fields: [watchlists.serverId],
    references: [servers.id],
  }),
  items: many(watchlistItems),
}));

export const watchlistItemsRelations = relations(watchlistItems, ({ one }) => ({
  watchlist: one(watchlists, {
    fields: [watchlistItems.watchlistId],
    references: [watchlists.id],
  }),
  item: one(items, {
    fields: [watchlistItems.itemId],
    references: [items.id],
  }),
}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  server: one(servers, {
    fields: [people.serverId],
    references: [servers.id],
  }),
  itemPeople: many(itemPeople),
}));

export const itemPeopleRelations = relations(itemPeople, ({ one }) => ({
  item: one(items, {
    fields: [itemPeople.itemId],
    references: [items.id],
  }),
  person: one(people, {
    fields: [itemPeople.personId, itemPeople.serverId],
    references: [people.id, people.serverId],
  }),
  server: one(servers, {
    fields: [itemPeople.serverId],
    references: [servers.id],
  }),
}));

// Type exports
export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;

export type Library = typeof libraries.$inferSelect;
export type NewLibrary = typeof libraries.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;

export type JobResult = typeof jobResults.$inferSelect;
export type NewJobResult = typeof jobResults.$inferInsert;

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;

export type MediaSource = typeof mediaSources.$inferSelect;
export type NewMediaSource = typeof mediaSources.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type ActiveSession = typeof activeSessions.$inferSelect;
export type NewActiveSession = typeof activeSessions.$inferInsert;

export type ActivityLogCursor = typeof activityLogCursors.$inferSelect;
export type NewActivityLogCursor = typeof activityLogCursors.$inferInsert;

export type HiddenRecommendation = typeof hiddenRecommendations.$inferSelect;
export type NewHiddenRecommendation = typeof hiddenRecommendations.$inferInsert;

export type ActivityLocation = typeof activityLocations.$inferSelect;
export type NewActivityLocation = typeof activityLocations.$inferInsert;

export type UserFingerprint = typeof userFingerprints.$inferSelect;
export type NewUserFingerprint = typeof userFingerprints.$inferInsert;

export type AnomalyEvent = typeof anomalyEvents.$inferSelect;
export type NewAnomalyEvent = typeof anomalyEvents.$inferInsert;

export type Watchlist = typeof watchlists.$inferSelect;
export type NewWatchlist = typeof watchlists.$inferInsert;

export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type NewWatchlistItem = typeof watchlistItems.$inferInsert;

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;

export type ItemPerson = typeof itemPeople.$inferSelect;
export type NewItemPerson = typeof itemPeople.$inferInsert;
