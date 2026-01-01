import { db, servers, Server } from "@streamystats/database";
import { eq } from "drizzle-orm";
import { syncUsers, UserSyncOptions, UserSyncData } from "./users";
import {
  syncLibraries,
  LibrarySyncOptions,
  LibrarySyncData,
} from "./libraries";
import {
  syncItems,
  syncRecentlyAddedItems,
  ItemSyncOptions,
  ItemSyncData,
} from "./items";
import {
  syncActivities,
  syncRecentActivities,
  ActivitySyncOptions,
  ActivitySyncData,
} from "./activities";
import {
  SyncResult,
  SyncMetrics,
  SyncMetricsTracker,
  createSyncResult,
} from "../sync-metrics";
import { formatSyncLogLine } from "./sync-log";
import { JellyfinClient } from "../client";

export interface SyncOptions {
  // Global options
  maxLibraryConcurrency?: number;
  dbBatchSize?: number;
  apiRequestDelayMs?: number;
  maxRetries?: number;
  retryInitialDelayMs?: number;
  adaptiveThrottling?: boolean;

  // Specific module options
  userOptions?: UserSyncOptions;
  libraryOptions?: LibrarySyncOptions;
  itemOptions?: ItemSyncOptions;
  activityOptions?: ActivitySyncOptions;
}

export interface FullSyncData {
  users: UserSyncData;
  libraries: LibrarySyncData;
  items: ItemSyncData;
  activities: ActivitySyncData;
  totalDuration: number;
}

// Default sync options based on the Elixir configuration
export const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  maxLibraryConcurrency: 2,
  dbBatchSize: 1000,
  apiRequestDelayMs: 100,
  maxRetries: 3,
  retryInitialDelayMs: 1000,
  adaptiveThrottling: true,
};

/**
 * Syncs server metadata from Jellyfin's System/Info endpoint.
 * Updates name, version, localAddress, productName, and operatingSystem.
 * This ensures we have current server info for auth method detection and display.
 */
