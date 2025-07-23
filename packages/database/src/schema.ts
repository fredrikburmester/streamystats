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
  vector,
  index,
  unique,
  date,
  real,
  json,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Servers table - main server configurations
export const servers = pgTable(
  "servers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    apiKey: text("api_key").notNull(),
    lastSyncedPlaybackId: bigint("last_synced_playback_id", { mode: "number" })
      .notNull()
      .default(0),
    localAddress: text("local_address"),
    version: text("version"),
    productName: text("product_name"),
    operatingSystem: text("operating_system"),
    startupWizardCompleted: boolean("startup_wizard_completed")
      .notNull()
      .default(false),
    openAiApiToken: text("open_ai_api_token"),
    autoGenerateEmbeddings: boolean("auto_generate_embeddings")
      .notNull()
      .default(false),
    ollamaApiToken: text("ollama_api_token"),
    ollamaBaseUrl: text("ollama_base_url"),
    ollamaModel: text("ollama_model"),
    embeddingProvider: text("embedding_provider").default("openai"),

    // Jellyseerr integration
    jellyseerrUrl: text("jellyseerr_url"),
    enableJellyseerrIntegration: boolean("enable_jellyseerr_integration")
      .notNull()
      .default(false),
    jellyseerrSyncEnabled: boolean("jellyseerr_sync_enabled")
      .notNull()
      .default(false),
    jellyseerrLastSync: timestamp("jellyseerr_last_sync"),

    // Sync status tracking
    syncStatus: text("sync_status").notNull().default("pending"), // pending, syncing, completed, failed
    syncProgress: text("sync_progress").notNull().default("not_started"), // not_started, users, libraries, items, activities, completed
    syncError: text("sync_error"),
    lastSyncStarted: timestamp("last_sync_started"),
    lastSyncCompleted: timestamp("last_sync_completed"),

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
export const users = pgTable("users", {
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
});

// Activities table - user activities and server events
export const activities = pgTable("activities", {
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
});

// Job results table
export const jobResults = pgTable("job_results", {
  id: serial("id").primaryKey(),
  jobId: varchar("job_id", { length: 255 }).notNull(),
  jobName: varchar("job_name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(), // 'completed', 'failed', 'processing'
  result: jsonb("result"),
  error: text("error"),
  processingTime: integer("processing_time"), // in milliseconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
    imageBlurHashes: jsonb("image_blur_hashes"),
    imageTags: jsonb("image_tags"),

    // Media capabilities and permissions
    canDelete: boolean("can_delete"),
    canDownload: boolean("can_download"),
    playAccess: text("play_access"),
    isHD: boolean("is_hd"),

    // External metadata
    providerIds: jsonb("provider_ids"),
    tags: text("tags").array(),
    seriesStudio: text("series_studio"),

    // People data - actors, directors, producers, etc.
    people: jsonb("people"), // Array of people objects with Name, Id, Role, Type, etc.

    // Hybrid approach - complete BaseItemDto storage
    rawData: jsonb("raw_data").notNull(), // Full Jellyfin BaseItemDto

    // AI and processing
    embedding: vector("embedding", { dimensions: 1536 }),
    processed: boolean("processed").default(false),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Vector index for embedding similarity search
    index("items_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);

// Jellyseerr items table - for storing popular/trending movies for AI recommendations
export const jellyseerrItems = pgTable("jellyseerr_items", {
  id: text("id").primaryKey(), // Format: "jellyseerr-movie-{tmdbId}" or "jellyseerr-tv-{tmdbId}"
  serverId: integer("server_id")
    .notNull()
    .references(() => servers.id, { onDelete: "cascade" }),

  // Basic movie/TV info from TMDB/Jellyseerr
  tmdbId: integer("tmdb_id").notNull(),
  title: text("title").notNull(),
  originalTitle: text("original_title"),
  overview: text("overview"),
  releaseDate: date("release_date"),
  productionYear: integer("production_year"),
  type: text("type").notNull(), // "Movie" or "TV"

  // Ratings and popularity
  communityRating: real("community_rating"), // TMDB vote_average
  popularity: real("popularity"), // TMDB popularity score
  voteCount: integer("vote_count"),

  // Media metadata
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  originalLanguage: text("original_language"),
  adult: boolean("adult").default(false),
  genres: json("genres"), // Array of genre names/IDs

  // Source and category info
  sourceType: text("source_type").notNull(), // "popular", "trending", "upcoming"
  mediaType: text("media_type").notNull(), // "movie" or "tv" (TMDB format)

  // Embedding processing
  processed: boolean("processed").notNull().default(false),
  embedding: real("embedding").array(), // Vector embedding for AI recommendations

  // Raw data from Jellyseerr/TMDB for reference
  rawData: json("raw_data"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sessions table - user sessions and playback information
export const sessions = pgTable("sessions", {
  // Primary key and relationships
  id: text("id").primaryKey(), // Session ID from Jellyfin or generated UUID
  serverId: integer("server_id")
    .notNull()
    .references(() => servers.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  itemId: text("item_id").references(() => items.id, { onDelete: "set null" }),

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

// Define relationships
export const serversRelations = relations(servers, ({ many }) => ({
  libraries: many(libraries),
  users: many(users),
  activities: many(activities),
  items: many(items),
  sessions: many(sessions),
  hiddenRecommendations: many(hiddenRecommendations),
}));

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
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  server: one(servers, {
    fields: [activities.serverId],
    references: [servers.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
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
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
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

export type JellyseerrItem = typeof jellyseerrItems.$inferSelect;
export type NewJellyseerrItem = typeof jellyseerrItems.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type HiddenRecommendation = typeof hiddenRecommendations.$inferSelect;
export type NewHiddenRecommendation = typeof hiddenRecommendations.$inferInsert;
