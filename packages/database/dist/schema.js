"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.itemPeopleRelations = exports.peopleRelations = exports.watchlistItemsRelations = exports.watchlistsRelations = exports.hiddenRecommendationsRelations = exports.anomalyEventsRelations = exports.userFingerprintsRelations = exports.activityLocationsRelations = exports.sessionsRelations = exports.itemsRelations = exports.activitiesRelations = exports.usersRelations = exports.librariesRelations = exports.serverJobConfigurationsRelations = exports.serversRelations = exports.watchlistItems = exports.watchlists = exports.itemPeople = exports.people = exports.anomalyEvents = exports.userFingerprints = exports.activityLocations = exports.hiddenRecommendations = exports.activityLogCursors = exports.activeSessions = exports.sessions = exports.mediaSources = exports.items = exports.serverJobConfigurations = exports.jobResults = exports.activities = exports.users = exports.libraries = exports.servers = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// Custom vector type that supports variable dimensions
// This allows storing embeddings of any size without hardcoding dimensions
const vector = (0, pg_core_1.customType)({
    dataType() {
        return "vector";
    },
    fromDriver(value) {
        // pgvector returns vectors as strings like "[1,2,3]"
        return value
            .slice(1, -1)
            .split(",")
            .map((v) => Number.parseFloat(v.trim()));
    },
    toDriver(value) {
        return `[${value.join(",")}]`;
    },
});
// Custom tsvector type for full-text search
// This column is populated by triggers in the database
const tsvector = (0, pg_core_1.customType)({
    dataType() {
        return "tsvector";
    },
    fromDriver(value) {
        return value;
    },
    toDriver(value) {
        return value;
    },
});
const drizzle_orm_1 = require("drizzle-orm");
// =============================================================================
// Tables
// =============================================================================
// Servers table - main server configurations
exports.servers = (0, pg_core_1.pgTable)("servers", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    jellyfinId: (0, pg_core_1.text)("jellyfin_id"), // Unique Jellyfin server ID from /System/Info
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
    autoGenerateEmbeddings: (0, pg_core_1.boolean)("auto_generate_embeddings")
        .notNull()
        .default(false),
    testMigrationField: (0, pg_core_1.text)("test_migration_field"),
    // Generic embedding configuration
    // Supports any OpenAI-compatible API: OpenAI, Azure, Together AI, Fireworks, LocalAI, Ollama, vLLM, etc.
    embeddingProvider: (0, pg_core_1.text)("embedding_provider"), // "openai-compatible" | "ollama"
    embeddingBaseUrl: (0, pg_core_1.text)("embedding_base_url"),
    embeddingApiKey: (0, pg_core_1.text)("embedding_api_key"),
    embeddingModel: (0, pg_core_1.text)("embedding_model"),
    embeddingDimensions: (0, pg_core_1.integer)("embedding_dimensions").default(1536),
    // AI Chat configuration (separate from embedding AI)
    // Supports OpenAI-compatible, Anthropic, Ollama, etc.
    chatProvider: (0, pg_core_1.text)("chat_provider"), // "openai-compatible" | "ollama" | "anthropic"
    chatBaseUrl: (0, pg_core_1.text)("chat_base_url"),
    chatApiKey: (0, pg_core_1.text)("chat_api_key"),
    chatModel: (0, pg_core_1.text)("chat_model"),
    // Sync status tracking
    syncStatus: (0, pg_core_1.text)("sync_status").notNull().default("pending"), // pending, syncing, completed, failed
    syncProgress: (0, pg_core_1.text)("sync_progress").notNull().default("not_started"), // not_started, users, libraries, items, activities, completed
    syncError: (0, pg_core_1.text)("sync_error"),
    lastSyncStarted: (0, pg_core_1.timestamp)("last_sync_started", { withTimezone: true }),
    lastSyncCompleted: (0, pg_core_1.timestamp)("last_sync_completed", { withTimezone: true }),
    // Holiday/seasonal recommendations settings
    disabledHolidays: (0, pg_core_1.text)("disabled_holidays").array().default([]),
    // Statistics exclusion settings
    // Users and libraries in these arrays will be hidden from all statistics
    excludedUserIds: (0, pg_core_1.text)("excluded_user_ids").array().default([]),
    excludedLibraryIds: (0, pg_core_1.text)("excluded_library_ids").array().default([]),
    // Embedding job control - set to true to stop a running embedding job
    embeddingStopRequested: (0, pg_core_1.boolean)("embedding_stop_requested")
        .notNull()
        .default(false),
    // Display timezone for this server (IANA timezone identifier)
    // All data is stored in UTC; this controls display formatting only
    timezone: (0, pg_core_1.text)("timezone").notNull().default("Etc/UTC"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [(0, pg_core_1.unique)("servers_url_unique").on(table.url)]);
exports.libraries = (0, pg_core_1.pgTable)("libraries", {
    id: (0, pg_core_1.text)("id").primaryKey(), // External library ID from server
    name: (0, pg_core_1.text)("name").notNull(),
    type: (0, pg_core_1.text)("type").notNull(), // Movie, TV, Music, etc.
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
    // User preference for automatic watchtime inference when marking items as watched
    // null = not asked yet, true = yes infer, false = no don't infer
    inferWatchtimeOnMarkWatched: (0, pg_core_1.boolean)("infer_watchtime_on_mark_watched"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
    // Full-text search vector - populated by database trigger
    searchVector: tsvector("search_vector"),
}, (table) => [
    (0, pg_core_1.index)("users_server_id_idx").on(table.serverId),
    (0, pg_core_1.index)("users_search_vector_idx").using("gin", table.searchVector),
]);
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
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    // Full-text search vector - populated by database trigger
    searchVector: tsvector("search_vector"),
}, (table) => [
    (0, pg_core_1.index)("activities_server_id_idx").on(table.serverId),
    (0, pg_core_1.index)("activities_search_vector_idx").using("gin", table.searchVector),
]);
// Job results table
exports.jobResults = (0, pg_core_1.pgTable)("job_results", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    jobId: (0, pg_core_1.varchar)("job_id", { length: 255 }).notNull(),
    jobName: (0, pg_core_1.varchar)("job_name", { length: 255 }).notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).notNull(), // 'completed', 'failed', 'processing'
    result: (0, pg_core_1.jsonb)("result"),
    error: (0, pg_core_1.text)("error"),
    processingTime: (0, pg_core_1.integer)("processing_time"), // in milliseconds (capped at 1 hour)
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
});
// Server job configurations table - per-server cron job settings
exports.serverJobConfigurations = (0, pg_core_1.pgTable)("server_job_configurations", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    jobKey: (0, pg_core_1.text)("job_key").notNull(),
    cronExpression: (0, pg_core_1.text)("cron_expression"), // null = use default (for cron-based jobs)
    intervalSeconds: (0, pg_core_1.integer)("interval_seconds"), // null = use default (for interval-based jobs like session-polling)
    enabled: (0, pg_core_1.boolean)("enabled").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.unique)("server_job_config_unique").on(table.serverId, table.jobKey),
    (0, pg_core_1.index)("server_job_config_server_idx").on(table.serverId),
]);
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
    imageBlurHashes: (0, pg_core_1.jsonb)("image_blur_hashes").$type(),
    imageTags: (0, pg_core_1.jsonb)("image_tags").$type(),
    // Media capabilities and permissions
    canDelete: (0, pg_core_1.boolean)("can_delete"),
    canDownload: (0, pg_core_1.boolean)("can_download"),
    playAccess: (0, pg_core_1.text)("play_access"),
    isHD: (0, pg_core_1.boolean)("is_hd"),
    // External metadata
    providerIds: (0, pg_core_1.jsonb)("provider_ids"),
    tags: (0, pg_core_1.text)("tags").array(),
    seriesStudio: (0, pg_core_1.text)("series_studio"),
    // Hybrid approach - complete BaseItemDto storage
    rawData: (0, pg_core_1.jsonb)("raw_data").notNull(), // Full Jellyfin BaseItemDto
    // AI and processing
    // Vector column without fixed dimension - supports any embedding model
    // Dimension is determined by the server's embeddingDimensions config
    embedding: vector("embedding"),
    processed: (0, pg_core_1.boolean)("processed").default(false),
    peopleSynced: (0, pg_core_1.boolean)("people_synced").default(false),
    mediaSourcesSynced: (0, pg_core_1.boolean)("media_sources_synced").default(false),
    // Timestamps
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
    // Soft delete
    deletedAt: (0, pg_core_1.timestamp)("deleted_at", { withTimezone: true }),
    // Full-text search vector - populated by database trigger
    // Contains: name, originalTitle, overview, seriesName, genres, people (actors/directors)
    searchVector: tsvector("search_vector"),
}, 
// Note: Vector index must be created manually per dimension using:
// CREATE INDEX items_embedding_idx ON items USING hnsw ((embedding::vector(N)) vector_cosine_ops)
// WHERE vector_dims(embedding) = N;
(table) => [
    (0, pg_core_1.index)("items_server_type_idx").on(table.serverId, table.type),
    (0, pg_core_1.index)("items_series_id_idx").on(table.seriesId),
    (0, pg_core_1.index)("items_search_vector_idx").using("gin", table.searchVector),
]);
// Media sources table - file information for items (size, bitrate, etc.)
exports.mediaSources = (0, pg_core_1.pgTable)("media_sources", {
    id: (0, pg_core_1.text)("id").primaryKey(), // MediaSource ID from Jellyfin
    itemId: (0, pg_core_1.text)("item_id")
        .notNull()
        .references(() => exports.items.id, { onDelete: "cascade" }),
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    // Core fields for statistics
    size: (0, pg_core_1.bigint)("size", { mode: "number" }), // File size in bytes
    bitrate: (0, pg_core_1.integer)("bitrate"),
    container: (0, pg_core_1.text)("container"),
    // Additional useful fields
    name: (0, pg_core_1.text)("name"),
    path: (0, pg_core_1.text)("path"),
    isRemote: (0, pg_core_1.boolean)("is_remote"),
    runtimeTicks: (0, pg_core_1.bigint)("runtime_ticks", { mode: "number" }),
    // Timestamps
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("media_sources_item_id_idx").on(table.itemId),
    (0, pg_core_1.index)("media_sources_server_id_idx").on(table.serverId),
]);
// Sessions table - user sessions and playback information
exports.sessions = (0, pg_core_1.pgTable)("sessions", {
    // Primary key and relationships
    id: (0, pg_core_1.text)("id").primaryKey(), // Session ID from Jellyfin or generated UUID
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.text)("user_id").references(() => exports.users.id, {
        onDelete: "set null",
    }),
    itemId: (0, pg_core_1.text)("item_id").references(() => exports.items.id, {
        onDelete: "set null",
    }),
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
    // Inferred sessions (created from Jellyfin UserData.Played, not real playback)
    isInferred: (0, pg_core_1.boolean)("is_inferred").notNull().default(false),
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
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    // Performance indexes for common query patterns
    (0, pg_core_1.index)("sessions_server_user_idx").on(table.serverId, table.userId),
    (0, pg_core_1.index)("sessions_server_item_idx").on(table.serverId, table.itemId),
    (0, pg_core_1.index)("sessions_server_created_at_idx").on(table.serverId, table.createdAt),
    (0, pg_core_1.index)("sessions_server_start_time_idx").on(table.serverId, table.startTime),
    (0, pg_core_1.index)("sessions_user_start_time_idx").on(table.userId, table.startTime),
]);
// Active sessions table - durable storage for currently open sessions (poller state)
exports.activeSessions = (0, pg_core_1.pgTable)("active_sessions", {
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    sessionKey: (0, pg_core_1.text)("session_key").notNull(),
    payload: (0, pg_core_1.jsonb)("payload").notNull(),
    lastSeenAt: (0, pg_core_1.timestamp)("last_seen_at", { withTimezone: true }).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.serverId, table.sessionKey] }),
    (0, pg_core_1.index)("active_sessions_server_last_seen_idx").on(table.serverId, table.lastSeenAt),
]);
// Activity log cursor per server - used to catch up Jellyfin activity log entries between polls
exports.activityLogCursors = (0, pg_core_1.pgTable)("activity_log_cursors", {
    serverId: (0, pg_core_1.integer)("server_id")
        .primaryKey()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    cursorDate: (0, pg_core_1.timestamp)("cursor_date", { withTimezone: true }),
    cursorId: (0, pg_core_1.text)("cursor_id"),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
});
// Activity locations table - geolocated IP data for activities
exports.activityLocations = (0, pg_core_1.pgTable)("activity_locations", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    activityId: (0, pg_core_1.text)("activity_id")
        .references(() => exports.activities.id, { onDelete: "cascade" })
        .notNull(),
    ipAddress: (0, pg_core_1.text)("ip_address").notNull(),
    // Geolocation data
    countryCode: (0, pg_core_1.text)("country_code"),
    country: (0, pg_core_1.text)("country"),
    region: (0, pg_core_1.text)("region"),
    city: (0, pg_core_1.text)("city"),
    latitude: (0, pg_core_1.doublePrecision)("latitude"),
    longitude: (0, pg_core_1.doublePrecision)("longitude"),
    timezone: (0, pg_core_1.text)("timezone"),
    // IP classification
    isPrivateIp: (0, pg_core_1.boolean)("is_private_ip").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("activity_locations_activity_id_idx").on(table.activityId),
    (0, pg_core_1.index)("activity_locations_ip_address_idx").on(table.ipAddress),
]);
// User fingerprints table - aggregated behavioral patterns per user
exports.userFingerprints = (0, pg_core_1.pgTable)("user_fingerprints", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.text)("user_id")
        .references(() => exports.users.id, { onDelete: "cascade" })
        .notNull(),
    serverId: (0, pg_core_1.integer)("server_id")
        .references(() => exports.servers.id, { onDelete: "cascade" })
        .notNull(),
    // Known patterns (JSONB arrays)
    knownDeviceIds: (0, pg_core_1.jsonb)("known_device_ids").$type().default([]),
    knownCountries: (0, pg_core_1.jsonb)("known_countries").$type().default([]),
    knownCities: (0, pg_core_1.jsonb)("known_cities").$type().default([]),
    knownClients: (0, pg_core_1.jsonb)("known_clients").$type().default([]),
    // Location patterns with frequency
    locationPatterns: (0, pg_core_1.jsonb)("location_patterns")
        .$type()
        .default([]),
    // Device patterns with frequency
    devicePatterns: (0, pg_core_1.jsonb)("device_patterns")
        .$type()
        .default([]),
    // Behavioral patterns - hourly activity histogram (hour 0-23 -> session count)
    hourHistogram: (0, pg_core_1.jsonb)("hour_histogram")
        .$type()
        .default({}),
    avgSessionsPerDay: (0, pg_core_1.doublePrecision)("avg_sessions_per_day"),
    totalSessions: (0, pg_core_1.integer)("total_sessions").default(0),
    lastCalculatedAt: (0, pg_core_1.timestamp)("last_calculated_at", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("user_fingerprints_user_id_idx").on(table.userId),
    (0, pg_core_1.index)("user_fingerprints_server_id_idx").on(table.serverId),
    (0, pg_core_1.unique)("user_fingerprints_user_server_unique").on(table.userId, table.serverId),
]);
// Anomaly events table - flagged suspicious activity
exports.anomalyEvents = (0, pg_core_1.pgTable)("anomaly_events", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.text)("user_id").references(() => exports.users.id, { onDelete: "cascade" }),
    serverId: (0, pg_core_1.integer)("server_id")
        .references(() => exports.servers.id, { onDelete: "cascade" })
        .notNull(),
    activityId: (0, pg_core_1.text)("activity_id").references(() => exports.activities.id, {
        onDelete: "set null",
    }),
    // Anomaly classification
    anomalyType: (0, pg_core_1.text)("anomaly_type").notNull(), // 'impossible_travel', 'new_location', 'concurrent_streams', 'new_device', 'new_country'
    severity: (0, pg_core_1.text)("severity").notNull(), // 'low', 'medium', 'high', 'critical'
    // Anomaly details
    details: (0, pg_core_1.jsonb)("details")
        .$type()
        .notNull(),
    // Resolution status
    resolved: (0, pg_core_1.boolean)("resolved").default(false).notNull(),
    resolvedAt: (0, pg_core_1.timestamp)("resolved_at", { withTimezone: true }),
    resolvedBy: (0, pg_core_1.text)("resolved_by"),
    resolutionNote: (0, pg_core_1.text)("resolution_note"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("anomaly_events_user_id_idx").on(table.userId),
    (0, pg_core_1.index)("anomaly_events_server_id_idx").on(table.serverId),
    (0, pg_core_1.index)("anomaly_events_activity_id_idx").on(table.activityId),
    (0, pg_core_1.index)("anomaly_events_anomaly_type_idx").on(table.anomalyType),
    (0, pg_core_1.index)("anomaly_events_resolved_idx").on(table.resolved),
]);
// People table - unique people (actors, directors, etc.) per server
// Note: type is stored per item-person relationship in item_people, not here
exports.people = (0, pg_core_1.pgTable)("people", {
    id: (0, pg_core_1.text)("id").notNull(), // Jellyfin person ID
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.text)("name").notNull(),
    primaryImageTag: (0, pg_core_1.text)("primary_image_tag"),
    searchVector: tsvector("search_vector"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.id, table.serverId] }),
    (0, pg_core_1.index)("people_name_trgm_idx").using("gin", table.name),
    (0, pg_core_1.index)("people_search_vector_idx").using("gin", table.searchVector),
    (0, pg_core_1.index)("people_server_id_idx").on(table.serverId),
]);
// Item-People junction table - links items to people with role info
// type is stored here because same person can have different roles in different items
// (e.g., Clint Eastwood can be Actor in one movie and Director in another)
exports.itemPeople = (0, pg_core_1.pgTable)("item_people", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    itemId: (0, pg_core_1.text)("item_id")
        .notNull()
        .references(() => exports.items.id, { onDelete: "cascade" }),
    personId: (0, pg_core_1.text)("person_id").notNull(),
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    type: (0, pg_core_1.text)("type").notNull(), // Actor, Director, Writer, Producer, etc.
    role: (0, pg_core_1.text)("role"), // Character name for actors
    sortOrder: (0, pg_core_1.integer)("sort_order"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    // Unique per item+person+type (same person can be Actor AND Director in same item)
    (0, pg_core_1.unique)("item_people_unique").on(table.itemId, table.personId, table.type),
    (0, pg_core_1.index)("item_people_person_idx").on(table.personId, table.serverId),
    (0, pg_core_1.index)("item_people_item_idx").on(table.itemId),
    (0, pg_core_1.index)("item_people_type_idx").on(table.serverId, table.type),
]);
// Watchlists table - user-created lists of media items
exports.watchlists = (0, pg_core_1.pgTable)("watchlists", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    serverId: (0, pg_core_1.integer)("server_id")
        .notNull()
        .references(() => exports.servers.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.text)("user_id").notNull(), // Jellyfin user ID who owns the list
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    isPublic: (0, pg_core_1.boolean)("is_public").notNull().default(false),
    isPromoted: (0, pg_core_1.boolean)("is_promoted").notNull().default(false), // Admin-only: visible on all users' home screens in external clients
    allowedItemType: (0, pg_core_1.text)("allowed_item_type"), // If set, only items of this type can be added (Movie, Series, Episode, etc.)
    defaultSortOrder: (0, pg_core_1.text)("default_sort_order").notNull().default("custom"), // custom, name, dateAdded, releaseDate
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
    // Full-text search vector - populated by database trigger
    searchVector: tsvector("search_vector"),
}, (table) => [
    (0, pg_core_1.index)("watchlists_server_user_idx").on(table.serverId, table.userId),
    (0, pg_core_1.index)("watchlists_server_public_idx").on(table.serverId, table.isPublic),
    (0, pg_core_1.index)("watchlists_server_promoted_idx").on(table.serverId, table.isPromoted),
    (0, pg_core_1.index)("watchlists_search_vector_idx").using("gin", table.searchVector),
]);
// Watchlist items junction table - items within watchlists
exports.watchlistItems = (0, pg_core_1.pgTable)("watchlist_items", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    watchlistId: (0, pg_core_1.integer)("watchlist_id")
        .notNull()
        .references(() => exports.watchlists.id, { onDelete: "cascade" }),
    itemId: (0, pg_core_1.text)("item_id")
        .notNull()
        .references(() => exports.items.id, { onDelete: "cascade" }),
    position: (0, pg_core_1.integer)("position").notNull().default(0), // For custom ordering
    addedAt: (0, pg_core_1.timestamp)("added_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("watchlist_items_watchlist_idx").on(table.watchlistId),
    (0, pg_core_1.index)("watchlist_items_item_idx").on(table.itemId),
    (0, pg_core_1.unique)("watchlist_items_unique").on(table.watchlistId, table.itemId),
]);
// Define relationships
exports.serversRelations = (0, drizzle_orm_1.relations)(exports.servers, ({ many }) => ({
    libraries: many(exports.libraries),
    users: many(exports.users),
    activities: many(exports.activities),
    items: many(exports.items),
    sessions: many(exports.sessions),
    hiddenRecommendations: many(exports.hiddenRecommendations),
    userFingerprints: many(exports.userFingerprints),
    anomalyEvents: many(exports.anomalyEvents),
    watchlists: many(exports.watchlists),
    people: many(exports.people),
    itemPeople: many(exports.itemPeople),
    jobConfigurations: many(exports.serverJobConfigurations),
}));
exports.serverJobConfigurationsRelations = (0, drizzle_orm_1.relations)(exports.serverJobConfigurations, ({ one }) => ({
    server: one(exports.servers, {
        fields: [exports.serverJobConfigurations.serverId],
        references: [exports.servers.id],
    }),
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
    fingerprints: many(exports.userFingerprints),
    anomalyEvents: many(exports.anomalyEvents),
}));
exports.activitiesRelations = (0, drizzle_orm_1.relations)(exports.activities, ({ one, many }) => ({
    server: one(exports.servers, {
        fields: [exports.activities.serverId],
        references: [exports.servers.id],
    }),
    user: one(exports.users, {
        fields: [exports.activities.userId],
        references: [exports.users.id],
    }),
    location: one(exports.activityLocations),
    anomalyEvents: many(exports.anomalyEvents),
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
    watchlistItems: many(exports.watchlistItems),
    itemPeople: many(exports.itemPeople),
}));
exports.sessionsRelations = (0, drizzle_orm_1.relations)(exports.sessions, ({ one, many }) => ({
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
exports.activityLocationsRelations = (0, drizzle_orm_1.relations)(exports.activityLocations, ({ one }) => ({
    activity: one(exports.activities, {
        fields: [exports.activityLocations.activityId],
        references: [exports.activities.id],
    }),
}));
exports.userFingerprintsRelations = (0, drizzle_orm_1.relations)(exports.userFingerprints, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.userFingerprints.userId],
        references: [exports.users.id],
    }),
    server: one(exports.servers, {
        fields: [exports.userFingerprints.serverId],
        references: [exports.servers.id],
    }),
}));
exports.anomalyEventsRelations = (0, drizzle_orm_1.relations)(exports.anomalyEvents, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.anomalyEvents.userId],
        references: [exports.users.id],
    }),
    server: one(exports.servers, {
        fields: [exports.anomalyEvents.serverId],
        references: [exports.servers.id],
    }),
    activity: one(exports.activities, {
        fields: [exports.anomalyEvents.activityId],
        references: [exports.activities.id],
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
exports.watchlistsRelations = (0, drizzle_orm_1.relations)(exports.watchlists, ({ one, many }) => ({
    server: one(exports.servers, {
        fields: [exports.watchlists.serverId],
        references: [exports.servers.id],
    }),
    items: many(exports.watchlistItems),
}));
exports.watchlistItemsRelations = (0, drizzle_orm_1.relations)(exports.watchlistItems, ({ one }) => ({
    watchlist: one(exports.watchlists, {
        fields: [exports.watchlistItems.watchlistId],
        references: [exports.watchlists.id],
    }),
    item: one(exports.items, {
        fields: [exports.watchlistItems.itemId],
        references: [exports.items.id],
    }),
}));
exports.peopleRelations = (0, drizzle_orm_1.relations)(exports.people, ({ one, many }) => ({
    server: one(exports.servers, {
        fields: [exports.people.serverId],
        references: [exports.servers.id],
    }),
    itemPeople: many(exports.itemPeople),
}));
exports.itemPeopleRelations = (0, drizzle_orm_1.relations)(exports.itemPeople, ({ one }) => ({
    item: one(exports.items, {
        fields: [exports.itemPeople.itemId],
        references: [exports.items.id],
    }),
    person: one(exports.people, {
        fields: [exports.itemPeople.personId, exports.itemPeople.serverId],
        references: [exports.people.id, exports.people.serverId],
    }),
    server: one(exports.servers, {
        fields: [exports.itemPeople.serverId],
        references: [exports.servers.id],
    }),
}));
//# sourceMappingURL=schema.js.map