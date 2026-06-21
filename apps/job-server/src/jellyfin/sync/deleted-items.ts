import { eq, and, isNull, inArray } from "drizzle-orm";
import {
  db,
  items,
  itemLibraries,
  sessions,
  libraries,
  hiddenRecommendations,
  Server,
} from "@streamystats/database";
import { JellyfinClient, MinimalJellyfinItem } from "../client";
import { formatSyncLogLine } from "./sync-log";

export interface CleanupMetrics {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  librariesScanned: number;
  itemsScanned: number;
  jellyfinItemsCount: number;
  databaseItemsCount: number;
  itemsSoftDeleted: number;
  itemsMigrated: number;
  sessionsMigrated: number;
  hiddenRecommendationsDeleted: number;
  hiddenRecommendationsMigrated: number;
  apiRequests: number;
  databaseOperations: number;
  errors: number;
  peakMemoryMB?: number;
}

export interface CleanupResult {
  status: "success" | "partial" | "error";
  metrics: CleanupMetrics;
  errors?: string[];
}

interface MatchResult {
  type: "deleted" | "migrated" | "exists";
  oldItemId: string;
  newItemId?: string;
  matchReason?: string;
}

interface LibraryCleanupResult {
  itemsToDelete: string[];
  itemsToMigrate: Array<{ oldId: string; newId: string; reason: string }>;
  itemsScanned: number;
}

/**
 * Get current memory usage in MB
 */
function getMemoryUsageMB(): number {
  const usage = process.memoryUsage();
  return Math.round(usage.heapUsed / 1024 / 1024);
}

/**
 * Detect and handle deleted items from Jellyfin server.
 * - Soft deletes items no longer in Jellyfin
 * - Migrates sessions/recommendations for re-added items (same providerIds but different ID)
 *
 * Memory optimization: Processes database items per-library to limit memory usage.
 * Jellyfin items are still loaded globally for cross-library matching support.
 */
