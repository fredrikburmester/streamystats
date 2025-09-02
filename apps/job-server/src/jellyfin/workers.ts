import { eq } from "drizzle-orm";
import { db, servers, Server } from "@streamystats/database";
import {
  performFullSync,
  syncUsers,
  syncLibraries,
  syncItems,
  syncRecentlyAddedItems,
  syncActivities,
  syncRecentActivities,
  SyncOptions,
} from "./sync";

export interface JellyfinSyncJobData {
  serverId: number;
  syncType:
    | "full"
    | "users"
    | "libraries"
    | "items"
    | "activities"
    | "recentItems"
    | "recentActivities";
  options?: SyncOptions;
}

export interface JellyfinServerSyncJobData {
  serverId: number;
  options?: SyncOptions;
}

/**
 * Main Jellyfin sync job worker
 */
export async function jellyfinSyncWorker(job: {
  data: JellyfinSyncJobData;
}): Promise<any> {
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
        result = await performFullSync(server, options);
        break;
      case "users":
        result = await syncUsers(server, options.userOptions);
        break;
      case "libraries":
        result = await syncLibraries(server, options.libraryOptions);
        break;
      case "items":
        result = await syncItems(server, options.itemOptions);
        break;
      case "activities":
        result = await syncActivities(server, options.activityOptions);
        break;
      case "recentItems":
        result = await syncRecentlyAddedItems(
          server,
          options.itemOptions?.recentItemsLimit || 100
        );
        break;
      case "recentActivities":
        result = await syncRecentActivities(server, {
          pageSize: 100,
          maxPages: 10,
          intelligent: options.activityOptions?.intelligent || false,
          ...options.activityOptions,
        });
        break;
      default:
        throw new Error(`Unknown sync type: ${syncType}`);
    }

    console.log(
      `Jellyfin ${syncType} sync completed for server ${server.name}:`,
      {
        status: result.status,
        duration: result.metrics.duration,
      }
    );

    // Update server sync status based on result
    if (result.status === "success") {
      await updateServerSyncStatus(serverId, "completed", "completed");
    } else if (result.status === "partial") {
      await updateServerSyncStatus(
        serverId,
        "completed",
        "completed",
        `Partial success with ${result.errors?.length || 0} errors`
      );
    } else {
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
  } catch (error) {
    console.error(
      `Jellyfin ${syncType} sync failed for server ID ${serverId}:`,
      error
    );

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await updateServerSyncStatus(serverId, "failed", syncType, errorMessage);

    throw error; // Re-throw to mark job as failed
  }
}

/**
 * Full sync job worker - performs complete sync of all data
 */
export async function jellyfinFullSyncWorker(job: {
  data: JellyfinServerSyncJobData;
}): Promise<any> {
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
export async function jellyfinUsersSyncWorker(job: {
  data: JellyfinServerSyncJobData;
}): Promise<any> {
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
export async function jellyfinLibrariesSyncWorker(job: {
  data: JellyfinServerSyncJobData;
}): Promise<any> {
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
export async function jellyfinItemsSyncWorker(job: {
  data: JellyfinServerSyncJobData;
}): Promise<any> {
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
export async function jellyfinActivitiesSyncWorker(job: {
  data: JellyfinServerSyncJobData;
}): Promise<any> {
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
export async function jellyfinRecentItemsSyncWorker(job: {
  data: JellyfinServerSyncJobData;
}): Promise<any> {
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
export async function jellyfinRecentActivitiesSyncWorker(job: {
  data: JellyfinServerSyncJobData;
}): Promise<any> {
  return jellyfinSyncWorker({
    data: {
      serverId: job.data.serverId,
      syncType: "recentActivities",
      options: job.data.options,
    },
  });
}

// Helper functions

async function getServer(serverId: number): Promise<Server | null> {
  const result = await db
    .select()
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

async function updateServerSyncStatus(
  serverId: number,
  status: string,
  progress: string,
  error?: string
): Promise<void> {
  const updateData: any = {
    syncStatus: status,
    syncProgress: progress,
    updatedAt: new Date(),
  };

  if (status === "syncing") {
    updateData.lastSyncStarted = new Date();
    updateData.syncError = null; // Clear previous errors
  } else if (status === "completed") {
    updateData.lastSyncCompleted = new Date();
    updateData.syncError = error || null;
  } else if (status === "failed") {
    updateData.syncError = error;
  }

  await db.update(servers).set(updateData).where(eq(servers.id, serverId));
}

// Export job names for queue registration
export const JELLYFIN_JOB_NAMES = {
  FULL_SYNC: "jellyfin-full-sync",
  USERS_SYNC: "jellyfin-users-sync",
  LIBRARIES_SYNC: "jellyfin-libraries-sync",
  ITEMS_SYNC: "jellyfin-items-sync",
  ACTIVITIES_SYNC: "jellyfin-activities-sync",
  RECENT_ITEMS_SYNC: "jellyfin-recent-items-sync",
  RECENT_ACTIVITIES_SYNC: "jellyfin-recent-activities-sync",
} as const;
