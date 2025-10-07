import {
  db,
  Item,
  items,
  Library,
  libraries,
  NewItem,
  Server,
  sessions,
} from "@streamystats/database";
import { and, eq, inArray } from "drizzle-orm";
import pLimit from "p-limit";
import pMap from "p-map";
import { JellyfinBaseItemDto, JellyfinClient } from "../client";
import {
  createSyncResult,
  SyncMetricsTracker,
  SyncResult,
} from "../sync-metrics";

const DUPLICATE_MIN_CONFIDENCE = 40;

export interface ItemSyncOptions {
  itemPageSize?: number;
  batchSize?: number;
  maxLibraryConcurrency?: number;
  itemConcurrency?: number;
  apiRequestDelayMs?: number;
  recentItemsLimit?: number;
}

export interface ItemSyncData {
  librariesProcessed: number;
  itemsProcessed: number;
  itemsInserted: number;
  itemsUpdated: number;
  itemsUnchanged: number;
}

export async function syncItems(
  server: Server,
  options: ItemSyncOptions = {},
): Promise<SyncResult<ItemSyncData>> {
  const {
    itemPageSize = 500,
    batchSize = 1000,
    maxLibraryConcurrency = 2,
    itemConcurrency = 10,
    apiRequestDelayMs = 100,
  } = options;

  const metrics = new SyncMetricsTracker();
  const client = JellyfinClient.fromServer(server);
  const errors: string[] = [];

  try {
    console.log(`Starting items sync for server ${server.name}`);

    // Get all libraries for this server
    const serverLibraries = await db
      .select()
      .from(libraries)
      .where(eq(libraries.serverId, server.id));

    console.log(`Found ${serverLibraries.length} libraries to sync`);

    // Process libraries with limited concurrency
    const libraryLimit = pLimit(maxLibraryConcurrency);

    await Promise.all(
      serverLibraries.map((library: Library) =>
        libraryLimit(async () => {
          try {
            console.log(
              `Starting sync for library: ${library.name} (${library.id})`,
            );
            await syncLibraryItems(library.id, client, metrics, {
              itemPageSize,
              batchSize,
              itemConcurrency,
              apiRequestDelayMs,
            });
            metrics.incrementLibrariesProcessed();
            console.log(`Completed sync for library: ${library.name}`);
          } catch (error) {
            console.error(`Error syncing library ${library.name}:`, error);
            metrics.incrementErrors();
            errors.push(
              `Library ${library.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        }),
      ),
    );

    const finalMetrics = metrics.finish();
    const data: ItemSyncData = {
      librariesProcessed: finalMetrics.librariesProcessed,
      itemsProcessed: finalMetrics.itemsProcessed,
      itemsInserted: finalMetrics.itemsInserted,
      itemsUpdated: finalMetrics.itemsUpdated,
      itemsUnchanged: finalMetrics.itemsUnchanged,
    };

    console.log(`Items sync completed for server ${server.name}:`, data);

    if (errors.length > 0) {
      return createSyncResult("partial", data, finalMetrics, undefined, errors);
    }

    return createSyncResult("success", data, finalMetrics);
  } catch (error) {
    console.error(`Items sync failed for server ${server.name}:`, error);
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
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

async function syncLibraryItems(
  libraryId: string,
  client: JellyfinClient,
  metrics: SyncMetricsTracker,
  options: {
    itemPageSize: number;
    batchSize: number;
    itemConcurrency: number;
    apiRequestDelayMs: number;
  },
): Promise<void> {
  let startIndex = 0;
  let hasMoreItems = true;

  while (hasMoreItems) {
    // Add delay between API requests
    if (startIndex > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, options.apiRequestDelayMs),
      );
    }

    console.log(
      `Fetching items ${startIndex} to ${startIndex + options.itemPageSize} for library ${libraryId}`,
    );

    try {
      metrics.incrementApiRequests();
      const { items: jellyfinItems, totalCount } = await client.getItemsPage(
        libraryId,
        startIndex,
        options.itemPageSize,
      );

      console.log(
        `Fetched ${jellyfinItems.length} items from Jellyfin (${
          startIndex + jellyfinItems.length
        }/${totalCount})`,
      );

      // Process items in smaller batches to avoid overwhelming the database
      await pMap(
        jellyfinItems,
        async (jellyfinItem) => {
          try {
            await processItem(jellyfinItem, libraryId, metrics);
          } catch (error) {
            console.error(`Error processing item ${jellyfinItem.Id}:`, error);
            metrics.incrementErrors();
          }
        },
        { concurrency: options.itemConcurrency },
      );

      startIndex += jellyfinItems.length;
      hasMoreItems = startIndex < totalCount && jellyfinItems.length > 0;

      console.log(
        `Processed batch for library ${libraryId}: ${startIndex}/${totalCount} items`,
      );
    } catch (error) {
      console.error(
        `Error fetching items page for library ${libraryId}:`,
        error,
      );
      metrics.incrementErrors();
      break; // Stop processing this library on API error
    }
  }
}

/**
 * Check if two items have matching provider IDs
 */
function hasMatchingProviderIds(
  providerIds1: Record<string, string> | null,
  providerIds2: Record<string, string> | null,
): boolean {
  if (!providerIds1 || !providerIds2) {
    return false;
  }

  const allProviders = new Set([
    ...Object.keys(providerIds1),
    ...Object.keys(providerIds2),
  ]);

  // Check if any provider has matching IDs in both items
  for (const provider of allProviders) {
    if (providerIds1[provider] && providerIds2[provider]) {
      if (providerIds1[provider] === providerIds2[provider]) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate confidence score for item match
 */
function calculateMatchConfidence(
  jellyfinItem: JellyfinBaseItemDto,
  existingItem: Item,
): number {
  let confidence = 0;
  const maxConfidence = 100;

  // Path match is most reliable (50 points)
  if (
    jellyfinItem.Path &&
    existingItem.path &&
    jellyfinItem.Path === existingItem.path
  ) {
    confidence += 50;
  }

  // Provider ID match is very reliable (40 points)
  if (
    hasMatchingProviderIds(
      jellyfinItem.ProviderIds || null,
      existingItem.providerIds as Record<string, string> | null,
    )
  ) {
    confidence += 40;
  }

  // For episodes: series + season + episode number (30 points)
  if (
    jellyfinItem.Type === "Episode" &&
    existingItem.type === "Episode" &&
    jellyfinItem.SeriesName === existingItem.seriesName &&
    jellyfinItem.IndexNumber === existingItem.indexNumber &&
    (jellyfinItem.ParentIndexNumber ?? 1) ===
      (existingItem.parentIndexNumber ?? 1)
  ) {
    confidence += 30;
  }

  // For movies: name + year + runtime (30 points)
  if (
    jellyfinItem.Type === "Movie" &&
    existingItem.type === "Movie" &&
    jellyfinItem.Name === existingItem.name
  ) {
    confidence += 10;

    if (
      jellyfinItem.ProductionYear &&
      existingItem.productionYear &&
      jellyfinItem.ProductionYear === existingItem.productionYear
    ) {
      confidence += 10;
    }

    if (
      jellyfinItem.RunTimeTicks &&
      existingItem.runtimeTicks &&
      Math.abs(jellyfinItem.RunTimeTicks - existingItem.runtimeTicks) <
        5 * 600000000
    ) {
      // Within 5 minutes
      confidence += 10;
    }
  }

  // Name and type match (10 points)
  if (
    jellyfinItem.Name === existingItem.name &&
    jellyfinItem.Type === existingItem.type
  ) {
    confidence += 10;
  }

  return Math.min(confidence, maxConfidence);
}

/**
 * Find potential duplicate item that could be the same content with a different ID
 * This helps handle the case where Jellyfin removes and re-adds items with new IDs
 */
async function findPotentialDuplicate(
  jellyfinItem: JellyfinBaseItemDto,
  libraryId: string,
  serverId: number,
): Promise<Item | null> {
  // Don't look for duplicates if we don't have good identifying information
  if (!jellyfinItem.Name) {
    return null;
  }

  // Get all potential candidates with a broader query
  const candidates = await db
    .select()
    .from(items)
    .where(and(eq(items.serverId, serverId), eq(items.libraryId, libraryId)));

  // Score each candidate
  const scoredCandidates = candidates
    .map((candidate) => ({
      item: candidate,
      confidence: calculateMatchConfidence(jellyfinItem, candidate),
    }))
    .filter((scored) => scored.confidence >= DUPLICATE_MIN_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence);

  if (scoredCandidates.length > 0) {
    const bestMatch = scoredCandidates[0];

    console.log(
      `Found potential duplicate for ${jellyfinItem.Type} "${jellyfinItem.Name}": ` +
        `existing ID ${bestMatch.item.id} -> new ID ${jellyfinItem.Id} ` +
        `(confidence: ${bestMatch.confidence}%)`,
    );

    return bestMatch.item;
  }

  return null;
}

async function processItem(
  jellyfinItem: JellyfinBaseItemDto,
  libraryId: string,
  metrics: SyncMetricsTracker,
): Promise<void> {
  const serverId = await getServerIdFromLibrary(libraryId);

  // Check if item already exists and compare etag for changes
  const existingItem = await db
    .select({ etag: items.etag })
    .from(items)
    .where(eq(items.id, jellyfinItem.Id))
    .limit(1);

  const isNewItem = existingItem.length === 0;
  const hasChanged = !isNewItem && existingItem[0].etag !== jellyfinItem.Etag;

  // If this is a "new" item, check for potential duplicates (items removed and re-added)
  let duplicateItem: Item | null = null;
  if (isNewItem) {
    duplicateItem = await findPotentialDuplicate(
      jellyfinItem,
      libraryId,
      serverId,
    );
  }

  if (!isNewItem && !hasChanged) {
    metrics.incrementItemsUnchanged();
    metrics.incrementItemsProcessed();
    return; // Skip if item hasn't changed
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
    isFolder: jellyfinItem.IsFolder,
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

  if (duplicateItem) {
    console.log(
      `Migrating duplicate item: ${duplicateItem.id} -> ${jellyfinItem.Id} ` +
        `for "${jellyfinItem.Name}" (${jellyfinItem.Type})`,
    );

    try {
      await db.transaction(async (tx) => {
        // 1. Insert the new item record with the new ID and updated data
        await tx.insert(items).values(itemData);

        // 2. Update any sessions that reference the old item ID to use the new ID
        await tx
          .update(sessions)
          .set({ itemId: jellyfinItem.Id })
          .where(eq(sessions.itemId, duplicateItem.id));

        // 3. Delete the old item record
        await tx.delete(items).where(eq(items.id, duplicateItem.id));
      });

      console.log(
        `Successfully migrated item and updated session references: ${duplicateItem.id} -> ${jellyfinItem.Id}`,
      );

      metrics.incrementItemsUpdated();
    } catch (error) {
      console.error(
        `Failed to migrate duplicate item ${duplicateItem.id} -> ${jellyfinItem.Id}:`,
        error,
      );
      throw error;
    }
  } else {
    await db
      .insert(items)
      .values(itemData)
      .onConflictDoUpdate({
        target: items.id,
        set: {
          ...itemData,
          updatedAt: new Date(),
        },
      });

    if (isNewItem) {
      metrics.incrementItemsInserted();
    } else {
      metrics.incrementItemsUpdated();
    }
  }

  metrics.incrementDatabaseOperations();
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

  const serverId = library[0].serverId;
  serverIdCache.set(libraryId, serverId);
  return serverId;
}

export async function syncRecentlyAddedItems(
  server: Server,
  limit: number = 100,
): Promise<SyncResult<ItemSyncData>> {
  const metrics = new SyncMetricsTracker();
  const client = JellyfinClient.fromServer(server);
  const errors: string[] = [];

  try {
    console.log(
      `Starting recently added items sync for server ${server.name} (limit: ${limit})`,
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
      existingLibraryIds.has(library.id),
    );

    const removedLibraries = serverLibraries.filter(
      (library) => !existingLibraryIds.has(library.id),
    );

    if (removedLibraries.length > 0) {
      console.log(
        `Found ${removedLibraries.length} libraries that no longer exist on server:`,
        removedLibraries.map((lib) => `${lib.name} (${lib.id})`).join(", "),
      );
    }

    console.log(
      `Found ${validLibraries.length} valid libraries to sync (${
        serverLibraries.length - validLibraries.length
      } removed libraries skipped)`,
    );

    let allMappedItems: NewItem[] = [];
    let allInvalidItems: Array<{ id: string; error: string }> = [];

    // Collect recent items from all valid libraries with their already-known library IDs
    for (const library of validLibraries) {
      try {
        console.log(
          `Fetching recently added items from library: ${library.name} (limit: ${limit})`,
        );

        metrics.incrementApiRequests();
        const libraryItems = await client.getRecentlyAddedItemsByLibrary(
          library.id,
          limit,
        );

        metrics.incrementItemsProcessed(libraryItems.length);
        console.log(
          `Retrieved ${libraryItems.length} recently added items from library ${library.name}`,
        );

        // Map items, knowing they belong to the current library
        const { validItems, invalidItems } = await mapItemsWithKnownLibrary(
          libraryItems,
          library.id,
          server.id,
        );

        allMappedItems = allMappedItems.concat(validItems);
        allInvalidItems = allInvalidItems.concat(invalidItems);
      } catch (error) {
        console.error(
          `API error when fetching items from library ${library.name}:`,
          error,
        );
        metrics.incrementErrors();
        errors.push(
          `Library ${library.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    console.log(
      `Total recently added items collected: ${allMappedItems.length}`,
    );

    if (allMappedItems.length === 0) {
      console.log("No recently added items found across libraries");
      const finalMetrics = metrics.finish();
      const data: ItemSyncData = {
        librariesProcessed: validLibraries.length,
        itemsProcessed: finalMetrics.itemsProcessed,
        itemsInserted: 0,
        itemsUpdated: 0,
        itemsUnchanged: 0,
      };
      return createSyncResult("success", data, finalMetrics);
    }

    // Process valid items - determine inserts vs updates
    metrics.incrementDatabaseOperations();
    const { insertResult, updateResult, unchangedCount } =
      await processValidItems(allMappedItems, allInvalidItems, server.id);

    const finalMetrics = metrics.finish();
    const data: ItemSyncData = {
      librariesProcessed: validLibraries.length,
      itemsProcessed: finalMetrics.itemsProcessed,
      itemsInserted: insertResult,
      itemsUpdated: updateResult,
      itemsUnchanged: unchangedCount,
    };

    // Optionally clean up libraries that no longer exist on the server
    if (removedLibraries.length > 0) {
      try {
        const removedLibraryIds = removedLibraries.map((lib) => lib.id);

        // Note: We don't automatically delete libraries as they might contain important historical data
        // Instead, we just log them. In the future, we could add a configuration option for automatic cleanup
        console.log(
          `Libraries no longer on server (not automatically removed): ${removedLibraries
            .map((lib) => lib.name)
            .join(", ")}`,
        );

        // If you want to enable automatic cleanup, uncomment the following:
        // await db.delete(libraries).where(inArray(libraries.id, removedLibraryIds));
        // console.log(`Removed ${removedLibraries.length} obsolete libraries from database`);
      } catch (cleanupError) {
        console.error("Error during library cleanup:", cleanupError);
        // Don't fail the entire sync for cleanup errors
      }
    }

    console.log(
      `Recently added items sync completed for server ${server.name}:`,
      data,
    );

    if (allInvalidItems.length > 0 || errors.length > 0) {
      const allErrors = errors.concat(
        allInvalidItems.map((item) => `Item ${item.id}: ${item.error}`),
      );
      return createSyncResult(
        "partial",
        data,
        finalMetrics,
        undefined,
        allErrors,
      );
    }

    return createSyncResult("success", data, finalMetrics);
  } catch (error) {
    console.error(
      `Recently added items sync failed for server ${server.name}:`,
      error,
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
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

/**
 * Map Jellyfin items to our format with known library context
 */
async function mapItemsWithKnownLibrary(
  items: JellyfinBaseItemDto[],
  libraryId: string,
  serverId: number,
): Promise<{
  validItems: NewItem[];
  invalidItems: Array<{ id: string; error: string }>;
}> {
  const validItems: NewItem[] = [];
  const invalidItems: Array<{ id: string; error: string }> = [];

  for (const item of items) {
    try {
      // We already know the library_id since we fetched per library
      const mappedItem = mapJellyfinItem(item, libraryId, serverId);
      validItems.push(mappedItem);
    } catch (error) {
      // Catch any mapping errors
      console.error(`Error mapping item ${item.Id}:`, error);
      invalidItems.push({
        id: item.Id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { validItems, invalidItems };
}

/**
 * Map a single Jellyfin item to our database format
 */
function mapJellyfinItem(
  jellyfinItem: JellyfinBaseItemDto,
  libraryId: string,
  serverId: number,
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
    isFolder: jellyfinItem.IsFolder,
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
  serverId: number,
): Promise<{
  insertResult: number;
  updateResult: number;
  unchangedCount: number;
}> {
  // Fields that we track for changes (matching the Elixir version)
  const trackedFields = [
    "name",
    "originalTitle",
    "etag",
    "container",
    "sortName",
    "premiereDate",
    "path",
    "officialRating",
    "overview",
    "communityRating",
    "runtimeTicks",
    "productionYear",
    "isFolder",
    "parentId",
    "mediaType",
    "width",
    "height",
    "seriesName",
    "seriesId",
    "seasonId",
    "seasonName",
    "indexNumber",
    "parentIndexNumber",
    "primaryImageAspectRatio",
    "primaryImageTag",
    "seriesPrimaryImageTag",
    "primaryImageThumbTag",
    "primaryImageLogoTag",
    "parentThumbItemId",
    "parentThumbImageTag",
    "parentLogoItemId",
    "parentLogoImageTag",
    "backdropImageTags",
    "parentBackdropItemId",
    "parentBackdropImageTags",
    "imageBlurHashes",
    "imageTags",
    "canDelete",
    "canDownload",
    "playAccess",
    "isHD",
    "providerIds",
    "tags",
    "seriesStudio",
    "videoType",
    "hasSubtitles",
    "channelId",
    "locationType",
    "genres",
  ] as const;

  // Fetch existing items with all fields to compare
  const jellyfinIds = validItems.map((item) => item.id);

  const existingItems = await db
    .select()
    .from(items)
    .where(and(inArray(items.id, jellyfinIds), eq(items.serverId, serverId)));

  const existingMap = new Map(
    existingItems.map((item: Item) => [item.id, item]),
  );

  // Separate items into inserts, updates, and unchanged
  const itemsToInsert: NewItem[] = [];
  const itemsToUpdate: NewItem[] = [];
  const unchangedItems: NewItem[] = [];

  for (const item of validItems) {
    const existing = existingMap.get(item.id);

    if (!existing) {
      // New item, add to inserts
      itemsToInsert.push(item);
    } else {
      // Check if any tracked field has changed or if images have changed
      const fieldsChanged = hasFieldsChanged(existing, item, trackedFields);
      const imagesChanged = hasImageFieldsChanged(existing, item);

      if (fieldsChanged || imagesChanged) {
        itemsToUpdate.push(item);
      } else {
        unchangedItems.push(item);
      }
    }
  }

  // Process insertions and updates
  const insertResult = await processInserts(itemsToInsert);
  const updateResult = await processUpdates(itemsToUpdate, trackedFields);
  const unchangedCount = unchangedItems.length;

  return { insertResult, updateResult, unchangedCount };
}

/**
 * Check if any tracked fields have changed between existing and new item
 */
function hasFieldsChanged<T extends Record<string, any>>(
  existing: T,
  newItem: T,
  trackedFields: readonly string[],
): boolean {
  for (const field of trackedFields) {
    const existingValue = existing[field];
    const newValue = newItem[field];

    // Handle dates specially
    if (existingValue instanceof Date && newValue instanceof Date) {
      if (existingValue.getTime() !== newValue.getTime()) {
        return true;
      }
    } else if (existingValue !== newValue) {
      return true;
    }
  }
  return false;
}

/**
 * Check if image-related fields have changed
 */
function hasImageFieldsChanged(existing: any, newItem: any): boolean {
  const imageFields = [
    "primaryImageTag",
    "seriesPrimaryImageTag",
    "primaryImageThumbTag",
    "primaryImageLogoTag",
    "primaryImageAspectRatio",
    "parentThumbItemId",
    "parentThumbImageTag",
    "parentLogoItemId",
    "parentLogoImageTag",
    "backdropImageTags",
    "parentBackdropItemId",
    "parentBackdropImageTags",
    "imageBlurHashes",
    "imageTags",
    "canDelete",
    "canDownload",
    "playAccess",
    "isHD",
    "providerIds",
    "tags",
    "seriesStudio",
  ];

  for (const field of imageFields) {
    if (existing[field] !== newItem[field]) {
      return true;
    }
  }

  // Also check rawData for backdrop image tags and image blur hashes
  const existingRaw = existing.rawData || {};
  const newRaw = newItem.rawData || {};

  if (
    JSON.stringify(existingRaw.BackdropImageTags) !==
    JSON.stringify(newRaw.BackdropImageTags)
  ) {
    return true;
  }

  if (
    JSON.stringify(existingRaw.ImageBlurHashes) !==
    JSON.stringify(newRaw.ImageBlurHashes)
  ) {
    return true;
  }

  return false;
}

/**
 * Insert new items
 */
async function processInserts(itemsToInsert: NewItem[]): Promise<number> {
  if (itemsToInsert.length === 0) return 0;

  try {
    await db.insert(items).values(itemsToInsert);
    console.log(`Inserted ${itemsToInsert.length} new items`);
    return itemsToInsert.length;
  } catch (error) {
    console.error("Error inserting items:", error);
    throw error;
  }
}

/**
 * Update changed items
 */
async function processUpdates(
  itemsToUpdate: NewItem[],
  trackedFields: readonly string[],
): Promise<number> {
  if (itemsToUpdate.length === 0) return 0;

  let updateCount = 0;

  for (const item of itemsToUpdate) {
    try {
      // Convert item to update fields
      const updateFields: Partial<NewItem> = {};
      for (const field of trackedFields) {
        if (field in item) {
          const value = item[field as keyof NewItem];
          if (value !== undefined) {
            (updateFields as any)[field] = value;
          }
        }
      }
      updateFields.updatedAt = new Date();

      await db
        .update(items)
        .set(updateFields)
        .where(and(eq(items.id, item.id), eq(items.serverId, item.serverId)));

      updateCount++;
    } catch (error) {
      console.error(`Error updating item ${item.id}:`, error);
      // Continue with other items rather than failing the whole batch
    }
  }

  console.log(`Updated ${updateCount} items`);
  return updateCount;
}