export async function cleanupDeletedItems(
  server: Server
): Promise<CleanupResult> {
  const metrics: CleanupMetrics = {
    startTime: new Date(),
    librariesScanned: 0,
    itemsScanned: 0,
    jellyfinItemsCount: 0,
    databaseItemsCount: 0,
    itemsSoftDeleted: 0,
    itemsMigrated: 0,
    sessionsMigrated: 0,
    hiddenRecommendationsDeleted: 0,
    hiddenRecommendationsMigrated: 0,
    apiRequests: 0,
    databaseOperations: 0,
    errors: 0,
    peakMemoryMB: getMemoryUsageMB(),
  };
  const errors: string[] = [];

  const updatePeakMemory = () => {
    const currentMB = getMemoryUsageMB();
    if (currentMB > (metrics.peakMemoryMB || 0)) {
      metrics.peakMemoryMB = currentMB;
    }
  };

  try {
    const client = JellyfinClient.fromServer(server);

    console.info(
      formatSyncLogLine("deleted-items-cleanup", {
        server: server.name,
        page: 0,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: 0,
        memoryMB: getMemoryUsageMB(),
        phase: "start",
      })
    );

    // Safety check: Verify server is reachable before proceeding
    const serverHealthy = await client.isServerHealthy();
    if (!serverHealthy) {
      console.warn(
        formatSyncLogLine("deleted-items-cleanup", {
          server: server.name,
          page: -1,
          processed: 0,
          inserted: 0,
          updated: 0,
          errors: 1,
          processMs: 0,
          totalProcessed: 0,
          message: "Server unreachable - aborting to prevent false deletions",
          phase: "abort",
        })
      );
      metrics.endTime = new Date();
      metrics.duration =
        metrics.endTime.getTime() - metrics.startTime.getTime();
      metrics.errors++;
      return {
        status: "error",
        metrics,
        errors: [
          "Server unreachable - cleanup aborted to prevent marking all items as deleted",
        ],
      };
    }

    // Get all libraries for this server
    const serverLibraries = await db
      .select()
      .from(libraries)
      .where(eq(libraries.serverId, server.id));

    metrics.databaseOperations++;

    // Phase 1: Build global Jellyfin lookup maps (needed for cross-library matching)
    const jellyfinItemsMap = new Map<string, MinimalJellyfinItem>();
    const providerIdToJellyfinItem = new Map<string, MinimalJellyfinItem>();
    // Fallback maps using stable attributes (not IDs that change on re-add)
    const episodeKeyToJellyfinItem = new Map<string, MinimalJellyfinItem>();
    const seasonKeyToJellyfinItem = new Map<string, MinimalJellyfinItem>();
    const seriesKeyToJellyfinItem = new Map<string, MinimalJellyfinItem>();

    // Track which libraries we successfully fetched - if any fail, we should not delete items from those libraries
    const successfullyFetchedLibraries = new Set<string>();
    const failedLibraries: string[] = [];

    for (const library of serverLibraries) {
      try {
        metrics.apiRequests++;
        const libraryItems = await client.getAllItemsMinimal(library.id);
        metrics.librariesScanned++;
        successfullyFetchedLibraries.add(library.id);

        // Build all lookup maps in a single pass
        for (const item of libraryItems) {
          jellyfinItemsMap.set(item.Id, item);

          // Index by ProviderIds (IMDB, TMDB, etc.)
          if (item.ProviderIds) {
            for (const [provider, id] of Object.entries(item.ProviderIds)) {
              if (id) {
                providerIdToJellyfinItem.set(`${provider}:${id}`, item);
              }
            }
          }

          // Index episodes by seriesName + year + season + episode (stable across re-adds)
          if (
            item.Type === "Episode" &&
            item.SeriesName &&
            item.ProductionYear &&
            item.IndexNumber !== undefined &&
            item.ParentIndexNumber !== undefined
          ) {
            const key = `episode:${item.SeriesName.toLowerCase()}:${
              item.ProductionYear
            }:${item.ParentIndexNumber}:${item.IndexNumber}`;
            episodeKeyToJellyfinItem.set(key, item);
          }

          // Index seasons by seriesName + year + seasonNumber
          if (
            item.Type === "Season" &&
            item.SeriesName &&
            item.ProductionYear &&
            item.IndexNumber !== undefined
          ) {
            const key = `season:${item.SeriesName.toLowerCase()}:${
              item.ProductionYear
            }:${item.IndexNumber}`;
            seasonKeyToJellyfinItem.set(key, item);
          }

          // Index series by name + year
          if (item.Type === "Series" && item.Name && item.ProductionYear) {
            const key = `series:${item.Name.toLowerCase()}:${
              item.ProductionYear
            }`;
            seriesKeyToJellyfinItem.set(key, item);
          }
        }

        updatePeakMemory();

        console.info(
          formatSyncLogLine("deleted-items-cleanup", {
            server: server.name,
            page: metrics.librariesScanned,
            processed: libraryItems.length,
            inserted: 0,
            updated: 0,
            errors: 0,
            processMs: 0,
            totalProcessed: jellyfinItemsMap.size,
            libraryId: library.id,
            libraryName: library.name,
            memoryMB: getMemoryUsageMB(),
            phase: "fetch",
          })
        );
      } catch (error) {
        metrics.errors++;
        failedLibraries.push(library.id);
        errors.push(
          `Library ${library.name}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        console.warn(
          formatSyncLogLine("deleted-items-cleanup", {
            server: server.name,
            page: 0,
            processed: 0,
            inserted: 0,
            updated: 0,
            errors: 1,
            processMs: 0,
            totalProcessed: 0,
            libraryId: library.id,
            libraryName: library.name,
            message: `Failed to fetch library items - will skip deletion for this library`,
            error: error instanceof Error ? error.message : "Unknown error",
            phase: "fetch-error",
          })
        );
      }
    }

    metrics.jellyfinItemsCount = jellyfinItemsMap.size;

    console.info(
      formatSyncLogLine("deleted-items-cleanup", {
        server: server.name,
        page: 0,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: 0,
        jellyfinItems: metrics.jellyfinItemsCount,
        providerIdEntries: providerIdToJellyfinItem.size,
        episodeKeyEntries: episodeKeyToJellyfinItem.size,
        memoryMB: getMemoryUsageMB(),
        phase: "maps-built",
      })
    );

    // Safety check: Count database items to compare with Jellyfin
    const dbItemCount = await db
      .select({ count: items.id })
      .from(items)
      .where(and(eq(items.serverId, server.id), isNull(items.deletedAt)));
    metrics.databaseOperations++;

    const totalDbItems = dbItemCount.length;

    // Abort if Jellyfin returns 0 items but we have items in database
    // This prevents marking everything as deleted due to server issues
    if (metrics.jellyfinItemsCount === 0 && totalDbItems > 0) {
      console.warn(
        formatSyncLogLine("deleted-items-cleanup", {
          server: server.name,
          page: -1,
          processed: 0,
          inserted: 0,
          updated: 0,
          errors: 1,
          processMs: 0,
          totalProcessed: 0,
          message: `Jellyfin returned 0 items but database has ${totalDbItems} items - aborting`,
          phase: "abort",
        })
      );
      metrics.endTime = new Date();
      metrics.duration =
        metrics.endTime.getTime() - metrics.startTime.getTime();
      metrics.errors++;
      return {
        status: "error",
        metrics,
        errors: [
          `Jellyfin returned 0 items but database has ${totalDbItems} items - cleanup aborted to prevent false deletions`,
        ],
      };
    }

    // Phase 2: Process database items per-library to limit memory usage
    // IMPORTANT: Only process libraries that were successfully fetched from Jellyfin
    // If a library fetch failed (timeout, etc.), we must NOT mark its items as deleted
    const allItemsToDelete: string[] = [];
    const allItemsToMigrate: Array<{
      oldId: string;
      newId: string;
      reason: string;
    }> = [];

    for (const library of serverLibraries) {
      // Skip libraries that failed to fetch - we cannot safely determine what's deleted
      if (!successfullyFetchedLibraries.has(library.id)) {
        console.info(
          formatSyncLogLine("deleted-items-cleanup", {
            server: server.name,
            page: 0,
            processed: 0,
            inserted: 0,
            updated: 0,
            errors: 0,
            processMs: 0,
            totalProcessed: metrics.itemsScanned,
            libraryId: library.id,
            libraryName: library.name,
            message: "Skipping library - fetch failed earlier",
            phase: "library-skipped",
          })
        );
        continue;
      }

      const result = await processLibraryItems(
        server.id,
        library.id,
        library.name,
        jellyfinItemsMap,
        providerIdToJellyfinItem,
        episodeKeyToJellyfinItem,
        seasonKeyToJellyfinItem,
        seriesKeyToJellyfinItem,
        metrics
      );

      allItemsToDelete.push(...result.itemsToDelete);
      allItemsToMigrate.push(...result.itemsToMigrate);
      metrics.itemsScanned += result.itemsScanned;
      metrics.databaseItemsCount += result.itemsScanned;

      updatePeakMemory();

      console.info(
        formatSyncLogLine("deleted-items-cleanup", {
          server: server.name,
          page: 0,
          processed: result.itemsScanned,
          inserted: 0,
          updated: 0,
          errors: 0,
          processMs: 0,
          totalProcessed: metrics.itemsScanned,
          libraryId: library.id,
          libraryName: library.name,
          toDelete: result.itemsToDelete.length,
          toMigrate: result.itemsToMigrate.length,
          memoryMB: getMemoryUsageMB(),
          phase: "library-processed",
        })
      );
    }

    console.info(
      formatSyncLogLine("deleted-items-cleanup", {
        server: server.name,
        page: 0,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: 0,
        toDelete: allItemsToDelete.length,
        toMigrate: allItemsToMigrate.length,
        librariesProcessed: successfullyFetchedLibraries.size,
        librariesSkipped: failedLibraries.length,
        memoryMB: getMemoryUsageMB(),
        phase: "analysis",
      })
    );

    // Phase 3: Process deletions in batches
    if (allItemsToDelete.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < allItemsToDelete.length; i += batchSize) {
        const batch = allItemsToDelete.slice(i, i + batchSize);

        // Soft delete items
        metrics.databaseOperations++;
        await db
          .update(items)
          .set({ deletedAt: new Date() })
          .where(inArray(items.id, batch));

        // Remove library memberships for soft-deleted items
        metrics.databaseOperations++;
        await db
          .delete(itemLibraries)
          .where(inArray(itemLibraries.itemId, batch));

        // Delete hidden recommendations for these items
        metrics.databaseOperations++;
        const deletedRecs = await db
          .delete(hiddenRecommendations)
          .where(inArray(hiddenRecommendations.itemId, batch))
          .returning({ id: hiddenRecommendations.id });

        metrics.itemsSoftDeleted += batch.length;
        metrics.hiddenRecommendationsDeleted += deletedRecs.length;
      }
    }

    // Phase 4: Process migrations
    for (const migration of allItemsToMigrate) {
      try {
        await migrateItem(migration.oldId, migration.newId, metrics);
        metrics.itemsMigrated++;
      } catch (error) {
        metrics.errors++;
        errors.push(
          `Migration ${migration.oldId} -> ${migration.newId}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
    updatePeakMemory();

    console.info(
      formatSyncLogLine("deleted-items-cleanup", {
        server: server.name,
        page: -1,
        processed: metrics.itemsScanned,
        inserted: 0,
        updated: 0,
        errors: metrics.errors,
        processMs: metrics.duration,
        totalProcessed: metrics.itemsScanned,
        deleted: metrics.itemsSoftDeleted,
        migrated: metrics.itemsMigrated,
        sessionsMigrated: metrics.sessionsMigrated,
        hiddenRecsDeleted: metrics.hiddenRecommendationsDeleted,
        hiddenRecsMigrated: metrics.hiddenRecommendationsMigrated,
        peakMemoryMB: metrics.peakMemoryMB,
        phase: "complete",
      })
    );

    if (errors.length > 0) {
      return { status: "partial", metrics, errors };
    }

    return { status: "success", metrics };
  } catch (error) {
    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
    metrics.errors++;

    console.error(
      formatSyncLogLine("deleted-items-cleanup", {
        server: server.name,
        page: -1,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 1,
        processMs: metrics.duration || 0,
        totalProcessed: 0,
        message: "Cleanup failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    );

    return {
      status: "error",
      metrics,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Process database items for a single library.
 * This limits memory usage by only loading one library's DB items at a time.
 */
async function processLibraryItems(
  serverId: number,
  libraryId: string,
  libraryName: string,
  jellyfinItemsMap: Map<string, MinimalJellyfinItem>,
  providerIdToJellyfinItem: Map<string, MinimalJellyfinItem>,
  episodeKeyToJellyfinItem: Map<string, MinimalJellyfinItem>,
  seasonKeyToJellyfinItem: Map<string, MinimalJellyfinItem>,
  seriesKeyToJellyfinItem: Map<string, MinimalJellyfinItem>,
  metrics: CleanupMetrics
): Promise<LibraryCleanupResult> {
  // Fetch database items for THIS library only
  metrics.databaseOperations++;
  const databaseItems = await db
    .select({
      id: items.id,
      name: items.name,
      type: items.type,
      providerIds: items.providerIds,
      seriesName: items.seriesName,
      productionYear: items.productionYear,
      indexNumber: items.indexNumber,
      parentIndexNumber: items.parentIndexNumber,
    })
    .from(items)
    .where(
      and(
        eq(items.serverId, serverId),
        eq(items.libraryId, libraryId),
        isNull(items.deletedAt)
      )
    );

  const itemsToDelete: string[] = [];
  const itemsToMigrate: Array<{
    oldId: string;
    newId: string;
    reason: string;
  }> = [];

  for (const dbItem of databaseItems) {
    const matchResult = matchItem(
      dbItem,
      jellyfinItemsMap,
      providerIdToJellyfinItem,
      episodeKeyToJellyfinItem,
      seasonKeyToJellyfinItem,
      seriesKeyToJellyfinItem
    );

    if (matchResult.type === "deleted") {
      itemsToDelete.push(dbItem.id);
    } else if (matchResult.type === "migrated" && matchResult.newItemId) {
      itemsToMigrate.push({
        oldId: dbItem.id,
        newId: matchResult.newItemId,
        reason: matchResult.matchReason || "unknown",
      });
    }
  }

  return {
    itemsToDelete,
    itemsToMigrate,
    itemsScanned: databaseItems.length,
  };
}

/**
 * Match a database item against Jellyfin items to determine its status
 */
function matchItem(
  dbItem: {
    id: string;
    name: string;
    type: string;
    providerIds: unknown;
    seriesName: string | null;
    productionYear: number | null;
    indexNumber: number | null;
    parentIndexNumber: number | null;
  },
  jellyfinItemsMap: Map<string, MinimalJellyfinItem>,
  providerIdToJellyfinItem: Map<string, MinimalJellyfinItem>,
  episodeKeyToJellyfinItem: Map<string, MinimalJellyfinItem>,
  seasonKeyToJellyfinItem: Map<string, MinimalJellyfinItem>,
  seriesKeyToJellyfinItem: Map<string, MinimalJellyfinItem>
): MatchResult {
  // Check if item exists with same ID
  if (jellyfinItemsMap.has(dbItem.id)) {
    return { type: "exists", oldItemId: dbItem.id };
  }

  // Item not found by ID - check if it was re-added with different ID

  // 1. Check by ProviderIds first (IMDB, TMDB, etc.) - most reliable
  const providerIds = dbItem.providerIds as Record<string, string> | null;
  if (providerIds) {
    for (const [provider, id] of Object.entries(providerIds)) {
      if (id) {
        const match = providerIdToJellyfinItem.get(`${provider}:${id}`);
        if (match && match.Id !== dbItem.id) {
          return {
            type: "migrated",
            oldItemId: dbItem.id,
            newItemId: match.Id,
            matchReason: `${provider}:${id}`,
          };
        }
      }
    }
  }

  // 2. Fallback: Match by stable attributes (name, year, etc.)
  // Episodes: type + series_name + index_number + parent_index_number (+ optional production_year)
  if (
    dbItem.type === "Episode" &&
    dbItem.seriesName &&
    dbItem.indexNumber !== null &&
    dbItem.parentIndexNumber !== null
  ) {
    // Try with production year first if available
    if (dbItem.productionYear) {
      const keyWithYear = `episode:${dbItem.seriesName.toLowerCase()}:${
        dbItem.productionYear
      }:${dbItem.parentIndexNumber}:${dbItem.indexNumber}`;
      const match = episodeKeyToJellyfinItem.get(keyWithYear);
      if (match && match.Id !== dbItem.id) {
        return {
          type: "migrated",
          oldItemId: dbItem.id,
          newItemId: match.Id,
          matchReason: keyWithYear,
        };
      }
    }
    // Fallback: search without year by iterating through all episode keys
    for (const [key, item] of episodeKeyToJellyfinItem) {
      const keyParts = key.split(":");
      if (
        keyParts[1] === dbItem.seriesName.toLowerCase() &&
        keyParts[3] === String(dbItem.parentIndexNumber) &&
        keyParts[4] === String(dbItem.indexNumber) &&
        item.Id !== dbItem.id
      ) {
        return {
          type: "migrated",
          oldItemId: dbItem.id,
          newItemId: item.Id,
          matchReason: `episode:${dbItem.seriesName}:S${dbItem.parentIndexNumber}E${dbItem.indexNumber}`,
        };
      }
    }
  }

  // Season: type + series_name + index_number (+ optional production_year)
  if (
    dbItem.type === "Season" &&
    dbItem.seriesName &&
    dbItem.indexNumber !== null
  ) {
    // Try with production year first if available
    if (dbItem.productionYear) {
      const keyWithYear = `season:${dbItem.seriesName.toLowerCase()}:${
        dbItem.productionYear
      }:${dbItem.indexNumber}`;
      const match = seasonKeyToJellyfinItem.get(keyWithYear);
      if (match && match.Id !== dbItem.id) {
        return {
          type: "migrated",
          oldItemId: dbItem.id,
          newItemId: match.Id,
          matchReason: keyWithYear,
        };
      }
    }
    // Fallback: search without year by iterating through all season keys
    for (const [key, item] of seasonKeyToJellyfinItem) {
      const keyParts = key.split(":");
      if (
        keyParts[1] === dbItem.seriesName.toLowerCase() &&
        keyParts[3] === String(dbItem.indexNumber) &&
        item.Id !== dbItem.id
      ) {
        return {
          type: "migrated",
          oldItemId: dbItem.id,
          newItemId: item.Id,
          matchReason: `season:${dbItem.seriesName}:${dbItem.indexNumber}`,
        };
      }
    }
  }

  // Series: name + type + production_year
  if (dbItem.type === "Series" && dbItem.name && dbItem.productionYear) {
    const key = `series:${dbItem.name.toLowerCase()}:${dbItem.productionYear}`;
    const match = seriesKeyToJellyfinItem.get(key);
    if (match && match.Id !== dbItem.id) {
      return {
        type: "migrated",
        oldItemId: dbItem.id,
        newItemId: match.Id,
        matchReason: key,
      };
    }
  }

  // Item is truly deleted
  return { type: "deleted", oldItemId: dbItem.id };
}

/**
 * Migrate sessions and hidden recommendations from old item ID to new item ID
 */
async function migrateItem(
  oldItemId: string,
  newItemId: string,
  metrics: CleanupMetrics
): Promise<void> {
  // Migrate sessions
  metrics.databaseOperations++;
  const migratedSessions = await db
    .update(sessions)
    .set({ itemId: newItemId })
    .where(eq(sessions.itemId, oldItemId))
    .returning({ id: sessions.id });

  metrics.sessionsMigrated += migratedSessions.length;

  // Migrate hidden recommendations
  metrics.databaseOperations++;
  const migratedRecs = await db
    .update(hiddenRecommendations)
    .set({ itemId: newItemId })
    .where(eq(hiddenRecommendations.itemId, oldItemId))
    .returning({ id: hiddenRecommendations.id });

  metrics.hiddenRecommendationsMigrated += migratedRecs.length;

  // Remove library memberships for old item
  metrics.databaseOperations++;
  await db
    .delete(itemLibraries)
    .where(eq(itemLibraries.itemId, oldItemId));

  // Soft delete the old item
  metrics.databaseOperations++;
  await db
    .update(items)
    .set({ deletedAt: new Date() })
    .where(eq(items.id, oldItemId));
}

export { CleanupMetrics as DeletedItemsCleanupMetrics };