async function syncServerInfo(server: Server): Promise<void> {
  try {
    const client = JellyfinClient.fromServer(server);
    const systemInfo = await client.getServerInfo();

    const updates: Record<string, string | Date> = {};
    const changes: string[] = [];

    if (systemInfo.ServerName && systemInfo.ServerName !== server.name) {
      updates.name = systemInfo.ServerName;
      changes.push(`name: ${server.name} -> ${systemInfo.ServerName}`);
    }

    if (systemInfo.Version && systemInfo.Version !== server.version) {
      updates.version = systemInfo.Version;
      changes.push(`version: ${server.version ?? "null"} -> ${systemInfo.Version}`);
    }

    if (systemInfo.LocalAddress && systemInfo.LocalAddress !== server.localAddress) {
      updates.localAddress = systemInfo.LocalAddress;
      changes.push(`localAddress: ${server.localAddress ?? "null"} -> ${systemInfo.LocalAddress}`);
    }

    if (systemInfo.ProductName && systemInfo.ProductName !== server.productName) {
      updates.productName = systemInfo.ProductName;
      changes.push(`productName: ${server.productName ?? "null"} -> ${systemInfo.ProductName}`);
    }

    if (systemInfo.OperatingSystem && systemInfo.OperatingSystem !== server.operatingSystem) {
      updates.operatingSystem = systemInfo.OperatingSystem;
      changes.push(`operatingSystem: ${server.operatingSystem ?? "null"} -> ${systemInfo.OperatingSystem}`);
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await db
        .update(servers)
        .set(updates)
        .where(eq(servers.id, server.id));

      console.info(
        `[server-info-sync] Updated server ${server.name}: ${changes.join(", ")}`
      );
    }
  } catch (error) {
    // Server info sync failure is non-fatal - log and continue with the sync
    console.warn(
      `[server-info-sync] Failed to sync info for server ${server.name}:`,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Main sync coordinator - performs a full sync of all data types
 */
export async function performFullSync(
  server: Server,
  options: SyncOptions = {}
): Promise<SyncResult<FullSyncData>> {
  const finalOptions = { ...DEFAULT_SYNC_OPTIONS, ...options };
  const globalMetrics = new SyncMetricsTracker();
  const errors: string[] = [];

  const fullSyncStart = Date.now();
  console.info(
    formatSyncLogLine("full-sync", {
      server: server.name,
      page: 0,
      processed: 0,
      inserted: 0,
      updated: 0,
      errors: 0,
      processMs: 0,
      totalProcessed: 0,
      phase: "start",
    })
  );

  try {
    // 0. Sync server info (name, version, localAddress, etc.)
    await syncServerInfo(server);

    // 1. Sync Users
    const usersStart = Date.now();
    console.info(
      formatSyncLogLine("full-sync", {
        server: server.name,
        page: 1,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: 0,
        step: "users",
        phase: "start",
      })
    );
    const usersResult = await syncUsers(server, finalOptions.userOptions);
    if (usersResult.status === "error") {
      errors.push(`Users: ${usersResult.error}`);
    } else if (usersResult.status === "partial") {
      errors.push(...usersResult.errors.map((e) => `Users: ${e}`));
    }
    console.info(
      formatSyncLogLine("full-sync", {
        server: server.name,
        page: 1,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors:
          usersResult.status === "partial"
            ? usersResult.errors.length
            : usersResult.status === "error"
              ? 1
              : 0,
        processMs: Date.now() - usersStart,
        totalProcessed: 0,
        step: "users",
        phase: "done",
        status: usersResult.status,
      })
    );

    // 2. Sync Libraries
    const librariesStart = Date.now();
    console.info(
      formatSyncLogLine("full-sync", {
        server: server.name,
        page: 2,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: 0,
        step: "libraries",
        phase: "start",
      })
    );
    const librariesResult = await syncLibraries(
      server,
      finalOptions.libraryOptions
    );
    if (librariesResult.status === "error") {
      errors.push(`Libraries: ${librariesResult.error}`);
    } else if (librariesResult.status === "partial") {
      errors.push(...librariesResult.errors.map((e) => `Libraries: ${e}`));
    }
    console.info(
      formatSyncLogLine("full-sync", {
        server: server.name,
        page: 2,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors:
          librariesResult.status === "partial"
            ? librariesResult.errors.length
            : librariesResult.status === "error"
              ? 1
              : 0,
        processMs: Date.now() - librariesStart,
        totalProcessed: 0,
        step: "libraries",
        phase: "done",
        status: librariesResult.status,
      })
    );

    // 3. Sync Items (this will take the longest)
    const itemsStart = Date.now();
    console.info(
      formatSyncLogLine("full-sync", {
        server: server.name,
        page: 3,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: 0,
        step: "items",
        phase: "start",
      })
    );
    const itemsResult = await syncItems(server, {
      ...finalOptions.itemOptions,
      maxLibraryConcurrency: finalOptions.maxLibraryConcurrency,
      apiRequestDelayMs: finalOptions.apiRequestDelayMs,
    });
    if (itemsResult.status === "error") {
      errors.push(`Items: ${itemsResult.error}`);
    } else if (itemsResult.status === "partial") {
      errors.push(...itemsResult.errors.map((e) => `Items: ${e}`));
    }
    console.info(
      formatSyncLogLine("full-sync", {
        server: server.name,
        page: 3,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors:
          itemsResult.status === "partial"
            ? itemsResult.errors.length
            : itemsResult.status === "error"
              ? 1
              : 0,
        processMs: Date.now() - itemsStart,
        totalProcessed: 0,
        step: "items",
        phase: "done",
        status: itemsResult.status,
      })
    );

    // 4. Sync Activities
    const activitiesStart = Date.now();
    console.info(
      formatSyncLogLine("full-sync", {
        server: server.name,
        page: 4,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: 0,
        step: "activities",
        phase: "start",
      })
    );
    const activitiesResult = await syncActivities(
      server,
      finalOptions.activityOptions
    );
    if (activitiesResult.status === "error") {
      errors.push(`Activities: ${activitiesResult.error}`);
    } else if (activitiesResult.status === "partial") {
      errors.push(...activitiesResult.errors.map((e) => `Activities: ${e}`));
    }
    console.info(
      formatSyncLogLine("full-sync", {
        server: server.name,
        page: 4,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors:
          activitiesResult.status === "partial"
            ? activitiesResult.errors.length
            : activitiesResult.status === "error"
              ? 1
              : 0,
        processMs: Date.now() - activitiesStart,
        totalProcessed: 0,
        step: "activities",
        phase: "done",
        status: activitiesResult.status,
      })
    );

    const finalMetrics = globalMetrics.finish();

    // Helper function to safely extract data from sync results
    const getSyncData = <T>(result: SyncResult<T>, defaultValue: T): T => {
      return result.status === "error" ? defaultValue : result.data;
    };

    const fullSyncData: FullSyncData = {
      users: getSyncData(usersResult, {
        usersProcessed: 0,
        usersInserted: 0,
        usersUpdated: 0,
      }),
      libraries: getSyncData(librariesResult, {
        librariesProcessed: 0,
        librariesInserted: 0,
        librariesUpdated: 0,
      }),
      items: getSyncData(itemsResult, {
        librariesProcessed: 0,
        itemsProcessed: 0,
        itemsInserted: 0,
        itemsUpdated: 0,
        itemsUnchanged: 0,
      }),
      activities: getSyncData(activitiesResult, {
        activitiesProcessed: 0,
        activitiesInserted: 0,
        activitiesUpdated: 0,
        pagesFetched: 0,
      }),
      totalDuration: finalMetrics.duration || 0,
    };

    console.info(
      formatSyncLogLine("full-sync", {
        server: server.name,
        page: -1,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: errors.length,
        processMs: finalMetrics.duration ?? Date.now() - fullSyncStart,
        totalProcessed: 0,
        phase: "done",
      })
    );

    // Determine overall result
    const hasErrors = [
      usersResult,
      librariesResult,
      itemsResult,
      activitiesResult,
    ].some((result) => result.status === "error");

    const hasPartialErrors = [
      usersResult,
      librariesResult,
      itemsResult,
      activitiesResult,
    ].some((result) => result.status === "partial");

    if (hasErrors) {
      return createSyncResult(
        "error",
        fullSyncData,
        finalMetrics,
        "One or more sync operations failed",
        errors
      );
    } else if (hasPartialErrors || errors.length > 0) {
      return createSyncResult(
        "partial",
        fullSyncData,
        finalMetrics,
        undefined,
        errors
      );
    } else {
      return createSyncResult("success", fullSyncData, finalMetrics);
    }
  } catch (error) {
    console.error(
      formatSyncLogLine("full-sync", {
        server: server.name,
        page: -1,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 1,
        processMs: Date.now() - fullSyncStart,
        totalProcessed: 0,
        phase: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    );
    const finalMetrics = globalMetrics.finish();
    const errorData: FullSyncData = {
      users: { usersProcessed: 0, usersInserted: 0, usersUpdated: 0 },
      libraries: {
        librariesProcessed: 0,
        librariesInserted: 0,
        librariesUpdated: 0,
      },
      items: {
        librariesProcessed: 0,
        itemsProcessed: 0,
        itemsInserted: 0,
        itemsUpdated: 0,
        itemsUnchanged: 0,
      },
      activities: {
        activitiesProcessed: 0,
        activitiesInserted: 0,
        activitiesUpdated: 0,
        pagesFetched: 0,
      },
      totalDuration: finalMetrics.duration || 0,
    };
    return createSyncResult(
      "error",
      errorData,
      finalMetrics,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

export * from "./users";
export * from "./libraries";
export * from "./items";
export * from "./activities";
export * from "./deleted-items";

export type { SyncResult, SyncMetrics };

/**
 * Returns the default synchronization options.
 * These can be overridden by passing a map of options to the sync functions.
 */
export function getDefaultOptions(): SyncOptions {
  return { ...DEFAULT_SYNC_OPTIONS };
}
