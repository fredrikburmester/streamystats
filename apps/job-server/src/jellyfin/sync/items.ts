import { eq, and, inArray, isNotNull, or, sql } from "drizzle-orm";
import {
  db,
  items,
  itemLibraries,
  libraries,
  sessions,
  hiddenRecommendations,
  mediaSources,
  Server,
  NewItem,
  NewMediaSource,
  Library,
  Item,
} from "@streamystats/database";
import { JellyfinClient, JellyfinBaseItemDto } from "../client";
import {
  SyncMetricsTracker,
  SyncResult,
  createSyncResult,
} from "../sync-metrics";
import pMap from "p-map";
import { sleep } from "../../utils/sleep";
import { formatSyncLogLine } from "./sync-log";
import { formatError } from "../../utils/format-error";

export interface ItemSyncOptions {
  itemPageSize?: number;
  batchSize?: number;
  maxLibraryConcurrency?: number;
  itemConcurrency?: number;
  apiRequestDelayMs?: number;
  recentItemsLimit?: number;
  libraryId?: string;
}

export interface ItemSyncData {
  librariesProcessed: number;
  itemsProcessed: number;
  itemsInserted: number;
  itemsUpdated: number;
  itemsUnchanged: number;
  itemsMigrated?: number;
  sessionsMigrated?: number;
}

