"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hiddenRecommendationsRelations = exports.sessionsRelations = exports.itemsRelations = exports.activitiesRelations = exports.usersRelations = exports.librariesRelations = exports.serversRelations = exports.hiddenRecommendations = exports.sessions = exports.jellyseerrItems = exports.items = exports.jobResults = exports.activities = exports.users = exports.libraries = exports.servers = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// Servers table - main server configurations
exports.servers = (0, pg_core_1.pgTable)("servers", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    url: (0, pg_core_1.text)("url").notNull(),
    apiKey: (0, pg_core_1.text)("api_key").notNull(),
    lastSyncedPlaybackId: (0, pg_core_1.bigint)("last_synced_playback_id", { mode: "number" })
        .notNull()
        .default(0),
    localAddress: (0, pg_core_1.text)("local_address"),
    version: (0, pg_core_1.text)("version"),
    productName: (0, pg_core_1.text)("product_name"),
    operatingSystem: (0, pg_core_1.text)("operating_system"),
    startupWizardCompleted: (0, pg_core_1.boolean)("startup_wizard_completed")
        .notNull()
        .default(false),
    openAiApiToken: (0, pg_core_1.text)("open_ai_api_token"),
    autoGenerateEmbeddings: (0, pg_core_1.boolean)("auto_generate_embeddings")
        .notNull()
        .default(false),
    ollamaApiToken: (0, pg_core_1.text)("ollama_api_token"),
    ollamaBaseUrl: (0, pg_core_1.text)("ollama_base_url"),
    ollamaModel: (0, pg_core_1.text)("ollama_model"),
    embeddingProvider: (0, pg_core_1.text)("embedding_provider").default("openai"),
    // Jellyseerr integration
    jellyseerrUrl: (0, pg_core_1.text)("jellyseerr_url"),
    enableJellyseerrIntegration: (0, pg_core_1.boolean)("enable_jellyseerr_integration")
        .notNull()
        .default(false),
    jellyseerrSyncEnabled: (0, pg_core_1.boolean)("jellyseerr_sync_enabled")
        .notNull()
        .default(false),
    jellyseerrLastSync: (0, pg_core_1.timestamp)("jellyseerr_last_sync"),
    // Sync status tracking
    syncStatus: (0, pg_core_1.text)("sync_status").notNull().default("pending"), // pending, syncing, completed, failed
    syncProgress: (0, pg_core_1.text)("sync_progress").notNull().default("not_started"), // not_started, users, libraries, items, activities, completed
    syncError: (0, pg_core_1.text)("sync_error"),
    lastSyncStarted: (0, pg_core_1.timestamp)("last_sync_started"),
    lastSyncCompleted: (0, pg_core_1.timestamp)("last_sync_completed"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => [(0, pg_core_1.unique)("servers_url_unique").on(table.url)]);
exports.libraries = (0, pg_core_1.pgTable)("libraries", {
    id: (0, pg_core_1.text)("id").primaryKey(), // External library ID from server
    name: (0, pg_core_1.text)("name").notNull(),
    type: (0, pg_core_1.text)("type").notNull(), // Movie, TV, Music, etc.
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
// Users table - users from various servers
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.text)("id").primaryKey(), // External user ID from server
    name: (0, pg_core_1.text)("name").notNull(),
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    lastLoginDate: (0, pg_core_1.timestamp)("last_login_date", { withTimezone: true }),
    lastActivityDate: (0, pg_core_1.timestamp)("last_activity_date", { withTimezone: true }),
    hasPassword: (0, pg_core_1.boolean)("has_password").notNull().default(false),
    hasConfiguredPassword: (0, pg_core_1.boolean)("has_configured_password")
        .notNull()
        .default(false),
    hasConfiguredEasyPassword: (0, pg_core_1.boolean)("has_configured_easy_password")
        .notNull()
        .default(false),
    enableAutoLogin: (0, pg_core_1.boolean)("enable_auto_login").notNull().default(false),
    isAdministrator: (0, pg_core_1.boolean)("is_administrator").notNull().default(false),
    isHidden: (0, pg_core_1.boolean)("is_hidden").notNull().default(false),
    isDisabled: (0, pg_core_1.boolean)("is_disabled").notNull().default(false),
    enableUserPreferenceAccess: (0, pg_core_1.boolean)("enable_user_preference_access")
        .notNull()
        .default(true),
    enableRemoteControlOfOtherUsers: (0, pg_core_1.boolean)("enable_remote_control_of_other_users")
        .notNull()
        .default(false),
    enableSharedDeviceControl: (0, pg_core_1.boolean)("enable_shared_device_control")
        .notNull()
        .default(false),
    enableRemoteAccess: (0, pg_core_1.boolean)("enable_remote_access").notNull().default(true),
    enableLiveTvManagement: (0, pg_core_1.boolean)("enable_live_tv_management")
        .notNull()
        .default(false),
    enableLiveTvAccess: (0, pg_core_1.boolean)("enable_live_tv_access").notNull().default(true),
    enableMediaPlayback: (0, pg_core_1.boolean)("enable_media_playback").notNull().default(true),
    enableAudioPlaybackTranscoding: (0, pg_core_1.boolean)("enable_audio_playback_transcoding")
        .notNull()
        .default(true),
    enableVideoPlaybackTranscoding: (0, pg_core_1.boolean)("enable_video_playback_transcoding")
        .notNull()
        .default(true),
    enablePlaybackRemuxing: (0, pg_core_1.boolean)("enable_playback_remuxing")
        .notNull()
        .default(true),
    enableContentDeletion: (0, pg_core_1.boolean)("enable_content_deletion")
        .notNull()
        .default(false),
    enableContentDownloading: (0, pg_core_1.boolean)("enable_content_downloading")
        .notNull()
        .default(false),
    enableSyncTranscoding: (0, pg_core_1.boolean)("enable_sync_transcoding")
        .notNull()
        .default(true),
    enableMediaConversion: (0, pg_core_1.boolean)("enable_media_conversion")
        .notNull()
        .default(false),
    enableAllDevices: (0, pg_core_1.boolean)("enable_all_devices").notNull().default(true),
    enableAllChannels: (0, pg_core_1.boolean)("enable_all_channels").notNull().default(true),
    enableAllFolders: (0, pg_core_1.boolean)("enable_all_folders").notNull().default(true),
    enablePublicSharing: (0, pg_core_1.boolean)("enable_public_sharing")
        .notNull()
        .default(false),
    invalidLoginAttemptCount: (0, pg_core_1.integer)("invalid_login_attempt_count")
        .notNull()
        .default(0),
    loginAttemptsBeforeLockout: (0, pg_core_1.integer)("login_attempts_before_lockout")
        .notNull()
        .default(3),
    maxActiveSessions: (0, pg_core_1.integer)("max_active_sessions").notNull().default(0),
    remoteClientBitrateLimit: (0, pg_core_1.integer)("remote_client_bitrate_limit")
        .notNull()
        .default(0),
    authenticationProviderId: (0, pg_core_1.text)("authentication_provider_id")
        .notNull()
        .default("Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider"),
    passwordResetProviderId: (0, pg_core_1.text)("password_reset_provider_id")
        .notNull()
        .default("Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider"),
    syncPlayAccess: (0, pg_core_1.text)("sync_play_access")
        .notNull()
        .default("CreateAndJoinGroups"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
// Activities table - user activities and server events
exports.activities = (0, pg_core_1.pgTable)("activities", {
    id: (0, pg_core_1.text)("id").primaryKey(), // External activity ID from server
    name: (0, pg_core_1.text)("name").notNull(),
    shortOverview: (0, pg_core_1.text)("short_overview"),
    type: (0, pg_core_1.text)("type").notNull(), // ActivityType enum from server
    date: (0, pg_core_1.timestamp)("date", { withTimezone: true }).notNull(),
    severity: (0, pg_core_1.text)("severity").notNull(), // Info, Warn, Error
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.text)("user_id").references(() => exports.users.id, { onDelete: "set null" }), // Optional, some activities aren't user-specific
    itemId: (0, pg_core_1.text)("item_id"), // Optional, media item ID from server
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
// Job results table
exports.jobResults = (0, pg_core_1.pgTable)("job_results", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    jobId: (0, pg_core_1.varchar)("job_id", { length: 255 }).notNull(),
    jobName: (0, pg_core_1.varchar)("job_name", { length: 255 }).notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).notNull(), // 'completed', 'failed', 'processing'
    result: (0, pg_core_1.jsonb)("result"),
    error: (0, pg_core_1.text)("error"),
    processingTime: (0, pg_core_1.integer)("processing_time"), // in milliseconds
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
// Items table - media items within servers
exports.items = (0, pg_core_1.pgTable)("items", {
    // Primary key and relationships
    id: (0, pg_core_1.text)("id").primaryKey(),
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    libraryId: (0, pg_core_1.text)("library_id")
        .notNull()
        .references(() => exports.libraries.id, { onDelete: "cascade" }),
    // Core metadata fields
    name: (0, pg_core_1.text)("name").notNull(),
    type: (0, pg_core_1.text)("type").notNull(), // Movie, Episode, Series, etc.
    originalTitle: (0, pg_core_1.text)("original_title"),
    etag: (0, pg_core_1.text)("etag"),
    dateCreated: (0, pg_core_1.timestamp)("date_created", { withTimezone: true }),
    container: (0, pg_core_1.text)("container"),
    sortName: (0, pg_core_1.text)("sort_name"),
    premiereDate: (0, pg_core_1.timestamp)("premiere_date", { withTimezone: true }),
    path: (0, pg_core_1.text)("path"),
    officialRating: (0, pg_core_1.text)("official_rating"),
    overview: (0, pg_core_1.text)("overview"),
    // Ratings and metrics
    communityRating: (0, pg_core_1.doublePrecision)("community_rating"),
    runtimeTicks: (0, pg_core_1.bigint)("runtime_ticks", { mode: "number" }),
    productionYear: (0, pg_core_1.integer)("production_year"),
    // Structure and hierarchy
    isFolder: (0, pg_core_1.boolean)("is_folder").notNull(),
    parentId: (0, pg_core_1.text)("parent_id"),
    mediaType: (0, pg_core_1.text)("media_type"),
    // Video specifications
    width: (0, pg_core_1.integer)("width"),
    height: (0, pg_core_1.integer)("height"),
    // Series/TV specific fields
    seriesName: (0, pg_core_1.text)("series_name"),
    seriesId: (0, pg_core_1.text)("series_id"),
    seasonId: (0, pg_core_1.text)("season_id"),
    seasonName: (0, pg_core_1.text)("season_name"),
    indexNumber: (0, pg_core_1.integer)("index_number"), // Episode number
    parentIndexNumber: (0, pg_core_1.integer)("parent_index_number"), // Season number
    // Media details
    videoType: (0, pg_core_1.text)("video_type"),
    hasSubtitles: (0, pg_core_1.boolean)("has_subtitles"),
    channelId: (0, pg_core_1.text)("channel_id"),
    locationType: (0, pg_core_1.text)("location_type"),
    genres: (0, pg_core_1.text)("genres").array(),
    // Image metadata
    primaryImageAspectRatio: (0, pg_core_1.doublePrecision)("primary_image_aspect_ratio"),
    primaryImageTag: (0, pg_core_1.text)("primary_image_tag"),
    seriesPrimaryImageTag: (0, pg_core_1.text)("series_primary_image_tag"),
    primaryImageThumbTag: (0, pg_core_1.text)("primary_image_thumb_tag"),
    primaryImageLogoTag: (0, pg_core_1.text)("primary_image_logo_tag"),
    parentThumbItemId: (0, pg_core_1.text)("parent_thumb_item_id"),
    parentThumbImageTag: (0, pg_core_1.text)("parent_thumb_image_tag"),
    parentLogoItemId: (0, pg_core_1.text)("parent_logo_item_id"),
    parentLogoImageTag: (0, pg_core_1.text)("parent_logo_image_tag"),
    backdropImageTags: (0, pg_core_1.text)("backdrop_image_tags").array(),
    parentBackdropItemId: (0, pg_core_1.text)("parent_backdrop_item_id"),
    parentBackdropImageTags: (0, pg_core_1.text)("parent_backdrop_image_tags").array(),
    imageBlurHashes: (0, pg_core_1.jsonb)("image_blur_hashes"),
    imageTags: (0, pg_core_1.jsonb)("image_tags"),
    // Media capabilities and permissions
    canDelete: (0, pg_core_1.boolean)("can_delete"),
    canDownload: (0, pg_core_1.boolean)("can_download"),
    playAccess: (0, pg_core_1.text)("play_access"),
    isHD: (0, pg_core_1.boolean)("is_hd"),
    // External metadata
    providerIds: (0, pg_core_1.jsonb)("provider_ids"),
    tags: (0, pg_core_1.text)("tags").array(),
    seriesStudio: (0, pg_core_1.text)("series_studio"),
    // People data - actors, directors, producers, etc.
    people: (0, pg_core_1.jsonb)("people"), // Array of people objects with Name, Id, Role, Type, etc.
    // Hybrid approach - complete BaseItemDto storage
    rawData: (0, pg_core_1.jsonb)("raw_data").notNull(), // Full Jellyfin BaseItemDto
    // AI and processing
    embedding: (0, pg_core_1.vector)("embedding", { dimensions: 1536 }),
    processed: (0, pg_core_1.boolean)("processed").default(false),
    // Timestamps
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => [
    // Vector index for embedding similarity search
    (0, pg_core_1.index)("items_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
]);
// Jellyseerr items table - for storing popular/trending movies for AI recommendations
exports.jellyseerrItems = (0, pg_core_1.pgTable)("jellyseerr_items", {
    id: (0, pg_core_1.text)("id").primaryKey(), // Format: "jellyseerr-movie-{tmdbId}" or "jellyseerr-tv-{tmdbId}"
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    // Basic movie/TV info from TMDB/Jellyseerr
    tmdbId: (0, pg_core_1.integer)("tmdb_id").notNull(),
    title: (0, pg_core_1.text)("title").notNull(),
    originalTitle: (0, pg_core_1.text)("original_title"),
    overview: (0, pg_core_1.text)("overview"),
    releaseDate: (0, pg_core_1.date)("release_date"),
    productionYear: (0, pg_core_1.integer)("production_year"),
    type: (0, pg_core_1.text)("type").notNull(), // "Movie" or "TV"
    // Ratings and popularity
    communityRating: (0, pg_core_1.real)("community_rating"), // TMDB vote_average
    popularity: (0, pg_core_1.real)("popularity"), // TMDB popularity score
    voteCount: (0, pg_core_1.integer)("vote_count"),
    // Media metadata
    posterPath: (0, pg_core_1.text)("poster_path"),
    backdropPath: (0, pg_core_1.text)("backdrop_path"),
    originalLanguage: (0, pg_core_1.text)("original_language"),
    adult: (0, pg_core_1.boolean)("adult").default(false),
    genres: (0, pg_core_1.json)("genres"), // Array of genre names/IDs
    // Source and category info
    sourceType: (0, pg_core_1.text)("source_type").notNull(), // "popular", "trending", "upcoming"
    mediaType: (0, pg_core_1.text)("media_type").notNull(), // "movie" or "tv" (TMDB format)
    // Embedding processing
    processed: (0, pg_core_1.boolean)("processed").notNull().default(false),
    embedding: (0, pg_core_1.real)("embedding").array(), // Vector embedding for AI recommendations
    // Raw data from Jellyseerr/TMDB for reference
    rawData: (0, pg_core_1.json)("raw_data"),
    // Timestamps
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
// Sessions table - user sessions and playback information
exports.sessions = (0, pg_core_1.pgTable)("sessions", {
    // Primary key and relationships
    id: (0, pg_core_1.text)("id").primaryKey(), // Session ID from Jellyfin or generated UUID
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.text)("user_id").references(() => exports.users.id, { onDelete: "set null" }),
    itemId: (0, pg_core_1.text)("item_id").references(() => exports.items.id, { onDelete: "set null" }),
    // User information
    userName: (0, pg_core_1.text)("user_name").notNull(),
    userServerId: (0, pg_core_1.text)("user_server_id"), // User ID from Jellyfin server
    // Device information
    deviceId: (0, pg_core_1.text)("device_id"),
    deviceName: (0, pg_core_1.text)("device_name"),
    clientName: (0, pg_core_1.text)("client_name"),
    applicationVersion: (0, pg_core_1.text)("application_version"),
    remoteEndPoint: (0, pg_core_1.text)("remote_end_point"),
    // Media item information
    itemName: (0, pg_core_1.text)("item_name"),
    seriesId: (0, pg_core_1.text)("series_id"),
    seriesName: (0, pg_core_1.text)("series_name"),
    seasonId: (0, pg_core_1.text)("season_id"),
    // Playback timing
    playDuration: (0, pg_core_1.integer)("play_duration"), // in seconds
    startTime: (0, pg_core_1.timestamp)("start_time", { withTimezone: true }),
    endTime: (0, pg_core_1.timestamp)("end_time", { withTimezone: true }),
    lastActivityDate: (0, pg_core_1.timestamp)("last_activity_date", { withTimezone: true }),
    lastPlaybackCheckIn: (0, pg_core_1.timestamp)("last_playback_check_in", {
        withTimezone: true,
    }),
    // Playback position and progress
    runtimeTicks: (0, pg_core_1.bigint)("runtime_ticks", { mode: "number" }),
    positionTicks: (0, pg_core_1.bigint)("position_ticks", { mode: "number" }),
    percentComplete: (0, pg_core_1.doublePrecision)("percent_complete"),
    // Playback state
    completed: (0, pg_core_1.boolean)("completed").notNull(),
    isPaused: (0, pg_core_1.boolean)("is_paused").notNull(),
    isMuted: (0, pg_core_1.boolean)("is_muted").notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").notNull(),
    // Audio/Video settings
    volumeLevel: (0, pg_core_1.integer)("volume_level"),
    audioStreamIndex: (0, pg_core_1.integer)("audio_stream_index"),
    subtitleStreamIndex: (0, pg_core_1.integer)("subtitle_stream_index"),
    playMethod: (0, pg_core_1.text)("play_method"), // DirectPlay, DirectStream, Transcode
    mediaSourceId: (0, pg_core_1.text)("media_source_id"),
    repeatMode: (0, pg_core_1.text)("repeat_mode"),
    playbackOrder: (0, pg_core_1.text)("playback_order"),
    // Media stream information
    videoCodec: (0, pg_core_1.text)("video_codec"),
    audioCodec: (0, pg_core_1.text)("audio_codec"),
    resolutionWidth: (0, pg_core_1.integer)("resolution_width"),
    resolutionHeight: (0, pg_core_1.integer)("resolution_height"),
    videoBitRate: (0, pg_core_1.integer)("video_bit_rate"),
    audioBitRate: (0, pg_core_1.integer)("audio_bit_rate"),
    audioChannels: (0, pg_core_1.integer)("audio_channels"),
    audioSampleRate: (0, pg_core_1.integer)("audio_sample_rate"),
    videoRangeType: (0, pg_core_1.text)("video_range_type"),
    // Transcoding information
    isTranscoded: (0, pg_core_1.boolean)("is_transcoded").notNull().default(false),
    transcodingWidth: (0, pg_core_1.integer)("transcoding_width"),
    transcodingHeight: (0, pg_core_1.integer)("transcoding_height"),
    transcodingVideoCodec: (0, pg_core_1.text)("transcoding_video_codec"),
    transcodingAudioCodec: (0, pg_core_1.text)("transcoding_audio_codec"),
    transcodingContainer: (0, pg_core_1.text)("transcoding_container"),
    transcodingIsVideoDirect: (0, pg_core_1.boolean)("transcoding_is_video_direct"),
    transcodingIsAudioDirect: (0, pg_core_1.boolean)("transcoding_is_audio_direct"),
    transcodingBitrate: (0, pg_core_1.integer)("transcoding_bitrate"),
    transcodingCompletionPercentage: (0, pg_core_1.doublePrecision)("transcoding_completion_percentage"),
    transcodingAudioChannels: (0, pg_core_1.integer)("transcoding_audio_channels"),
    transcodingHardwareAccelerationType: (0, pg_core_1.text)("transcoding_hardware_acceleration_type"),
    transcodeReasons: (0, pg_core_1.text)("transcode_reasons").array(),
    // Hybrid approach - complete session data
    rawData: (0, pg_core_1.jsonb)("raw_data").notNull(), // Full Jellyfin session data
    // Timestamps
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
// Hidden recommendations table - stores user's hidden recommendations
exports.hiddenRecommendations = (0, pg_core_1.pgTable)("hidden_recommendations", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    serverId: (0, pg_core_1.integer)("server_id")
        .references(() => exports.servers.id, { onDelete: "cascade" })
        .notNull(),
    userId: (0, pg_core_1.text)("user_id").notNull(), // Jellyfin user ID
    itemId: (0, pg_core_1.text)("item_id")
        .references(() => exports.items.id, { onDelete: "cascade" })
        .notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
});
// Define relationships
exports.serversRelations = (0, drizzle_orm_1.relations)(exports.servers, ({ many }) => ({
    libraries: many(exports.libraries),
    users: many(exports.users),
    activities: many(exports.activities),
    items: many(exports.items),
    sessions: many(exports.sessions),
    hiddenRecommendations: many(exports.hiddenRecommendations),
}));
exports.librariesRelations = (0, drizzle_orm_1.relations)(exports.libraries, ({ one, many }) => ({
    server: one(exports.servers, {
        fields: [exports.libraries.serverId],
        references: [exports.servers.id],
    }),
    items: many(exports.items),
}));
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ one, many }) => ({
    server: one(exports.servers, {
        fields: [exports.users.serverId],
        references: [exports.servers.id],
    }),
    activities: many(exports.activities),
    sessions: many(exports.sessions),
}));
exports.activitiesRelations = (0, drizzle_orm_1.relations)(exports.activities, ({ one }) => ({
    server: one(exports.servers, {
        fields: [exports.activities.serverId],
        references: [exports.servers.id],
    }),
    user: one(exports.users, {
        fields: [exports.activities.userId],
        references: [exports.users.id],
    }),
}));
exports.itemsRelations = (0, drizzle_orm_1.relations)(exports.items, ({ one, many }) => ({
    server: one(exports.servers, {
        fields: [exports.items.serverId],
        references: [exports.servers.id],
    }),
    library: one(exports.libraries, {
        fields: [exports.items.libraryId],
        references: [exports.libraries.id],
    }),
    parent: one(exports.items, {
        fields: [exports.items.parentId],
        references: [exports.items.id],
    }),
    sessions: many(exports.sessions),
    hiddenRecommendations: many(exports.hiddenRecommendations),
}));
exports.sessionsRelations = (0, drizzle_orm_1.relations)(exports.sessions, ({ one }) => ({
    server: one(exports.servers, {
        fields: [exports.sessions.serverId],
        references: [exports.servers.id],
    }),
    user: one(exports.users, {
        fields: [exports.sessions.userId],
        references: [exports.users.id],
    }),
    item: one(exports.items, {
        fields: [exports.sessions.itemId],
        references: [exports.items.id],
    }),
}));
exports.hiddenRecommendationsRelations = (0, drizzle_orm_1.relations)(exports.hiddenRecommendations, ({ one }) => ({
    server: one(exports.servers, {
        fields: [exports.hiddenRecommendations.serverId],
        references: [exports.servers.id],
    }),
    item: one(exports.items, {
        fields: [exports.hiddenRecommendations.itemId],
        references: [exports.items.id],
    }),
}));
//# sourceMappingURL=schema.js.map