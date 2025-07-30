"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JELLYFIN_JOB_NAMES = void 0;
exports.jellyfinSyncWorker = jellyfinSyncWorker;
exports.jellyfinFullSyncWorker = jellyfinFullSyncWorker;
exports.jellyfinUsersSyncWorker = jellyfinUsersSyncWorker;
exports.jellyfinLibrariesSyncWorker = jellyfinLibrariesSyncWorker;
exports.jellyfinItemsSyncWorker = jellyfinItemsSyncWorker;
exports.jellyfinActivitiesSyncWorker = jellyfinActivitiesSyncWorker;
exports.jellyfinRecentItemsSyncWorker = jellyfinRecentItemsSyncWorker;
exports.jellyfinRecentActivitiesSyncWorker = jellyfinRecentActivitiesSyncWorker;
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("@streamystats/database");
const sync_1 = require("./sync");
/**
 * Main Jellyfin sync job worker
 */
async function jellyfinSyncWorker(job) {
    const { serverId, syncType, options = {} } = job.data;
    console.log(`Starting Jellyfin ${syncType} sync for server ID: ${serverId}`);
    try {
        // Get server configuration
        const server = await getServer(serverId);
        if (!server) {
            throw new Error(`Server not found: ${serverId}`);
        }
        console.log(`Found server: ${server.name} (${server.url})`);
        // Update server sync status
        await updateServerSyncStatus(serverId, "syncing", syncType);
        let result;
        switch (syncType) {
            case "full":
                result = await (0, sync_1.performFullSync)(server, options);
                break;
            case "users":
                result = await (0, sync_1.syncUsers)(server, options.userOptions);
                break;
            case "libraries":
                result = await (0, sync_1.syncLibraries)(server, options.libraryOptions);
                break;
            case "items":
                result = await (0, sync_1.syncItems)(server, options.itemOptions);
                break;
            case "activities":
                result = await (0, sync_1.syncActivities)(server, options.activityOptions);
                break;
            case "recentItems":
                result = await (0, sync_1.syncRecentlyAddedItems)(server, options.itemOptions?.recentItemsLimit || 100);
                break;
            case "recentActivities":
                result = await (0, sync_1.syncRecentActivities)(server, {
                    pageSize: 100,
                    maxPages: 10,
                    intelligent: options.activityOptions?.intelligent || false,
                    ...options.activityOptions,
                });
                break;
            default:
                throw new Error(`Unknown sync type: ${syncType}`);
        }
        console.log(`Jellyfin ${syncType} sync completed for server ${server.name}:`, {
            status: result.status,
            duration: result.metrics.duration,
        });
        // Update server sync status based on result
        if (result.status === "success") {
            await updateServerSyncStatus(serverId, "completed", "completed");
        }
        else if (result.status === "partial") {
            await updateServerSyncStatus(serverId, "completed", "completed", `Partial success with ${result.errors?.length || 0} errors`);
        }
        else {
            await updateServerSyncStatus(serverId, "failed", syncType, result.error);
        }
        return {
            success: result.status === "success",
            status: result.status,
            data: result.status === "error" ? undefined : result.data,
            error: result.status === "error" ? result.error : undefined,
            errors: result.status === "partial" ? result.errors : undefined,
            metrics: result.metrics,
        };
    }
    catch (error) {
        console.error(`Jellyfin ${syncType} sync failed for server ID ${serverId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await updateServerSyncStatus(serverId, "failed", syncType, errorMessage);
        throw error; // Re-throw to mark job as failed
    }
}
/**
 * Full sync job worker - performs complete sync of all data
 */
async function jellyfinFullSyncWorker(job) {
    return jellyfinSyncWorker({
        data: {
            serverId: job.data.serverId,
            syncType: "full",
            options: job.data.options,
        },
    });
}
/**
 * Users sync job worker
 */
async function jellyfinUsersSyncWorker(job) {
    return jellyfinSyncWorker({
        data: {
            serverId: job.data.serverId,
            syncType: "users",
            options: job.data.options,
        },
    });
}
/**
 * Libraries sync job worker
 */
async function jellyfinLibrariesSyncWorker(job) {
    return jellyfinSyncWorker({
        data: {
            serverId: job.data.serverId,
            syncType: "libraries",
            options: job.data.options,
        },
    });
}
/**
 * Items sync job worker
 */
async function jellyfinItemsSyncWorker(job) {
    return jellyfinSyncWorker({
        data: {
            serverId: job.data.serverId,
            syncType: "items",
            options: job.data.options,
        },
    });
}
/**
 * Activities sync job worker
 */
async function jellyfinActivitiesSyncWorker(job) {
    return jellyfinSyncWorker({
        data: {
            serverId: job.data.serverId,
            syncType: "activities",
            options: job.data.options,
        },
    });
}
/**
 * Recent items sync job worker
 */
async function jellyfinRecentItemsSyncWorker(job) {
    return jellyfinSyncWorker({
        data: {
            serverId: job.data.serverId,
            syncType: "recentItems",
            options: job.data.options,
        },
    });
}
/**
 * Recent activities sync job worker
 */
async function jellyfinRecentActivitiesSyncWorker(job) {
    return jellyfinSyncWorker({
        data: {
            serverId: job.data.serverId,
            syncType: "recentActivities",
            options: job.data.options,
        },
    });
}
// Helper functions
async function getServer(serverId) {
    const result = await database_1.db
        .select()
        .from(database_1.servers)
        .where((0, drizzle_orm_1.eq)(database_1.servers.id, serverId))
        .limit(1);
    return result.length > 0 ? result[0] : null;
}
async function updateServerSyncStatus(serverId, status, progress, error) {
    const updateData = {
        syncStatus: status,
        syncProgress: progress,
        updatedAt: new Date(),
    };
    if (status === "syncing") {
        updateData.lastSyncStarted = new Date();
        updateData.syncError = null; // Clear previous errors
    }
    else if (status === "completed") {
        updateData.lastSyncCompleted = new Date();
        updateData.syncError = error || null;
    }
    else if (status === "failed") {
        updateData.syncError = error;
    }
    await database_1.db.update(database_1.servers).set(updateData).where((0, drizzle_orm_1.eq)(database_1.servers.id, serverId));
}
// Export job names for queue registration
exports.JELLYFIN_JOB_NAMES = {
    FULL_SYNC: "jellyfin-full-sync",
    USERS_SYNC: "jellyfin-users-sync",
    LIBRARIES_SYNC: "jellyfin-libraries-sync",
    ITEMS_SYNC: "jellyfin-items-sync",
    ACTIVITIES_SYNC: "jellyfin-activities-sync",
    RECENT_ITEMS_SYNC: "jellyfin-recent-items-sync",
    RECENT_ACTIVITIES_SYNC: "jellyfin-recent-activities-sync",
};