export async function syncItems(
  server: Server,
  options: ItemSyncOptions = {}
): Promise<SyncResult<ItemSyncData>> {
  const {
    itemPageSize = 1000,
    batchSize = 1000,
    itemConcurrency = 4,
    apiRequestDelayMs = 100,
  } = options;

  const metrics = new SyncMetricsTracker();
  const client = JellyfinClient.fromServer(server);
  const errors: string[] = [];

  try {
    // Get libraries for this server, optionally filtered by libraryId
    const libraryCondition = options.libraryId
      ? and(
          eq(libraries.serverId, server.id),
          eq(libraries.id, options.libraryId)
        )
      : eq(libraries.serverId, server.id);

    const serverLibraries = await db
      .select()
      .from(libraries)
      .where(libraryCondition);

    if (serverLibraries.length === 0) {
      const errorMsg = options.libraryId
        ? `Library ${options.libraryId} not found for server ${server.id}`
        : `No libraries found for server ${server.id}`;
      const finalMetrics = metrics.finish();
      return createSyncResult<ItemSyncData>(
        "error",
        {
          librariesProcessed: 0,
          itemsProcessed: 0,
          itemsInserted: 0,
          itemsUpdated: 0,
          itemsUnchanged: 0,
        },
        finalMetrics,
        errorMsg
      );
    }

    console.info(
      formatSyncLogLine("items-sync", {
        server: server.name,
        page: 0,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: 0,
        libraries: serverLibraries.length,
        libraryId: options.libraryId,
      })
    );

    // Process libraries sequentially to avoid overwhelming Jellyfin / DB
    for (const library of serverLibraries) {
      try {
        console.info(
          formatSyncLogLine("items-sync", {
            server: server.name,
            page: 0,
            processed: 0,
            inserted: 0,
            updated: 0,
            errors: 0,
            processMs: 0,
            totalProcessed: metrics.getCurrentMetrics().itemsProcessed,
            libraryId: library.id,
            libraryName: library.name,
            phase: "start",
          })
        );

        await syncLibraryItems(server, library, client, metrics, {
          itemPageSize,
          batchSize,
          itemConcurrency,
          apiRequestDelayMs,
        });
        metrics.incrementLibrariesProcessed();

        console.info(
          formatSyncLogLine("items-sync", {
            server: server.name,
            page: 0,
            processed: 0,
            inserted: 0,
            updated: 0,
            errors: 0,
            processMs: 0,
            totalProcessed: metrics.getCurrentMetrics().itemsProcessed,
            libraryId: library.id,
            libraryName: library.name,
            phase: "done",
          })
        );
      } catch (error) {
        console.error(
          formatSyncLogLine("items-sync", {
            server: server.name,
            page: 0,
            processed: 0,
            inserted: 0,
            updated: 0,
            errors: 1,
            processMs: 0,
            totalProcessed: metrics.getCurrentMetrics().itemsProcessed,
            libraryId: library.id,
            libraryName: library.name,
            message: "Error syncing library",
            error: error instanceof Error ? error.message : "Unknown error",
          })
        );
        metrics.incrementErrors();
        errors.push(
          `Library ${library.name}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    const finalMetrics = metrics.finish();
    const data: ItemSyncData = {
      librariesProcessed: finalMetrics.librariesProcessed,
      itemsProcessed: finalMetrics.itemsProcessed,
      itemsInserted: finalMetrics.itemsInserted,
      itemsUpdated: finalMetrics.itemsUpdated,
      itemsUnchanged: finalMetrics.itemsUnchanged,
    };

    console.info(
      formatSyncLogLine("items-sync", {
        server: server.name,
        page: -1,
        processed: 0,
        inserted: finalMetrics.itemsInserted,
        updated: finalMetrics.itemsUpdated,
        errors: errors.length,
        processMs: finalMetrics.duration ?? 0,
        totalProcessed: finalMetrics.itemsProcessed,
        librariesProcessed: finalMetrics.librariesProcessed,
        unchanged: finalMetrics.itemsUnchanged,
      })
    );

    if (errors.length > 0) {
      return createSyncResult("partial", data, finalMetrics, undefined, errors);
    }

    return createSyncResult("success", data, finalMetrics);
  } catch (error) {
    console.error(
      formatSyncLogLine("items-sync", {
        server: server.name,
        page: -1,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 1,
        processMs: 0,
        totalProcessed: metrics.getCurrentMetrics().itemsProcessed,
        message: "Items sync failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    );
    const finalMetrics = metrics.finish();
    const errorData: ItemSyncData = {
      librariesProcessed: finalMetrics.librariesProcessed,
      itemsProcessed: finalMetrics.itemsProcessed,
      itemsInserted: finalMetrics.itemsInserted,
      itemsUpdated: finalMetrics.itemsUpdated,
      itemsUnchanged: finalMetrics.itemsUnchanged,
    };
    return createSyncResult(
      "error",
      errorData,
      finalMetrics,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

async function syncLibraryItems(
  server: Server,
  library: Library,
  client: JellyfinClient,
  metrics: SyncMetricsTracker,
  options: {
    itemPageSize: number;
    batchSize: number;
    itemConcurrency: number;
    apiRequestDelayMs: number;
  }
): Promise<void> {
  let startIndex = 0;
  let hasMoreItems = true;
  let page = 0;

  while (hasMoreItems) {
    // Add delay between API requests
    if (startIndex > 0) {
      await sleep(options.apiRequestDelayMs);
    }

    page += 1;
    const beforePageMetrics = metrics.getCurrentMetrics();

    try {
      const fetchStart = Date.now();
      metrics.incrementApiRequests();
      const { items: jellyfinItems, totalCount } = await client.getItemsPage(
        library.id,
        startIndex,
        options.itemPageSize
      );
      const fetchMs = Date.now() - fetchStart;

      if (jellyfinItems.length === 0) {
        hasMoreItems = false;
        break;
      }

      // Process items in smaller batches to avoid overwhelming the database
      const processStart = Date.now();
      await pMap(
        jellyfinItems,
        async (jellyfinItem) => {
          try {
            await processItem(jellyfinItem, library.id, metrics);
          } catch (error) {
            console.error(
              formatSyncLogLine("items-sync", {
                server: server.name,
                page,
                processed: 0,
                inserted: 0,
                updated: 0,
                errors: 1,
                processMs: 0,
                totalProcessed: metrics.getCurrentMetrics().itemsProcessed,
                libraryId: library.id,
                itemId: jellyfinItem.Id,
                message: "Error processing item",
                error: error instanceof Error ? error.message : "Unknown error",
              })
            );
            metrics.incrementErrors();
          }
        },
        { concurrency: options.itemConcurrency }
      );
      const processMs = Date.now() - processStart;

      const afterPageMetrics = metrics.getCurrentMetrics();
      const processedDelta =
        afterPageMetrics.itemsProcessed - beforePageMetrics.itemsProcessed;
      const insertedDelta =
        afterPageMetrics.itemsInserted - beforePageMetrics.itemsInserted;
      const updatedDelta =
        afterPageMetrics.itemsUpdated - beforePageMetrics.itemsUpdated;
      const errorsDelta = afterPageMetrics.errors - beforePageMetrics.errors;

      console.info(
        formatSyncLogLine("items-sync", {
          server: server.name,
          page,
          processed: processedDelta,
          inserted: insertedDelta,
          updated: updatedDelta,
          errors: errorsDelta,
          processMs,
          totalProcessed: afterPageMetrics.itemsProcessed,
          libraryId: library.id,
          libraryName: library.name,
          startIndex,
          fetched: jellyfinItems.length,
          fetchMs,
          total: totalCount,
        })
      );

      startIndex += jellyfinItems.length;
      hasMoreItems = startIndex < totalCount && jellyfinItems.length > 0;
    } catch (error) {
      console.error(
        formatSyncLogLine("items-sync", {
          server: server.name,
          page,
          processed: 0,
          inserted: 0,
          updated: 0,
          errors: 1,
          processMs: 0,
          totalProcessed: metrics.getCurrentMetrics().itemsProcessed,
          libraryId: library.id,
          libraryName: library.name,
          startIndex,
          message: "Error fetching items page",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      );
      metrics.incrementErrors();
      break; // Stop processing this library on API error
    }
  }
}

async function processItem(
  jellyfinItem: JellyfinBaseItemDto,
  libraryId: string,
  metrics: SyncMetricsTracker
): Promise<void> {
  // Check if item already exists and compare etag for changes
  const existingItem = await db
    .select({
      etag: items.etag,
      deletedAt: items.deletedAt,
      providerIds: items.providerIds,
      mediaSourcesSynced: items.mediaSourcesSynced,
    })
    .from(items)
    .where(eq(items.id, jellyfinItem.Id))
    .limit(1);

  const isNewItem = existingItem.length === 0;
  const wasDeleted = !isNewItem && existingItem[0].deletedAt !== null;
  const hasChanged = !isNewItem && existingItem[0].etag !== jellyfinItem.Etag;
  const needsMediaSourcesSync =
    !isNewItem && existingItem[0].mediaSourcesSynced === false;

  // Check if ProviderIds are missing in existing item but present in new item
  const needsProviderIdsUpdate =
    !isNewItem &&
    (!existingItem[0].providerIds ||
      (typeof existingItem[0].providerIds === "object" &&
        Object.keys(existingItem[0].providerIds).length === 0)) &&
    jellyfinItem.ProviderIds &&
    typeof jellyfinItem.ProviderIds === "object" &&
    Object.keys(jellyfinItem.ProviderIds).length > 0;

  // If item exists but was deleted, clear the deletedAt flag (item is back)
  if (wasDeleted) {
    console.info(
      `[items-sync] Item ${jellyfinItem.Id} was previously deleted, restoring it`
    );
  }

  // Log when ProviderIds are being added to existing item
  if (needsProviderIdsUpdate) {
    console.info(
      `[items-sync] Item ${
        jellyfinItem.Id
      } missing ProviderIds, adding: ${JSON.stringify(
        jellyfinItem.ProviderIds
      )}`
    );
  }

  // If item only needs media sources sync (no other changes), just sync media sources
  if (
    !isNewItem &&
    !hasChanged &&
    !wasDeleted &&
    !needsProviderIdsUpdate &&
    needsMediaSourcesSync
  ) {
    const serverId = await getServerIdFromLibrary(libraryId);
    await syncMediaSources(jellyfinItem, serverId);
    metrics.incrementItemsProcessed();
    return;
  }

  if (!isNewItem && !hasChanged && !wasDeleted && !needsProviderIdsUpdate) {
    metrics.incrementItemsUnchanged();
    metrics.incrementItemsProcessed();
    return; // Skip if item hasn't changed and wasn't deleted and doesn't need ProviderIds update
  }

  const serverId = await getServerIdFromLibrary(libraryId);

  // For truly new items, check for previously deleted items to migrate data from
  if (isNewItem) {
    const tempItemData: NewItem = {
      id: jellyfinItem.Id,
      serverId,
      libraryId,
      name: jellyfinItem.Name,
      type: jellyfinItem.Type,
      seriesId: jellyfinItem.SeriesId || null,
      seriesName: jellyfinItem.SeriesName || null,
      productionYear: jellyfinItem.ProductionYear || null,
      indexNumber: jellyfinItem.IndexNumber || null,
      parentIndexNumber: jellyfinItem.ParentIndexNumber || null,
      providerIds: jellyfinItem.ProviderIds || null,
      isFolder: jellyfinItem.IsFolder || false,
      rawData: jellyfinItem,
      updatedAt: new Date(),
    };
    await checkAndMigrateDeletedItem(tempItemData);
  }

  const itemData: NewItem = {
    id: jellyfinItem.Id,
    serverId,
    libraryId,
    name: jellyfinItem.Name,
    type: jellyfinItem.Type,
    originalTitle: jellyfinItem.OriginalTitle || null,
    etag: jellyfinItem.Etag || null,
    dateCreated: jellyfinItem.DateCreated
      ? new Date(jellyfinItem.DateCreated)
      : null,
    container: jellyfinItem.Container || null,
    sortName: jellyfinItem.SortName || null,
    premiereDate: jellyfinItem.PremiereDate
      ? new Date(jellyfinItem.PremiereDate)
      : null,
    path: jellyfinItem.Path || null,
    officialRating: jellyfinItem.OfficialRating || null,
    overview: jellyfinItem.Overview || null,
    communityRating: jellyfinItem.CommunityRating || null,
    runtimeTicks: jellyfinItem.RunTimeTicks || null,
    productionYear: jellyfinItem.ProductionYear || null,
    isFolder: jellyfinItem.IsFolder || false,
    parentId: jellyfinItem.ParentId || null,
    mediaType: jellyfinItem.MediaType || null,
    width: jellyfinItem.Width || null,
    height: jellyfinItem.Height || null,
    seriesName: jellyfinItem.SeriesName || null,
    seriesId: jellyfinItem.SeriesId || null,
    seasonId: jellyfinItem.SeasonId || null,
    seasonName: jellyfinItem.SeasonName || null,
    indexNumber: jellyfinItem.IndexNumber || null,
    parentIndexNumber: jellyfinItem.ParentIndexNumber || null,
    videoType: jellyfinItem.VideoType || null,
    hasSubtitles: jellyfinItem.HasSubtitles || false,
    channelId: jellyfinItem.ChannelId || null,
    locationType: jellyfinItem.LocationType,
    genres: jellyfinItem.Genres || null,
    primaryImageAspectRatio: jellyfinItem.PrimaryImageAspectRatio || null,
    primaryImageTag: jellyfinItem.ImageTags?.Primary || null,
    seriesPrimaryImageTag: jellyfinItem.SeriesPrimaryImageTag || null,
    primaryImageThumbTag: jellyfinItem.ImageTags?.Thumb || null,
    primaryImageLogoTag: jellyfinItem.ImageTags?.Logo || null,
    parentThumbItemId: jellyfinItem.ParentThumbItemId || null,
    parentThumbImageTag: jellyfinItem.ParentThumbImageTag || null,
    parentLogoItemId: jellyfinItem.ParentLogoItemId || null,
    parentLogoImageTag: jellyfinItem.ParentLogoImageTag || null,
    backdropImageTags: jellyfinItem.BackdropImageTags || null,
    parentBackdropItemId: jellyfinItem.ParentBackdropItemId || null,
    parentBackdropImageTags: jellyfinItem.ParentBackdropImageTags || null,
    imageBlurHashes: jellyfinItem.ImageBlurHashes || null,
    imageTags: jellyfinItem.ImageTags || null,
    canDelete: jellyfinItem.CanDelete || false,
    canDownload: jellyfinItem.CanDownload || false,
    playAccess: jellyfinItem.PlayAccess || null,
    isHD: jellyfinItem.IsHD || false,
    providerIds: jellyfinItem.ProviderIds || null,
    tags: jellyfinItem.Tags || null,
    seriesStudio: jellyfinItem.SeriesStudio || null,
    rawData: jellyfinItem, // Store complete BaseItemDto
    updatedAt: new Date(),
  };

  // Upsert item (also clear deletedAt in case item was previously soft-deleted)
  // Reset sync flags when item content has changed (etag change or restored from deletion)
  const shouldResync = hasChanged || wasDeleted;

  await db
    .insert(items)
    .values(itemData)
    .onConflictDoUpdate({
      target: items.id,
      set: {
        ...itemData,
        deletedAt: null, // Clear deletion flag if item is back
        updatedAt: new Date(),
        ...(shouldResync && {
          peopleSynced: false,
          mediaSourcesSynced: false,
          processed: false,
        }),
      },
    });

  // Track library membership in junction table
  await db
    .insert(itemLibraries)
    .values({ itemId: jellyfinItem.Id, libraryId })
    .onConflictDoNothing();

  // Sync media sources for this item and mark as synced
  await syncMediaSources(jellyfinItem, serverId);

  metrics.incrementDatabaseOperations();

  if (isNewItem) {
    metrics.incrementItemsInserted();
  } else {
    metrics.incrementItemsUpdated();
  }

  metrics.incrementItemsProcessed();
}

// Cache for server ID lookups
const serverIdCache = new Map<string, number>();

async function getServerIdFromLibrary(libraryId: string): Promise<number> {
  if (serverIdCache.has(libraryId)) {
    return serverIdCache.get(libraryId)!;
  }

  const library = await db
    .select({ serverId: libraries.serverId })
    .from(libraries)
    .where(eq(libraries.id, libraryId))
    .limit(1);

  if (library.length === 0) {
    throw new Error(`Library not found: ${libraryId}`);
  }

  const [{ serverId }] = library;
  serverIdCache.set(libraryId, serverId);
  return serverId;
}

export async function syncRecentlyAddedItems(
  server: Server,
  limit: number = 100
): Promise<SyncResult<ItemSyncData>> {
  const metrics = new SyncMetricsTracker();
  const client = JellyfinClient.fromServer(server);
  const errors: string[] = [];

  try {
    console.info(
      formatSyncLogLine("recent-items-sync", {
        server: server.name,
        page: 0,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: 0,
        limit,
      })
    );

    // Get current libraries from Jellyfin server to verify they still exist
    metrics.incrementApiRequests();
    const jellyfinLibraries = await client.getLibraries();
    const existingLibraryIds = new Set(jellyfinLibraries.map((lib) => lib.Id));

    // Get all libraries for this server from our database
    const serverLibraries = await db
      .select()
      .from(libraries)
      .where(eq(libraries.serverId, server.id));

    // Filter to only include libraries that still exist on the Jellyfin server
    const validLibraries = serverLibraries.filter((library) =>
      existingLibraryIds.has(library.id)
    );

    const removedLibraries = serverLibraries.filter(
      (library) => !existingLibraryIds.has(library.id)
    );

    console.info(
      formatSyncLogLine("recent-items-sync", {
        server: server.name,
        page: 0,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: 0,
        validLibraries: validLibraries.length,
        removedLibraries: removedLibraries.length,
        limit,
      })
    );

    let allMappedItems: NewItem[] = [];
    let allInvalidItems: Array<{ id: string; error: string }> = [];
    let allJellyfinItemsForMediaSync: JellyfinBaseItemDto[] = [];

    // Collect recent items from all valid libraries with their already-known library IDs
    let page = 0;
    for (const library of validLibraries) {
      try {
        page += 1;
        const beforePageMetrics = metrics.getCurrentMetrics();
        const fetchStart = Date.now();
        metrics.incrementApiRequests();
        const libraryItems = await client.getRecentlyAddedItemsByLibrary(
          library.id,
          limit
        );
        const fetchMs = Date.now() - fetchStart;

        metrics.incrementItemsProcessed(libraryItems.length);

        // Map items, knowing they belong to the current library
        const processStart = Date.now();
        const { validItems, invalidItems, jellyfinItemsForMediaSync } = await mapItemsWithKnownLibrary(
          libraryItems,
          library.id,
          server.id
        );
        const processMs = Date.now() - processStart;

        const afterPageMetrics = metrics.getCurrentMetrics();

        allMappedItems = allMappedItems.concat(validItems);
        allInvalidItems = allInvalidItems.concat(invalidItems);
        allJellyfinItemsForMediaSync = allJellyfinItemsForMediaSync.concat(jellyfinItemsForMediaSync);

        console.info(
          formatSyncLogLine("recent-items-sync", {
            server: server.name,
            page,
            processed:
              afterPageMetrics.itemsProcessed -
              beforePageMetrics.itemsProcessed,
            inserted: 0,
            updated: 0,
            errors: afterPageMetrics.errors - beforePageMetrics.errors,
            processMs,
            totalProcessed: afterPageMetrics.itemsProcessed,
            libraryId: library.id,
            libraryName: library.name,
            fetched: libraryItems.length,
            fetchMs,
            invalid: invalidItems.length,
          })
        );
      } catch (error) {
        page += 1;
        console.error(
          formatSyncLogLine("recent-items-sync", {
            server: server.name,
            page,
            processed: 0,
            inserted: 0,
            updated: 0,
            errors: 1,
            processMs: 0,
            totalProcessed: metrics.getCurrentMetrics().itemsProcessed,
            libraryId: library.id,
            libraryName: library.name,
            message: "API error when fetching items from library",
            error: error instanceof Error ? error.message : "Unknown error",
          })
        );
        metrics.incrementErrors();
        errors.push(
          `Library ${library.name}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    console.info(
      formatSyncLogLine("recent-items-sync", {
        server: server.name,
        page: 0,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: metrics.getCurrentMetrics().itemsProcessed,
        collected: allMappedItems.length,
        invalid: allInvalidItems.length,
      })
    );

    if (allMappedItems.length === 0) {
      const finalMetrics = metrics.finish();
      const data: ItemSyncData = {
        librariesProcessed: validLibraries.length,
        itemsProcessed: finalMetrics.itemsProcessed,
        itemsInserted: 0,
        itemsUpdated: 0,
        itemsUnchanged: 0,
      };
      console.info(
        formatSyncLogLine("recent-items-sync", {
          server: server.name,
          page: -1,
          processed: 0,
          inserted: 0,
          updated: 0,
          errors: errors.length,
          processMs: finalMetrics.duration ?? 0,
          totalProcessed: finalMetrics.itemsProcessed,
        })
      );
      return createSyncResult("success", data, finalMetrics);
    }

    // Process valid items - determine inserts vs updates
    metrics.incrementDatabaseOperations();
    const {
      insertResult,
      updateResult,
      unchangedCount,
      itemsMigrated,
      sessionsMigrated,
    } = await processValidItems(allMappedItems, allInvalidItems, server.id);

    // Sync media sources for all processed items
    await syncMediaSourcesBatch(allJellyfinItemsForMediaSync, server.id);

    metrics.incrementItemsInserted(insertResult);
    metrics.incrementItemsUpdated(updateResult);
    metrics.incrementItemsUnchanged(unchangedCount);

    const finalMetrics = metrics.finish();
    const data: ItemSyncData = {
      librariesProcessed: validLibraries.length,
      itemsProcessed: finalMetrics.itemsProcessed,
      itemsInserted: insertResult,
      itemsUpdated: updateResult,
      itemsUnchanged: unchangedCount,
      itemsMigrated,
      sessionsMigrated,
    };

    console.info(
      formatSyncLogLine("recent-items-sync", {
        server: server.name,
        page: -1,
        processed: 0,
        inserted: insertResult,
        updated: updateResult,
        errors: errors.length + allInvalidItems.length,
        processMs: finalMetrics.duration ?? 0,
        totalProcessed: finalMetrics.itemsProcessed,
        unchanged: unchangedCount,
        librariesProcessed: validLibraries.length,
        itemsMigrated,
        sessionsMigrated,
      })
    );

    if (allInvalidItems.length > 0 || errors.length > 0) {
      const allErrors = errors.concat(
        allInvalidItems.map((item) => `Item ${item.id}: ${item.error}`)
      );
      return createSyncResult(
        "partial",
        data,
        finalMetrics,
        undefined,
        allErrors
      );
    }

    return createSyncResult("success", data, finalMetrics);
  } catch (error) {
    console.error(
      formatSyncLogLine("recent-items-sync", {
        server: server.name,
        page: -1,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 1,
        processMs: 0,
        totalProcessed: metrics.getCurrentMetrics().itemsProcessed,
        message: "Recently added items sync failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    );
    const finalMetrics = metrics.finish();
    const errorData: ItemSyncData = {
      librariesProcessed: 0, // 0 because we failed before processing any libraries
      itemsProcessed: finalMetrics.itemsProcessed,
      itemsInserted: 0,
      itemsUpdated: 0,
      itemsUnchanged: 0,
    };
    return createSyncResult(
      "error",
      errorData,
      finalMetrics,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Map Jellyfin items to our format with known library context
 */
async function mapItemsWithKnownLibrary(
  jellyfinItems: JellyfinBaseItemDto[],
  libraryId: string,
  serverId: number
): Promise<{
  validItems: NewItem[];
  invalidItems: Array<{ id: string; error: string }>;
  jellyfinItemsForMediaSync: JellyfinBaseItemDto[];
}> {
  const validItems: NewItem[] = [];
  const invalidItems: Array<{ id: string; error: string }> = [];
  const jellyfinItemsForMediaSync: JellyfinBaseItemDto[] = [];

  for (const item of jellyfinItems) {
    try {
      // We already know the library_id since we fetched per library
      const mappedItem = mapJellyfinItem(item, libraryId, serverId);
      validItems.push(mappedItem);
      // Keep track of original Jellyfin items for media source sync
      jellyfinItemsForMediaSync.push(item);
    } catch (error) {
      // Catch any mapping errors
      console.error(
        `[items-sync] serverId=${serverId} itemId=${item.Id} status=map-error error=${formatError(
          error
        )}`
      );
      invalidItems.push({
        id: item.Id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { validItems, invalidItems, jellyfinItemsForMediaSync };
}

/**
 * Map a single Jellyfin item to our database format
 */
function mapJellyfinItem(
  jellyfinItem: JellyfinBaseItemDto,
  libraryId: string,
  serverId: number
): NewItem {
  return {
    id: jellyfinItem.Id,
    serverId,
    libraryId,
    name: jellyfinItem.Name,
    type: jellyfinItem.Type,
    originalTitle: jellyfinItem.OriginalTitle || null,
    etag: jellyfinItem.Etag || null,
    dateCreated: jellyfinItem.DateCreated
      ? new Date(jellyfinItem.DateCreated)
      : null,
    container: jellyfinItem.Container || null,
    sortName: jellyfinItem.SortName || null,
    premiereDate: jellyfinItem.PremiereDate
      ? new Date(jellyfinItem.PremiereDate)
      : null,
    path: jellyfinItem.Path || null,
    officialRating: jellyfinItem.OfficialRating || null,
    overview: jellyfinItem.Overview || null,
    communityRating: jellyfinItem.CommunityRating || null,
    runtimeTicks: jellyfinItem.RunTimeTicks || null,
    productionYear: jellyfinItem.ProductionYear || null,
    isFolder: jellyfinItem.IsFolder || false,
    parentId: jellyfinItem.ParentId || null,
    mediaType: jellyfinItem.MediaType || null,
    width: jellyfinItem.Width || null,
    height: jellyfinItem.Height || null,
    seriesName: jellyfinItem.SeriesName || null,
    seriesId: jellyfinItem.SeriesId || null,
    seasonId: jellyfinItem.SeasonId || null,
    seasonName: jellyfinItem.SeasonName || null,
    indexNumber: jellyfinItem.IndexNumber || null,
    parentIndexNumber: jellyfinItem.ParentIndexNumber || null,
    videoType: jellyfinItem.VideoType || null,
    hasSubtitles: jellyfinItem.HasSubtitles || false,
    channelId: jellyfinItem.ChannelId || null,
    locationType: jellyfinItem.LocationType,
    genres: jellyfinItem.Genres || null,
    primaryImageAspectRatio: jellyfinItem.PrimaryImageAspectRatio || null,
    primaryImageTag: jellyfinItem.ImageTags?.Primary || null,
    seriesPrimaryImageTag: jellyfinItem.SeriesPrimaryImageTag || null,
    primaryImageThumbTag: jellyfinItem.ImageTags?.Thumb || null,
    primaryImageLogoTag: jellyfinItem.ImageTags?.Logo || null,
    parentThumbItemId: jellyfinItem.ParentThumbItemId || null,
    parentThumbImageTag: jellyfinItem.ParentThumbImageTag || null,
    parentLogoItemId: jellyfinItem.ParentLogoItemId || null,
    parentLogoImageTag: jellyfinItem.ParentLogoImageTag || null,
    backdropImageTags: jellyfinItem.BackdropImageTags || null,
    parentBackdropItemId: jellyfinItem.ParentBackdropItemId || null,
    parentBackdropImageTags: jellyfinItem.ParentBackdropImageTags || null,
    imageBlurHashes: jellyfinItem.ImageBlurHashes || null,
    imageTags: jellyfinItem.ImageTags || null,
    canDelete: jellyfinItem.CanDelete || false,
    canDownload: jellyfinItem.CanDownload || false,
    playAccess: jellyfinItem.PlayAccess || null,
    isHD: jellyfinItem.IsHD || false,
    providerIds: jellyfinItem.ProviderIds || null,
    tags: jellyfinItem.Tags || null,
    seriesStudio: jellyfinItem.SeriesStudio || null,
    rawData: jellyfinItem, // Store complete BaseItemDto
    updatedAt: new Date(),
  };
}

/**
 * Process valid items - separate into inserts and updates based on detailed field comparison
 */
async function processValidItems(
  validItems: NewItem[],
  invalidItems: Array<{ id: string; error: string }>,
  serverId: number
): Promise<{
  insertResult: number;
  updateResult: number;
  unchangedCount: number;
  itemsMigrated: number;
  sessionsMigrated: number;
}> {
  // Fetch existing items' etags to compare
  const jellyfinIds = validItems.map((item) => item.id);

  const existingItems = await db
    .select({ id: items.id, etag: items.etag })
    .from(items)
    .where(and(inArray(items.id, jellyfinIds), eq(items.serverId, serverId)));

  const existingMap = new Map(
    existingItems.map((item) => [item.id, item.etag])
  );

  // Separate items into inserts, updates, and unchanged based on etag
  const itemsToInsert: NewItem[] = [];
  const itemsToUpdate: NewItem[] = [];
  const unchangedItems: NewItem[] = [];

  for (const item of validItems) {
    const existingEtag = existingMap.get(item.id);

    if (existingEtag === undefined) {
      // New item
      itemsToInsert.push(item);
    } else if (existingEtag !== item.etag) {
      // Etag changed, needs update
      itemsToUpdate.push(item);
    } else {
      // Unchanged
      unchangedItems.push(item);
    }
  }

  // Process insertions and updates
  const insertResults = await processInserts(itemsToInsert);
  const updateResult = await processUpdates(itemsToUpdate);
  const unchangedCount = unchangedItems.length;

  return {
    insertResult: insertResults.insertCount,
    updateResult,
    unchangedCount,
    itemsMigrated: insertResults.itemsMigrated,
    sessionsMigrated: insertResults.sessionsMigrated,
  };
}

/**
 * Insert new items and check for previously deleted items to migrate data from
 */
async function processInserts(itemsToInsert: NewItem[]): Promise<{
  insertCount: number;
  itemsMigrated: number;
  sessionsMigrated: number;
}> {
  if (itemsToInsert.length === 0) {
    return { insertCount: 0, itemsMigrated: 0, sessionsMigrated: 0 };
  }

  let itemsMigrated = 0;
  let sessionsMigrated = 0;

  try {
    const start = Date.now();

    // Insert all items first (required before migrating sessions due to FK constraints)
    await db.insert(items).values(itemsToInsert);

    // After inserting, check each item for matches with deleted items and migrate data
    for (const item of itemsToInsert) {
      const migrationResult = await checkAndMigrateDeletedItem(item);
      if (migrationResult.migrated) {
        itemsMigrated++;
        sessionsMigrated += migrationResult.sessionsMigrated;
      }
    }

    console.info(
      formatSyncLogLine("items-sync", {
        server: String(itemsToInsert[0]?.serverId ?? 0),
        page: 0,
        processed: 0,
        inserted: itemsToInsert.length,
        updated: 0,
        errors: 0,
        processMs: Date.now() - start,
        totalProcessed: 0,
        phase: "dbInsert",
        itemsMigrated,
        sessionsMigrated,
      })
    );
    return {
      insertCount: itemsToInsert.length,
      itemsMigrated,
      sessionsMigrated,
    };
  } catch (error) {
    console.error(
      formatSyncLogLine("items-sync", {
        server: String(itemsToInsert[0]?.serverId ?? 0),
        page: 0,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 1,
        processMs: 0,
        totalProcessed: 0,
        phase: "dbInsert",
        message: "Error inserting items",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    );
    throw error;
  }
}

/**
 * Update changed items
 */
async function processUpdates(itemsToUpdate: NewItem[]): Promise<number> {
  if (itemsToUpdate.length === 0) return 0;

  let updateCount = 0;
  const start = Date.now();

  for (const item of itemsToUpdate) {
    try {
      await db
        .update(items)
        .set({
          ...item,
          updatedAt: new Date(),
          // Reset sync flags so data will be re-fetched
          peopleSynced: false,
          mediaSourcesSynced: false,
          processed: false,
        })
        .where(and(eq(items.id, item.id), eq(items.serverId, item.serverId)));

      updateCount++;
    } catch (error) {
      console.error(
        formatSyncLogLine("items-sync", {
          server: String(item.serverId),
          page: 0,
          processed: 0,
          inserted: 0,
          updated: 0,
          errors: 1,
          processMs: 0,
          totalProcessed: 0,
          phase: "dbUpdate",
          itemId: item.id,
          message: "Error updating item",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      );
      // Continue with other items rather than failing the whole batch
    }
  }

  console.info(
    formatSyncLogLine("items-sync", {
      server: String(itemsToUpdate[0]?.serverId ?? 0),
      page: 0,
      processed: 0,
      inserted: 0,
      updated: updateCount,
      errors: 0,
      processMs: Date.now() - start,
      totalProcessed: 0,
      phase: "dbUpdate",
    })
  );
  return updateCount;
}

/**
 * Check if a new item matches a previously deleted item and migrate data if so.
 * Returns migration stats.
 */
async function checkAndMigrateDeletedItem(newItem: NewItem): Promise<{
  migrated: boolean;
  sessionsMigrated: number;
  hiddenRecsMigrated: number;
}> {
  const result = {
    migrated: false,
    sessionsMigrated: 0,
    hiddenRecsMigrated: 0,
  };

  // Find deleted items with matching criteria
  const deletedMatch = await findDeletedItemMatch(newItem);

  if (!deletedMatch) {
    return result;
  }

  console.info(
    `[items-sync] Migrating data from deleted item ${deletedMatch.id} to new item ${newItem.id} (matched by: ${deletedMatch.matchReason})`
  );

  // Migrate sessions from old item to new item
  const migratedSessions = await db
    .update(sessions)
    .set({ itemId: newItem.id })
    .where(eq(sessions.itemId, deletedMatch.id))
    .returning({ id: sessions.id });

  result.sessionsMigrated = migratedSessions.length;

  // Migrate hidden recommendations from old item to new item
  const migratedRecs = await db
    .update(hiddenRecommendations)
    .set({ itemId: newItem.id })
    .where(eq(hiddenRecommendations.itemId, deletedMatch.id))
    .returning({ id: hiddenRecommendations.id });

  result.hiddenRecsMigrated = migratedRecs.length;
  result.migrated = true;

  // Hard-delete the old item since all related data has been migrated
  await db.delete(items).where(eq(items.id, deletedMatch.id));

  console.info(
    `[items-sync] Migrated ${result.sessionsMigrated} sessions and ${result.hiddenRecsMigrated} hidden recommendations from ${deletedMatch.id} to ${newItem.id}, deleted old item`
  );

  return result;
}

/**
 * Find a deleted item that matches the new item by provider IDs or stable attributes
 */
async function findDeletedItemMatch(
  newItem: NewItem
): Promise<{ id: string; matchReason: string } | null> {
  // 1. Try to match by provider IDs first (IMDB, TMDB, etc.) - most reliable
  if (newItem.providerIds && typeof newItem.providerIds === "object") {
    const providerIds = newItem.providerIds as Record<string, string>;

    // Get all deleted items for this server that have provider IDs
    const deletedItemsWithProviders = await db
      .select({ id: items.id, providerIds: items.providerIds })
      .from(items)
      .where(
        and(
          eq(items.serverId, newItem.serverId),
          isNotNull(items.deletedAt),
          isNotNull(items.providerIds)
        )
      );

    for (const deletedItem of deletedItemsWithProviders) {
      if (
        !deletedItem.providerIds ||
        typeof deletedItem.providerIds !== "object"
      ) {
        continue;
      }

      const deletedProviderIds = deletedItem.providerIds as Record<
        string,
        string
      >;

      // Check if any provider ID matches
      for (const [provider, id] of Object.entries(providerIds)) {
        if (id && deletedProviderIds[provider] === id) {
          return { id: deletedItem.id, matchReason: `${provider}:${id}` };
        }
      }
    }
  }

  // 2. Fallback: Match by stable attributes (not IDs that change on re-add)

  // Episodes: type + series_name + index_number + parent_index_number (+ optional production_year)
  const indexNum = newItem.indexNumber;
  const parentIndexNum = newItem.parentIndexNumber;
  if (
    newItem.type === "Episode" &&
    newItem.seriesName &&
    indexNum != null &&
    parentIndexNum != null
  ) {
    // Try with production year first if available
    if (newItem.productionYear) {
      const deletedEpisode = await db
        .select({ id: items.id })
        .from(items)
        .where(
          and(
            eq(items.serverId, newItem.serverId),
            isNotNull(items.deletedAt),
            eq(items.type, "Episode"),
            sql`lower(${items.seriesName}) = lower(${newItem.seriesName})`,
            eq(items.productionYear, newItem.productionYear),
            eq(items.indexNumber, indexNum),
            eq(items.parentIndexNumber, parentIndexNum)
          )
        )
        .limit(1);

      if (deletedEpisode.length > 0) {
        return {
          id: deletedEpisode[0].id,
          matchReason: `episode:${newItem.seriesName}:${newItem.productionYear}:S${parentIndexNum}E${indexNum}`,
        };
      }
    }

    // Fallback: search without production year
    const deletedEpisodeNoYear = await db
      .select({ id: items.id })
      .from(items)
      .where(
        and(
          eq(items.serverId, newItem.serverId),
          isNotNull(items.deletedAt),
          eq(items.type, "Episode"),
          sql`lower(${items.seriesName}) = lower(${newItem.seriesName})`,
          eq(items.indexNumber, indexNum),
          eq(items.parentIndexNumber, parentIndexNum)
        )
      )
      .limit(1);

    if (deletedEpisodeNoYear.length > 0) {
      return {
        id: deletedEpisodeNoYear[0].id,
        matchReason: `episode:${newItem.seriesName}:S${parentIndexNum}E${indexNum}`,
      };
    }
  }

  // Season: type + series_name + index_number (+ optional production_year)
  if (newItem.type === "Season" && newItem.seriesName && indexNum != null) {
    // Try with production year first if available
    if (newItem.productionYear) {
      const deletedSeason = await db
        .select({ id: items.id })
        .from(items)
        .where(
          and(
            eq(items.serverId, newItem.serverId),
            isNotNull(items.deletedAt),
            eq(items.type, "Season"),
            sql`lower(${items.seriesName}) = lower(${newItem.seriesName})`,
            eq(items.productionYear, newItem.productionYear),
            eq(items.indexNumber, indexNum)
          )
        )
        .limit(1);

      if (deletedSeason.length > 0) {
        return {
          id: deletedSeason[0].id,
          matchReason: `season:${newItem.seriesName}:${newItem.productionYear}:${indexNum}`,
        };
      }
    }

    // Fallback: search without production year
    const deletedSeasonNoYear = await db
      .select({ id: items.id })
      .from(items)
      .where(
        and(
          eq(items.serverId, newItem.serverId),
          isNotNull(items.deletedAt),
          eq(items.type, "Season"),
          sql`lower(${items.seriesName}) = lower(${newItem.seriesName})`,
          eq(items.indexNumber, indexNum)
        )
      )
      .limit(1);

    if (deletedSeasonNoYear.length > 0) {
      return {
        id: deletedSeasonNoYear[0].id,
        matchReason: `season:${newItem.seriesName}:${indexNum}`,
      };
    }
  }

  // Series: name + type + production_year
  if (newItem.type === "Series" && newItem.name && newItem.productionYear) {
    const deletedSeries = await db
      .select({ id: items.id })
      .from(items)
      .where(
        and(
          eq(items.serverId, newItem.serverId),
          isNotNull(items.deletedAt),
          eq(items.type, "Series"),
          sql`lower(${items.name}) = lower(${newItem.name})`,
          eq(items.productionYear, newItem.productionYear)
        )
      )
      .limit(1);

    if (deletedSeries.length > 0) {
      return {
        id: deletedSeries[0].id,
        matchReason: `series:${newItem.name}:${newItem.productionYear}`,
      };
    }
  }

  return null;
}

/**
 * Sync media sources for an item from Jellyfin data
 */
async function syncMediaSources(
  jellyfinItem: JellyfinBaseItemDto,
  serverId: number
): Promise<void> {
  const jellyfinMediaSources = jellyfinItem.MediaSources;

  // If no media sources, just mark as synced
  if (!jellyfinMediaSources || !Array.isArray(jellyfinMediaSources) || jellyfinMediaSources.length === 0) {
    await db
      .update(items)
      .set({ mediaSourcesSynced: true })
      .where(eq(items.id, jellyfinItem.Id));
    return;
  }

  const mediaSourceRecords: NewMediaSource[] = jellyfinMediaSources
    .map((ms: Record<string, unknown>, index: number) => ({
      id: (ms.Id as string) || `${jellyfinItem.Id}-${index}`,
      itemId: jellyfinItem.Id,
      serverId,
      size: typeof ms.Size === "number" ? ms.Size : null,
      bitrate: typeof ms.Bitrate === "number" ? ms.Bitrate : null,
      container: typeof ms.Container === "string" ? ms.Container : null,
      name: typeof ms.Name === "string" ? ms.Name : null,
      path: typeof ms.Path === "string" ? ms.Path : null,
      isRemote: typeof ms.IsRemote === "boolean" ? ms.IsRemote : false,
      runtimeTicks: typeof ms.RunTimeTicks === "number" ? ms.RunTimeTicks : null,
    }));

  if (mediaSourceRecords.length === 0) {
    await db
      .update(items)
      .set({ mediaSourcesSynced: true })
      .where(eq(items.id, jellyfinItem.Id));
    return;
  }

  try {
    await db
      .insert(mediaSources)
      .values(mediaSourceRecords)
      .onConflictDoUpdate({
        target: mediaSources.id,
        set: {
          size: sql`EXCLUDED.size`,
          bitrate: sql`EXCLUDED.bitrate`,
          container: sql`EXCLUDED.container`,
          name: sql`EXCLUDED.name`,
          path: sql`EXCLUDED.path`,
          isRemote: sql`EXCLUDED.is_remote`,
          runtimeTicks: sql`EXCLUDED.runtime_ticks`,
          updatedAt: sql`NOW()`,
        },
      });

    // Mark item as having media sources synced
    await db
      .update(items)
      .set({ mediaSourcesSynced: true })
      .where(eq(items.id, jellyfinItem.Id));
  } catch (error) {
    console.error(
      `[items-sync] Error syncing media sources for item ${jellyfinItem.Id}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Sync media sources for multiple items in batch
 */
async function syncMediaSourcesBatch(
  jellyfinItems: JellyfinBaseItemDto[],
  serverId: number
): Promise<void> {
  if (jellyfinItems.length === 0) {
    return;
  }

  const allMediaSourceRecords: NewMediaSource[] = [];
  const allItemIds = jellyfinItems.map((item) => item.Id);

  for (const jellyfinItem of jellyfinItems) {
    const jellyfinMediaSources = jellyfinItem.MediaSources;

    if (!jellyfinMediaSources || !Array.isArray(jellyfinMediaSources) || jellyfinMediaSources.length === 0) {
      continue;
    }

    for (let index = 0; index < jellyfinMediaSources.length; index++) {
      const ms = jellyfinMediaSources[index] as Record<string, unknown>;
      allMediaSourceRecords.push({
        id: (ms.Id as string) || `${jellyfinItem.Id}-${index}`,
        itemId: jellyfinItem.Id,
        serverId,
        size: typeof ms.Size === "number" ? ms.Size : null,
        bitrate: typeof ms.Bitrate === "number" ? ms.Bitrate : null,
        container: typeof ms.Container === "string" ? ms.Container : null,
        name: typeof ms.Name === "string" ? ms.Name : null,
        path: typeof ms.Path === "string" ? ms.Path : null,
        isRemote: typeof ms.IsRemote === "boolean" ? ms.IsRemote : false,
        runtimeTicks: typeof ms.RunTimeTicks === "number" ? ms.RunTimeTicks : null,
      });
    }
  }

  try {
    // Insert media sources in batches of 500 to avoid query size limits
    if (allMediaSourceRecords.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < allMediaSourceRecords.length; i += batchSize) {
        const batch = allMediaSourceRecords.slice(i, i + batchSize);
        await db
          .insert(mediaSources)
          .values(batch)
          .onConflictDoUpdate({
            target: mediaSources.id,
            set: {
              size: sql`EXCLUDED.size`,
              bitrate: sql`EXCLUDED.bitrate`,
              container: sql`EXCLUDED.container`,
              name: sql`EXCLUDED.name`,
              path: sql`EXCLUDED.path`,
              isRemote: sql`EXCLUDED.is_remote`,
              runtimeTicks: sql`EXCLUDED.runtime_ticks`,
              updatedAt: sql`NOW()`,
            },
          });
      }
    }

    // Mark all items as having media sources synced
    await db
      .update(items)
      .set({ mediaSourcesSynced: true })
      .where(inArray(items.id, allItemIds));
  } catch (error) {
    console.error(
      `[items-sync] Error syncing media sources batch: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
