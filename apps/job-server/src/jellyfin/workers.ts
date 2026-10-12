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
import { syncPeopleForServer } from "./sync/people";
import { syncRatingsForServer } from "./sync/ratings";
import { getJobQueue } from "../jobs/queue";
import { logJobResult } from "../jobs/job-logger";
import { publishJobEvent, nowIsoMicroUtc } from "../events/job-events";
import { formatError } from "../utils/format-error";

export interface JellyfinSyncJobData {
  serverId: number;
  syncType:
    | "full"
    | "users"
    | "libraries"
    | "items"
    | "activities"
    | "recent_items"
    | "recent_activities";
  options?: SyncOptions;
}

export interface JellyfinServerSyncJobData {
  serverId: number;
  options?: SyncOptions;
}

export interface JellyfinPeopleSyncJobData {
  serverId: number;
}

export interface JellyfinRatingsSyncJobData {
  serverId: number;
}

/**
 * Main Jellyfin sync job worker
 */
export async function jellyfinSyncWorker(job: {
  data: JellyfinSyncJobData;
}): Promise<any> {
  const { serverId, syncType, options = {} } = job.data;

  console.info(
    `[jellyfin-sync] serverId=${serverId} syncType=${syncType} action=start`
  );

  // Publish job started event
  publishJobEvent({
    type: "started",
    jobName: `jellyfin-${syncType}-sync`,
    serverId,
    timestamp: nowIsoMicroUtc(),
  });

  try {
    // Get server configuration
    const server = await getServer(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    console.info(
      `[jellyfin-sync] server=${server.name} serverId=${serverId} syncType=${syncType} action=loadedServer url=${server.url}`
    );

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
      case "recent_items":
        result = await syncRecentlyAddedItems(
          server,
          options.itemOptions?.recentItemsLimit || 100
        );
        break;
      case "recent_activities":
        result = await syncRecentActivities(server, {
          pageSize: 100,
          maxPages: 1,
          intelligent: options.activityOptions?.intelligent || false,
          ...options.activityOptions,
        });
        break;
      default:
        throw new Error(`Unknown sync type: ${syncType}`);
    }

    console.info(
      `[jellyfin-sync] server=${server.name} serverId=${serverId} syncType=${syncType} action=completed status=${result.status} durationMs=${result.metrics.duration}`
    );

    // Publish job completed event
    publishJobEvent({
      type: "completed",
      jobName: `jellyfin-${syncType}-sync`,
      serverId,
      timestamp: nowIsoMicroUtc(),
      data: {
        status: result.status,
        duration: result.metrics.duration,
      },
    });

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

    // Kick off People sync after items sync completes (runs in background)
    if (syncType === "items" && result.status !== "error") {
      try {
        const boss = await getJobQueue();
        await boss.send(
          JELLYFIN_JOB_NAMES.PEOPLE_SYNC,
          { serverId },
          { singletonKey: `jellyfin-people-sync-${serverId}` }
        );
      } catch (error) {
        console.error(
          `Failed to enqueue people sync for server ${serverId}: ${formatError(
            error
          )}`
        );
      }
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
      `Jellyfin ${syncType} sync failed for server ID ${serverId}: ${formatError(
        error
      )}`
    );

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Publish job failed event
    publishJobEvent({
      type: "failed",
      jobName: `jellyfin-${syncType}-sync`,
      serverId,
      timestamp: nowIsoMicroUtc(),
      error: errorMessage,
    });

    await updateServerSyncStatus(serverId, "failed", syncType, errorMessage);

    throw error; // Re-throw to mark job as failed
  }
}

/**
 * Factory to create sync workers for different sync types
 */
function createSyncWorker(syncType: JellyfinSyncJobData["syncType"]) {
  return (job: { data: JellyfinServerSyncJobData }) =>
    jellyfinSyncWorker({
      data: {
        serverId: job.data.serverId,
        syncType,
        options: job.data.options,
      },
    });
}

export const jellyfinFullSyncWorker = createSyncWorker("full");
export const jellyfinUsersSyncWorker = createSyncWorker("users");
export const jellyfinLibrariesSyncWorker = createSyncWorker("libraries");
export const jellyfinItemsSyncWorker = createSyncWorker("items");
export const jellyfinActivitiesSyncWorker = createSyncWorker("activities");
export const jellyfinRecentItemsSyncWorker = createSyncWorker("recent_items");
export const jellyfinRecentActivitiesSyncWorker = createSyncWorker("recent_activities");

/**
 * People sync job worker - syncs people data to the people and item_people tables
 */
export async function jellyfinRatingsSyncWorker(job: {
  id: string;
  data: JellyfinRatingsSyncJobData;
}): Promise<{ success: boolean; native: number; enhanced: number | null; unmatched: number }> {
  const startTime = Date.now();
  const { serverId } = job.data;
  try {
    await logJobResult(
      job.id,
      JELLYFIN_JOB_NAMES.RATINGS_SYNC,
      "processing",
      { serverId, status: "starting" },
      Date.now() - startTime
    );
    const result = await syncRatingsForServer(serverId);
    await logJobResult(
      job.id,
      JELLYFIN_JOB_NAMES.RATINGS_SYNC,
      "completed",
      { serverId, ...result },
      Date.now() - startTime
    );
    return { success: true, ...result };
  } catch (error) {
    await logJobResult(
      job.id,
      JELLYFIN_JOB_NAMES.RATINGS_SYNC,
      "failed",
      { serverId, error: error instanceof Error ? error.message : String(error) },
      Date.now() - startTime,
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

export async function jellyfinPeopleSyncWorker(job: {
  id: string;
  data: JellyfinPeopleSyncJobData;
}): Promise<any> {
  const startTime = Date.now();
  const { serverId } = job.data;

  try {
    await logJobResult(
      job.id,
      JELLYFIN_JOB_NAMES.PEOPLE_SYNC,
      "processing",
      { serverId, status: "starting" },
      Date.now() - startTime
    );

    const { processed, remaining } = await syncPeopleForServer(
      job.id,
      { serverId },
      { maxRuntimeMs: 14 * 60 * 1000 }
    );

    await logJobResult(
      job.id,
      JELLYFIN_JOB_NAMES.PEOPLE_SYNC,
      "completed",
      { serverId, processed, remaining },
      Date.now() - startTime
    );

    return { success: true, processed, remaining };
  } catch (error) {
    await logJobResult(
      job.id,
      JELLYFIN_JOB_NAMES.PEOPLE_SYNC,
      "failed",
      {
        serverId,
        error: error instanceof Error ? error.message : String(error),
      },
      Date.now() - startTime,
      error instanceof Error ? error : undefined
    );
    throw error;
  }
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
  PEOPLE_SYNC: "jellyfin-people-sync",
  RATINGS_SYNC: "jellyfin-ratings-sync",
} as const;
